// scripts/test-massive.js

// Optional: try to load POLYGON_API_KEY from .env.local if dotenv is installed
try {
    require('dotenv').config({ path: '.env.local' });
  } catch (e) {
    // ignore if dotenv is not installed; POLYGON_API_KEY must be in env
  }
  
  const POLYGON_API_KEY = process.env.POLYGON_API_KEY;
  const POLYGON_BASE_URL = 'https://api.massive.com';
  
  if (!POLYGON_API_KEY) {
    console.error('POLYGON_API_KEY is not set. Set it in .env.local or your shell and try again.');
    process.exit(1);
  }
  
  // Same pricing logic as src/lib/polygon.ts
  function getMarketFillPrice(snapshot) {
    if (snapshot.last_trade && snapshot.last_trade.price != null) {
      return snapshot.last_trade.price;
    }
  
    if (snapshot.last_quote && snapshot.last_quote.midpoint != null) {
      return snapshot.last_quote.midpoint;
    }
  
    if (
      snapshot.last_quote &&
      snapshot.last_quote.bid != null &&
      snapshot.last_quote.ask != null
    ) {
      return (snapshot.last_quote.bid + snapshot.last_quote.ask) / 2;
    }
  
    if (snapshot.day && snapshot.day.close != null) {
      return snapshot.day.close;
    }
  
    if (snapshot.session && snapshot.session.close != null) {
      return snapshot.session.close;
    }
  
    return null;
  }
  
  async function getOptionContractSnapshot(underlying, strike, expiry, contractType) {
    const url =
      `${POLYGON_BASE_URL}/v3/snapshot/options/${underlying.toUpperCase()}` +
      `?contract_type=${contractType}&strike_price=${strike}&expiration_date=${expiry}` +
      `&apiKey=${POLYGON_API_KEY}`;
  
    console.log('Request URL:', url);
  
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
  
    if (!res.ok) {
      console.error('HTTP error:', res.status, res.statusText, data);
      return null;
    }
  
    if (!data.results) {
      console.error('No results in response:', data);
      return null;
    }
  
    const resultsArray = Array.isArray(data.results) ? data.results : [data.results];
    if (!resultsArray.length) {
      console.error('Empty results array');
      return null;
    }
  
    // Try exact match, then fall back to first
    const exact = resultsArray.find((c) => {
      const d = c.details || {};
      return (
        d.strike_price === strike &&
        d.expiration_date === expiry &&
        d.contract_type === contractType
      );
    });
  
    return exact || resultsArray[0];
  }
  
  async function main() {
    // TODO: put the contract you want to test here
    const ticker = 'TSLA';           // e.g. TSLA
    const strike = 420;              // number
    const expiry = '2025-11-28';     // YYYY-MM-DD
    const contractType = 'put';      // 'call' or 'put'
  
    console.log('Testing Massive snapshot for:', { ticker, strike, expiry, contractType });
  
    const snapshot = await getOptionContractSnapshot(ticker, strike, expiry, contractType);
    if (!snapshot) {
      console.error('No snapshot returned.');
      return;
    }
  
    const price = getMarketFillPrice(snapshot);
  
    console.log('\n=== Snapshot fields (trimmed) ===');
    console.dir(
      {
        day: snapshot.day,
        last_quote: snapshot.last_quote,
        last_trade: snapshot.last_trade,
      },
      { depth: null }
    );
  
    console.log('\n=== Derived market fill price (same logic as app) ===');
    console.log('marketFillPrice =', price);
  }
  
  main().catch((err) => {
    console.error('Error running test:', err);
  });