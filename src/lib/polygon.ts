/**
 * Massive.com (formerly Polygon.io) Options API Integration
 * Used for price verification of options trades
 * Note: Polygon.io rebranded to Massive.com in October 2025
 * API endpoints continue to work, but using new domain for future compatibility
 */

const POLYGON_API_KEY = process.env.POLYGON_API_KEY;
const POLYGON_BASE_URL = 'https://api.massive.com'; // Updated from api.polygon.io

export interface OptionContractSnapshot {
  // Contract details (always in details object based on actual API responses)
  details?: {
    ticker?: string; // e.g., "O:AAPL230616C00150000"
    contract_type?: 'call' | 'put';
    exercise_style?: string;
    expiration_date?: string; // YYYY-MM-DD
    shares_per_contract?: number;
    strike_price?: number;
  };
  // Contract ticker at root level (alternative)
  ticker?: string; // Contract ticker
  // Daily price data (primary format)
  day?: {
    close?: number;
    open?: number;
    high?: number;
    low?: number;
    volume?: number;
    vwap?: number;
    last_updated?: number | string;
    change?: number;
    change_percent?: number;
    previous_close?: number;
  };
  // Session data (alternative to day, used in some responses)
  session?: {
    close?: number;
    open?: number;
    high?: number;
    low?: number;
    volume?: number;
    change?: number;
    change_percent?: number;
    previous_close?: number;
    regular_trading_change?: number;
    regular_trading_change_percent?: number;
    early_trading_change?: number;
    early_trading_change_percent?: number;
    late_trading_change?: number;
    late_trading_change_percent?: number;
  };
  // Quote data
  last_quote?: {
    bid?: number;
    ask?: number;
    bid_size?: number;
    ask_size?: number;
    bid_exchange?: number;
    ask_exchange?: number;
    midpoint?: number;
    last?: number;
    last_updated?: number | string;
    timeframe?: string;
  };
  // Trade data
  last_trade?: {
    price?: number;
    size?: number;
    sip_timestamp?: number;
    timestamp?: number;
    last_updated?: number | string;
    exchange?: number;
    conditions?: number[];
    timeframe?: string;
  };
  // Additional fields
  underlying_asset?: {
    ticker?: string;
    price?: number;
    change_to_break_even?: number;
    last_updated?: number | string;
    timeframe?: string;
  };
  break_even_price?: number;
  implied_volatility?: number;
  open_interest?: number;
  greeks?: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
  };
  fmv?: number;
  fmv_last_updated?: number;
  name?: string;
  market_status?: string;
  type?: string;
}

export interface OptionChainResponse {
  // Results can be either a single object or an array
  results?: OptionContractSnapshot | OptionContractSnapshot[];
  status?: string;
  request_id?: string;
  error?: string;
  message?: string;
  next_url?: string;
}

export interface OptionContractError {
  type: 'not_found' | 'invalid_input' | 'api_error' | 'network_error' | 'auth_error' | 'unknown';
  message: string;
  details?: string;
}


/**
 * Get option contract snapshot from Massive.com API
 * @param underlyingAsset - Base ticker (e.g., "AAPL")
 * @param strike - Strike price
 * @param expiryDate - Expiration date (YYYY-MM-DD format)
 * @param contractType - "call" or "put"
 * @returns Object with snapshot or error details
 */
export async function getOptionContractSnapshot(
  underlyingAsset: string,
  strike: number,
  expiryDate: string, // YYYY-MM-DD
  contractType: 'call' | 'put'
): Promise<{ snapshot: OptionContractSnapshot | null; error: OptionContractError | null }> {
  if (!POLYGON_API_KEY) {
    return {
      snapshot: null,
      error: {
        type: 'api_error',
        message: 'API key not configured',
        details: 'POLYGON_API_KEY environment variable is missing',
      },
    };
  }

  try {
    // Use Option Chain Snapshot endpoint
    // GET /v3/snapshot/options/{underlyingAsset}
    // Query parameters: contract_type, strike_price, expiration_date
    // Reference: https://massive.com/docs/
    const url = `${POLYGON_BASE_URL}/v3/snapshot/options/${underlyingAsset.toUpperCase()}?contract_type=${contractType}&strike_price=${strike}&expiration_date=${expiryDate}&apiKey=${POLYGON_API_KEY}`;
    
    const response = await fetch(url, {
      next: { revalidate: 0 }, // Don't cache, always fetch fresh data
    });

    // Handle HTTP errors (network, server errors)
    if (!response.ok) {
      let errorData: OptionChainResponse | null = null;
      try {
        const errorText = await response.text();
        errorData = JSON.parse(errorText);
      } catch {
        // Not JSON, use HTTP status
      }

      // Check for authentication error (401)
      if (response.status === 401 || (errorData?.status === 'ERROR' && errorData?.error?.includes('Unknown API Key'))) {
        return {
          snapshot: null,
          error: {
            type: 'auth_error',
            message: 'API authentication failed',
            details: errorData?.error || 'Invalid API key',
          },
        };
      }

      // Check for API error response (400 Bad Request with ERROR status)
      if (response.status === 400 && errorData?.status === 'ERROR') {
        const errorMsg = errorData.error || errorData.message || 'Unknown API error';
        
        // Check for specific error types
        if (errorMsg.includes('expiration_date not formatted')) {
          return {
            snapshot: null,
            error: {
              type: 'invalid_input',
              message: 'Invalid expiration date format',
              details: errorMsg,
            },
          };
        }
        
        return {
          snapshot: null,
          error: {
            type: 'api_error',
            message: 'API returned an error',
            details: errorMsg,
          },
        };
      }

      // Generic HTTP error
      return {
        snapshot: null,
        error: {
          type: 'network_error',
          message: 'Unable to connect to market data service',
          details: `HTTP ${response.status} ${response.statusText}`,
        },
      };
    }

    const data: OptionChainResponse = await response.json();

    // Check for API errors in response (status: "ERROR")
    if (data.status === 'ERROR') {
      const errorMsg = data.error || data.message || 'Unknown API error';
      
      if (errorMsg.includes('Unknown API Key')) {
        return {
          snapshot: null,
          error: {
            type: 'auth_error',
            message: 'API authentication failed',
            details: errorMsg,
          },
        };
      }
      
      if (errorMsg.includes('expiration_date not formatted')) {
        return {
          snapshot: null,
          error: {
            type: 'invalid_input',
            message: 'Invalid expiration date format',
            details: errorMsg,
          },
        };
      }
      
      return {
        snapshot: null,
        error: {
          type: 'api_error',
          message: 'API returned an error',
          details: errorMsg,
        },
      };
    }
    
    // Ensure status is OK
    if (data.status !== 'OK' && data.status !== undefined) {
      return {
        snapshot: null,
        error: {
          type: 'api_error',
          message: 'Unexpected API response',
          details: `Status: ${data.status}`,
        },
      };
    }

    // Handle results - can be single object or array
    // Based on test: API returns status: "OK" with results: [] when contract not found
    if (!data.results) {
      return {
        snapshot: null,
        error: {
          type: 'not_found',
          message: `Option contract not found for ${underlyingAsset} ${strike} ${contractType.toUpperCase()} ${expiryDate}`,
          details: 'Please verify the ticker, strike price, expiry date, and option type are correct',
        },
      };
    }

    // Convert single object to array for consistent processing
    const resultsArray = Array.isArray(data.results) ? data.results : [data.results];

    // Based on test: API returns empty array [] when contract doesn't exist
    if (resultsArray.length === 0) {
      return {
        snapshot: null,
        error: {
          type: 'not_found',
          message: `Option contract not found for ${underlyingAsset} ${strike} ${contractType.toUpperCase()} ${expiryDate}`,
          details: 'Please verify the ticker, strike price, expiry date, and option type are correct',
        },
      };
    }

    // Find exact match if multiple results (should be rare with all params)
    const exactMatch = resultsArray.find((contract: OptionContractSnapshot) => {
      // Contract details are always in details object based on actual API responses
      const contractStrike = contract.details?.strike_price;
      const contractExpiry = contract.details?.expiration_date;
      const contractTypeValue = contract.details?.contract_type;
      
      return contractStrike === strike &&
             contractExpiry === expiryDate &&
             contractTypeValue === contractType;
    });

    // If no exact match found, return error
    if (!exactMatch && resultsArray.length > 0) {
      return {
        snapshot: null,
        error: {
          type: 'not_found',
          message: `Option contract not found for ${underlyingAsset} ${strike} ${contractType.toUpperCase()} ${expiryDate}`,
          details: 'No exact match found. Please verify the strike price, expiry date, and option type',
        },
      };
    }

    // Return exact match or first result
    return {
      snapshot: exactMatch || resultsArray[0],
      error: null,
    };
  } catch (error) {
    console.error('Error fetching option contract from Massive.com:', error);
    return {
      snapshot: null,
      error: {
        type: 'network_error',
        message: 'Network error while fetching market data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Get option contract by stored ticker (for SELL validation)
 * @param underlyingAsset - Base ticker (e.g., "AAPL")
 * @param optionContract - Stored option contract ticker (e.g., "O:AAPL250117C00200000")
 * @returns Option contract snapshot or null if not found
 */
export async function getContractByTicker(
  underlyingAsset: string,
  optionContract: string
): Promise<OptionContractSnapshot | null> {
  if (!POLYGON_API_KEY) {
    console.error('POLYGON_API_KEY not configured');
    return null;
  }

  try {
    // Use Contract Snapshot endpoint
    // GET /v3/snapshot/options/{underlyingAsset}/{optionContract}
    // Response format: { results: { ...contract data... } } or direct contract object
    const url = `${POLYGON_BASE_URL}/v3/snapshot/options/${underlyingAsset.toUpperCase()}/${optionContract}?apiKey=${POLYGON_API_KEY}`;
    
    const response = await fetch(url, {
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`Massive.com API error: ${response.status} ${response.statusText}`, errorText.substring(0, 200));
      return null;
    }

    const data = await response.json();
    
    // Handle response formats based on actual API responses:
    // Format 1: { results: { ...contract... }, status: "OK" } (single object in results)
    // Format 2: { results: [{ ...contract... }], status: "OK" } (array in results)
    // Format 3: { ...contract... } (direct contract object - less common)
    if (data.results) {
      if (Array.isArray(data.results)) {
        return data.results[0] || null;
      }
      // Single object in results (most common for specific contract lookup)
      return data.results;
    }
    
    // Direct contract object - check if it has contract-like structure
    // (This format is less common but possible)
    if (data.details && data.details.ticker) {
      return data;
    }
    
    console.warn('Unexpected Massive.com API response format:', JSON.stringify(data).substring(0, 200));
    return null;
  } catch (error) {
    console.error('Error fetching option contract by ticker from Massive.com:', error);
    return null;
  }
}

/**
 * Get reference price from option contract snapshot
 * Prefers day.close, falls back to last_trade.price, then last_quote mid
 * @param snapshot - Option contract snapshot from Massive.com API
 * @returns Reference price or null
 */
export function getReferencePrice(snapshot: OptionContractSnapshot): number | null {
  // Priority: day.close > session.close > last_trade.price > last_quote.midpoint > (last_quote.bid + last_quote.ask) / 2
  // Try day.close first (most common format)
  if (snapshot.day?.close !== undefined && snapshot.day.close !== null) {
    return snapshot.day.close;
  }
  
  // Try session.close (alternative format)
  if (snapshot.session?.close !== undefined && snapshot.session.close !== null) {
    return snapshot.session.close;
  }
  
  // Try last_trade.price
  if (snapshot.last_trade?.price !== undefined && snapshot.last_trade.price !== null) {
    return snapshot.last_trade.price;
  }
  
  // Use midpoint if available (most accurate quote price)
  if (snapshot.last_quote?.midpoint !== undefined && snapshot.last_quote.midpoint !== null) {
    return snapshot.last_quote.midpoint;
  }
  
  // Calculate midpoint from bid/ask as fallback
  if (snapshot.last_quote?.bid !== undefined && 
      snapshot.last_quote?.ask !== undefined &&
      snapshot.last_quote.bid !== null &&
      snapshot.last_quote.ask !== null) {
    return (snapshot.last_quote.bid + snapshot.last_quote.ask) / 2;
  }
  
  return null;
}

/**
 * Validate user-submitted fill price against Massive.com API reference price
 * @param underlyingAsset - Base ticker (e.g., "AAPL")
 * @param strike - Strike price
 * @param expiryDate - Expiration date (YYYY-MM-DD)
 * @param contractType - "call" or "put"
 * @param userFillPrice - User-submitted fill price
 * @param storedOptionContract - Optional: stored option contract ticker (for SELL validation)
 * @returns Object with validation result and reference data
 */
export function getMarketFillPrice(snapshot: OptionContractSnapshot): number | null {
  if (snapshot.last_trade?.price !== undefined && snapshot.last_trade?.price !== null) {
    return snapshot.last_trade.price;
  }

  if (snapshot.last_quote?.midpoint !== undefined && snapshot.last_quote?.midpoint !== null) {
    return snapshot.last_quote.midpoint;
  }

  if (
    snapshot.last_quote?.bid !== undefined &&
    snapshot.last_quote?.ask !== undefined &&
    snapshot.last_quote?.bid !== null &&
    snapshot.last_quote?.ask !== null
  ) {
    return (snapshot.last_quote.bid + snapshot.last_quote.ask) / 2;
  }

  if (snapshot.day?.close !== undefined && snapshot.day.close !== null) {
    return snapshot.day.close;
  }

  if (snapshot.session?.close !== undefined && snapshot.session.close !== null) {
    return snapshot.session.close;
  }

  return null;
}

export async function validateOptionPrice(
  underlyingAsset: string,
  strike: number,
  expiryDate: string, // YYYY-MM-DD
  contractType: 'call' | 'put',
  userFillPrice?: number,
  storedOptionContract?: string
): Promise<{
  isValid: boolean;
  refPrice: number | null;
  optionContract: string | null;
  refTimestamp: Date | null;
  error?: string;
}> {
  try {
    let snapshot: OptionContractSnapshot | null = null;

    // If we have a stored option contract, use it for faster lookup
    if (storedOptionContract) {
      snapshot = await getContractByTicker(underlyingAsset, storedOptionContract);
    }

    // Fallback to chain snapshot if contract lookup failed
    if (!snapshot) {
      const { snapshot: fetchedSnapshot } = await getOptionContractSnapshot(underlyingAsset, strike, expiryDate, contractType);
      snapshot = fetchedSnapshot;
    }

    if (!snapshot) {
      return {
        isValid: false,
        refPrice: null,
        optionContract: null,
        refTimestamp: null,
        error: 'Unable to validate option price at this time. Please try again.',
      };
    }

    const refPrice = getReferencePrice(snapshot);
    if (refPrice === null) {
      return {
        isValid: false,
        refPrice: null,
        optionContract: snapshot.details?.ticker || snapshot.ticker || null,
        refTimestamp: null,
        error: 'Unable to get reference price from market data.',
      };
    }

    // Calculate ±5% band
    const shouldValidateBand = typeof userFillPrice === 'number' && !Number.isNaN(userFillPrice);
    let isValid = true;

    if (shouldValidateBand) {
    const allowedLow = refPrice * 0.95;
    const allowedHigh = refPrice * 1.05;
      isValid = userFillPrice! >= allowedLow && userFillPrice! <= allowedHigh;
    }

    // Extract contract ticker - always in details object based on actual API responses
    const contractTicker = snapshot.details?.ticker || snapshot.ticker || null;

    return {
      isValid,
      refPrice,
      optionContract: contractTicker,
      refTimestamp: new Date(),
    };
  } catch (error) {
    console.error('Error validating option price:', error);
    return {
      isValid: false,
      refPrice: null,
      optionContract: null,
      refTimestamp: null,
      error: 'Unable to validate option price at this time. Please try again.',
    };
  }
}

/**
 * Format expiration date from MM/DD/YYYY to YYYY-MM-DD
 * @param dateString - Date string in MM/DD/YYYY format
 * @returns Date string in YYYY-MM-DD format
 */
export function formatExpiryDateForAPI(dateString: string): string {
  // Parse MM/DD/YYYY
  const [month, day, year] = dateString.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

