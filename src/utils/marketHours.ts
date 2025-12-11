/**
 * Market hours utility for US equity options trading
 * Market hours: 09:30 - 16:30 EST (Eastern Standard Time)
 * Note: EST is UTC-5, EDT (daylight saving) is UTC-4
 */

/**
 * Convert UTC timestamp to EST/EDT
 * @param utcTimestamp - UTC Date object
 * @returns Date object representing EST/EDT time
 */
export function convertToEST(utcTimestamp: Date): Date {
  // Use Intl.DateTimeFormat to get EST/EDT time components
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(utcTimestamp);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1; // 0-indexed
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0');

  // Create a date in UTC that represents the EST/EDT time
  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

/**
 * Check if market is currently open (09:30 - 16:30 EST)
 * @param timestamp - Optional timestamp to check (defaults to now)
 * @returns true if market is open, false otherwise
 * 
 * NOTE: Set DISABLE_MARKET_HOURS_CHECK=true in .env.local to bypass market hours for testing
 */
export function isMarketOpen(timestamp?: Date): boolean {
  const checkTime = timestamp || new Date();
  
  // Get EST/EDT time components using Intl API
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    //weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(checkTime);
  const weekday = parts.find(p => p.type === 'weekday')?.value || '';
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  
  if (weekday === 'Sat' || weekday === 'Sun') {
    return false;
  }

  // Market hours: 09:30 - 16:30 EST
  const marketOpenHour = 9;
  const marketOpenMinute = 30;
  const marketCloseHour = 16;
  const marketCloseMinute = 30;
  
  // Check if before market open
  if (hour < marketOpenHour || (hour === marketOpenHour && minute < marketOpenMinute)) {
    return false;
  }
  
  // Check if after market close
  if (hour > marketCloseHour || (hour === marketCloseHour && minute >= marketCloseMinute)) {
    return false;
  }
  
  return true;
}

/**
 * Get market status message
 * @returns User-friendly message about market status
 */
export function getMarketStatusMessage(): string {
  const now = new Date();
  
  if (isMarketOpen(now)) {
    // Calculate minutes until close (16:30 EST)
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    
    const currentMinutes = hour * 60 + minute;
    const closeMinutes = 16 * 60 + 30; // 16:30
    const minutesUntilClose = closeMinutes - currentMinutes;
    
    return `Market is open. Closes in ${minutesUntilClose} minutes.`;
  }
  
  // Get weekday to check if weekend
  const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
  });
  const weekday = weekdayFormatter.format(now);
  
  if (weekday === 'Sat' || weekday === 'Sun') {
    return 'Market is closed (weekend). Trades can only be created/settled between 09:30–16:30 EST on weekdays.';
  }
  
  // Before or after market hours
  return 'Market is closed. Trades can only be created/settled between 09:30–16:30 EST.';
}

/**
 * Get formatted market hours string
 */
export function getMarketHoursString(): string {
  return '09:30–16:30 EST';
}

