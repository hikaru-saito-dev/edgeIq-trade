import crypto from 'node:crypto';
import { IUser } from '@/models/User';
import { ITrade } from '@/models/Trade';

type WebullCredentials = {
  appKey: string;
  appSecret: string;
  accountId?: string;
  accessToken?: string; // Optional access token for options trading
};

type WebullRequestOptions = {
  method: 'GET' | 'POST';
  path: string; // e.g. "/app/subscriptions/list"
  body?: Record<string, unknown> | null;
  headers?: Record<string, string>; // Optional custom headers
};

type WebullResponse<T = unknown> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
};

const WEBULL_HOST = 'api.webull.com';
const WEBULL_BASE = `https://${WEBULL_HOST}`;
// Test environment (for options testing): us-openapi-alb.uat.webullbroker.com

function getCredentials(user: IUser): WebullCredentials | null {
  if (!user.webullApiKey || !user.webullApiSecret) return null;
  return {
    appKey: user.webullApiKey,
    appSecret: user.webullApiSecret,
    accountId: user.webullAccountId || undefined,
    accessToken: (user as any).webullAccessToken || undefined, // Optional access token
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

  // Default to v1, but allow override via options.headers (options endpoint uses v2)
  const headers: Record<string, string> = {
    'x-version': options.headers?.['x-version'] || 'v1',
    'x-app-key': creds.appKey,
    'x-timestamp': timestamp,
    'x-signature-version': '1.0',
    'x-signature-algorithm': 'HMAC-SHA1',
    'x-signature-nonce': nonce,
    'x-signature': signature,
  };
  
  // Merge custom headers (x-version, x-access-token, etc.) after setting defaults
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

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

async function placeWebullOptionOrder(
  creds: WebullCredentials,
  accountId: string,
  trade: ITrade,
  side: 'BUY' | 'SELL',
  quantity: number
): Promise<{ ok: boolean; client_order_id?: string; error?: string }> {
  const clientOrderId = crypto.randomUUID().replace(/-/g, '').substring(0, 40);
  
  // Format expiry date as YYYY-MM-DD
  const expiryDateStr = `${trade.expiryDate.getFullYear()}-${String(trade.expiryDate.getMonth() + 1).padStart(2, '0')}-${String(trade.expiryDate.getDate()).padStart(2, '0')}`;
  
  // Convert optionType: 'C' -> 'CALL', 'P' -> 'PUT'
  const optionType = trade.optionType === 'C' ? 'CALL' : 'PUT';
  
  // Clamp quantity to 1-5
  const qty = Math.max(1, Math.min(5, quantity));
  
  // Use fillPrice as limit_price (options require LIMIT orders)
  const limitPrice = String(trade.fillPrice);
  
  // Generate combo order ID (format: alphanumeric, 32 chars)
  const comboOrderId = crypto.randomUUID().replace(/-/g, '').substring(0, 32).toUpperCase();
  
  const optionOrder = {
    account_id: accountId, // account_id in body (not query param)
    client_combo_order_id: comboOrderId,
    new_orders: [
      {
        client_order_id: clientOrderId,
        combo_type: 'NORMAL',
        option_strategy: 'SINGLE',
        side,
        order_type: 'LIMIT',
        time_in_force: 'DAY',
        limit_price: limitPrice,
        quantity: String(qty),
        entrust_type: 'QTY',
        legs: [
          {
            side,
            quantity: String(qty),
            market: 'US',
            instrument_type: 'OPTION',
            symbol: trade.ticker,
            strike_price: String(trade.strike),
            option_expire_date: expiryDateStr,
            option_type: optionType,
          },
        ],
      },
    ],
  };
  
  // Options endpoint: /openapi/trade/option/order/place (from official API docs)
  // Uses x-version: v2 and account_id in body
  const resp = await doRequest<{ client_order_id?: string }>(
    creds,
    {
      method: 'POST',
      path: '/openapi/trade/option/order/place', // No query params
      body: optionOrder,
      headers: {
        'x-version': 'v2', // Use v2 as per example
        ...(creds.accessToken ? { 'x-access-token': creds.accessToken } : {}), // Add access token if available
      },
    }
  );
  
  if (!resp.ok) {
    // Handle different error cases
    if (resp.status === 401) {
      return { 
        ok: false, 
        error: 'Authentication failed. An access token may be required for options trading. Please check your Webull API credentials.' 
      };
    }
    if (resp.status === 404) {
      return { 
        ok: false, 
        error: 'Options trading endpoint not found. This feature may not be available for your account yet.' 
      };
    }
    return { ok: false, error: resp.error || `HTTP ${resp.status}` };
  }
  
  return { ok: true, client_order_id: resp.data?.client_order_id || clientOrderId };
}

export async function syncTradeToWebull(trade: ITrade, user: IUser): Promise<void> {
  const creds = getCredentials(user);
  if (!creds) {
    // If user doesn't have Webull credentials, skip sync (optional feature)
    return;
  }
  
  // Get account_id from subscriptions
  const subs = await getWebullSubscriptions(user);
  if (!subs.ok || !subs.data || subs.data.length === 0) {
    throw new Error('Webull sync failed: No subscriptions found');
  }
  
  const accountId = creds.accountId || subs.data[0].account_id;
  if (!accountId) {
    throw new Error('Webull sync failed: No account_id available');
  }
  
  // Place BUY options order: qty = contracts capped at 5
  const qty = Math.max(1, Math.min(5, trade.contracts));
  const result = await placeWebullOptionOrder(creds, accountId, trade, 'BUY', qty);
  
  if (!result.ok) {
    throw new Error(`Webull sync failed: ${result.error}`);
  }
  
  const optionLabel = `${trade.ticker} ${trade.strike}${trade.optionType === 'C' ? 'C' : 'P'}`;
  console.log(`[webull] Placed BUY options order: ${result.client_order_id} for ${qty} contracts of ${optionLabel}`);
}

export async function syncSettlementToWebull(
  trade: ITrade,
  user: IUser,
  sellContracts: number,
  _sellPrice: number
): Promise<void> {
  const creds = getCredentials(user);
  if (!creds) {
    // If user doesn't have Webull credentials, skip sync (optional feature)
    return;
  }
  
  // Get account_id from subscriptions
  const subs = await getWebullSubscriptions(user);
  if (!subs.ok || !subs.data || subs.data.length === 0) {
    throw new Error('Webull sync failed: No subscriptions found');
  }
  
  const accountId = creds.accountId || subs.data[0].account_id;
  if (!accountId) {
    throw new Error('Webull sync failed: No account_id available');
  }
  
  // Place SELL options order: qty = sellContracts capped at 5
  const qty = Math.max(1, Math.min(5, sellContracts));
  const result = await placeWebullOptionOrder(creds, accountId, trade, 'SELL', qty);
  
  if (!result.ok) {
    throw new Error(`Webull sync failed: ${result.error}`);
  }
  
  const optionLabel = `${trade.ticker} ${trade.strike}${trade.optionType === 'C' ? 'C' : 'P'}`;
  console.log(`[webull] Placed SELL options order: ${result.client_order_id} for ${qty} contracts of ${optionLabel}`);
}

