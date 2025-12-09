import crypto from 'node:crypto';
import { IUser } from '@/models/User';
import { ITrade } from '@/models/Trade';

type WebullCredentials = {
  appKey: string;
  appSecret: string;
  accountId?: string;
};

type WebullRequestOptions = {
  method: 'GET' | 'POST';
  path: string; // e.g. "/app/subscriptions/list"
  body?: Record<string, unknown> | null;
};

type WebullResponse<T = unknown> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
};

const WEBULL_HOST = 'api.webull.com';
const WEBULL_BASE = `https://${WEBULL_HOST}`;

function getCredentials(user: IUser): WebullCredentials | null {
  if (!user.webullApiKey || !user.webullApiSecret) return null;
  return {
    appKey: user.webullApiKey,
    appSecret: user.webullApiSecret,
    accountId: user.webullAccountId || undefined,
  };
}

function isoTimestamp(): string {
  // Match SDK format: no milliseconds, UTC, trailing Z
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function md5HexUpper(str: string): string {
  return crypto.createHash('md5').update(str, 'utf8').digest('hex').toUpperCase();
}

function buildSignature({
  path,
  host,
  appKey,
  appSecret,
  nonce,
  timestamp,
  body,
  queries,
}: {
  path: string;
  host: string;
  appKey: string;
  appSecret: string;
  nonce: string;
  timestamp: string;
  body?: Record<string, unknown> | null;
  queries?: Record<string, string>;
}) {
  const signHeaders: Record<string, string> = {
    'x-app-key': appKey,
    'x-timestamp': timestamp,
    'x-signature-version': '1.0',
    'x-signature-algorithm': 'HMAC-SHA1',
    'x-signature-nonce': nonce,
  };

  const signParams: Record<string, string> = { host };
  Object.entries(signHeaders).forEach(([k, v]) => {
    signParams[k.toLowerCase()] = v;
  });

  // Include query parameters in signature (extract from path if present)
  const [basePath, queryString] = path.split('?');
  if (queryString) {
    const params = new URLSearchParams(queryString);
    params.forEach((value, key) => {
      signParams[key] = value;
    });
  }
  // Also include explicit queries if provided
  if (queries) {
    Object.entries(queries).forEach(([k, v]) => {
      signParams[k] = v;
    });
  }

  let bodyHash: string | undefined;
  if (body) {
    bodyHash = md5HexUpper(JSON.stringify(body));
  }

  const sorted = Object.entries(signParams)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`);

  // Use base path (without query) for string to sign
  let stringToSign = basePath ? `${basePath}&${sorted.join('&')}` : sorted.join('&');
  if (bodyHash) {
    stringToSign = `${stringToSign}&${bodyHash}`;
  }

  const quoted = encodeURIComponent(stringToSign);
  const hmac = crypto.createHmac('sha1', `${appSecret}&`);
  hmac.update(quoted);
  const signature = hmac.digest('base64');
  return { signature };
}

async function doRequest<T>(
  creds: WebullCredentials,
  options: WebullRequestOptions
): Promise<WebullResponse<T>> {
  const nonce = crypto.randomUUID();
  const timestamp = isoTimestamp();
  const body = options.method === 'POST' ? options.body || null : null;

  // Extract query params from path for signing
  const [basePath, queryString] = options.path.split('?');
  const queries: Record<string, string> = {};
  if (queryString) {
    const params = new URLSearchParams(queryString);
    params.forEach((value, key) => {
      queries[key] = value;
    });
  }

  const { signature } = buildSignature({
    path: basePath,
    host: WEBULL_HOST,
    appKey: creds.appKey,
    appSecret: creds.appSecret,
    nonce,
    timestamp,
    body,
    queries: Object.keys(queries).length > 0 ? queries : undefined,
  });

  const headers: Record<string, string> = {
    'x-version': 'v1',
    'x-app-key': creds.appKey,
    'x-timestamp': timestamp,
    'x-signature-version': '1.0',
    'x-signature-algorithm': 'HMAC-SHA1',
    'x-signature-nonce': nonce,
    'x-signature': signature,
  };

  let bodyString: string | undefined;
  if (body && options.method === 'POST') {
    bodyString = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  const url = `${WEBULL_BASE}${options.path}`;

  const res = await fetch(url, {
    method: options.method,
    headers,
    body: bodyString,
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: typeof data === 'string' ? data : res.statusText,
    };
  }

  return { ok: true, status: res.status, data: data as T };
}

export async function getWebullSubscriptions(user: IUser) {
  const creds = getCredentials(user);
  if (!creds) return { ok: false, status: 0, error: 'Missing Webull credentials' };
  return doRequest<{ subscription_id: string; account_id: string; account_number: string }[]>(
    creds,
    { method: 'GET', path: '/app/subscriptions/list' }
  );
}

async function getInstrumentId(creds: WebullCredentials, ticker: string): Promise<string | null> {
  // Use the correct endpoint: GET /instrument/list?symbols=TICKER&category=US_STOCK
  const resp = await doRequest<Array<{ instrument_id?: string | number; symbol?: string }>>(
    creds,
    {
      method: 'GET',
      path: `/instrument/list?symbols=${encodeURIComponent(ticker)}&category=US_STOCK`,
    }
  );
  
  if (resp.ok && resp.data && Array.isArray(resp.data) && resp.data.length > 0) {
    const instrumentId = resp.data[0]?.instrument_id;
    if (instrumentId) {
      return String(instrumentId);
    }
  }
  
  return null;
}

async function placeWebullOrder(
  creds: WebullCredentials,
  accountId: string,
  instrumentId: string,
  side: 'BUY' | 'SELL',
  qty: number
): Promise<{ ok: boolean; client_order_id?: string; error?: string }> {
  const clientOrderId = crypto.randomUUID().replace(/-/g, '').substring(0, 40);
  
  const stockOrder = {
    client_order_id: clientOrderId,
    side,
    tif: 'DAY',
    extended_hours_trading: false,
    instrument_id: instrumentId,
    order_type: 'MARKET',
    qty: String(Math.max(1, Math.min(5, qty))), // Clamp 1-5
  };
  
  const resp = await doRequest<{ client_order_id?: string }>(
    creds,
    {
      method: 'POST',
      path: '/trade/order/place',
      body: {
        account_id: accountId,
        stock_order: stockOrder,
      },
    }
  );
  
  if (!resp.ok) {
    return { ok: false, error: resp.error || `HTTP ${resp.status}` };
  }
  
  return { ok: true, client_order_id: resp.data?.client_order_id || clientOrderId };
}

export async function syncTradeToWebull(trade: ITrade, user: IUser) {
  const creds = getCredentials(user);
  if (!creds) {
    console.error('[webull] Missing credentials');
    return;
  }
  
  // Get account_id from subscriptions
  const subs = await getWebullSubscriptions(user);
  if (!subs.ok || !subs.data || subs.data.length === 0) {
    console.error('[webull] No subscriptions found');
    return;
  }
  
  const accountId = creds.accountId || subs.data[0].account_id;
  if (!accountId) {
    console.error('[webull] No account_id available');
    return;
  }
  
  // Get instrument_id for the underlying ticker (Webull only supports stocks/ETFs)
  const instrumentId = await getInstrumentId(creds, trade.ticker);
  if (!instrumentId) {
    console.error(`[webull] Could not get instrument_id for ${trade.ticker}`);
    return;
  }
  
  // Place BUY order: qty = contracts capped at 5
  const qty = Math.max(1, Math.min(5, trade.contracts));
  const result = await placeWebullOrder(creds, accountId, instrumentId, 'BUY', qty);
  
  if (!result.ok) {
    console.error(`[webull] Failed to place BUY order: ${result.error}`);
  } else {
    console.log(`[webull] Placed BUY order: ${result.client_order_id} for ${qty} shares of ${trade.ticker}`);
  }
}

export async function syncSettlementToWebull(
  trade: ITrade,
  user: IUser,
  sellContracts: number,
  _sellPrice: number
) {
  const creds = getCredentials(user);
  if (!creds) {
    console.error('[webull] Missing credentials');
    return;
  }
  
  // Get account_id from subscriptions
  const subs = await getWebullSubscriptions(user);
  if (!subs.ok || !subs.data || subs.data.length === 0) {
    console.error('[webull] No subscriptions found');
    return;
  }
  
  const accountId = creds.accountId || subs.data[0].account_id;
  if (!accountId) {
    console.error('[webull] No account_id available');
    return;
  }
  
  // Get instrument_id for the underlying ticker
  const instrumentId = await getInstrumentId(creds, trade.ticker);
  if (!instrumentId) {
    console.error(`[webull] Could not get instrument_id for ${trade.ticker}`);
    return;
  }
  
  // Place SELL order: qty = sellContracts capped at 5
  const qty = Math.max(1, Math.min(5, sellContracts));
  const result = await placeWebullOrder(creds, accountId, instrumentId, 'SELL', qty);
  
  if (!result.ok) {
    console.error(`[webull] Failed to place SELL order: ${result.error}`);
  } else {
    console.log(`[webull] Placed SELL order: ${result.client_order_id} for ${qty} shares of ${trade.ticker}`);
  }
}

