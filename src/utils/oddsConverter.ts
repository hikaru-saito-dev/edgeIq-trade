/**
 * Odds Conversion Utilities
 * Supports American (-/+ format) and Decimal format
 */

export type OddsFormat = 'american' | 'decimal';

export interface OddsValue {
  format: OddsFormat;
  value: number; // American: -150 or +180, Decimal: 2.0 or 1.5
}

/**
 * Convert American odds to Decimal
 * -150 → 1.667, +180 → 2.8
 */
export function americanToDecimal(american: number): number {
  if (american > 0) {
    // Positive odds: +180 → (180/100) + 1 = 2.8
    return (american / 100) + 1;
  } else {
    // Negative odds: -150 → (100/150) + 1 = 1.667
    return (100 / Math.abs(american)) + 1;
  }
}

/**
 * Convert Decimal odds to American
 * 2.0 → +100, 1.5 → -200, 2.8 → +180
 */
export function decimalToAmerican(decimal: number): number {
  if (decimal >= 2.0) {
    // Decimal >= 2.0 → Positive American odds
    return (decimal - 1) * 100;
  } else {
    // Decimal < 2.0 → Negative American odds
    return -100 / (decimal - 1);
  }
}

/**
 * Calculate profit per 1.0 unit risked for a WIN
 * Returns profit in units (not ROI%)
 */
export function calculateProfitPerUnit(odds: OddsValue): number {
  if (odds.format === 'decimal') {
    // Decimal: Profit = (decimal - 1.0) units
    return odds.value - 1.0;
  } else {
    // American
    if (odds.value > 0) {
      // Positive: +180 → profit = 180/100 = 1.8 units
      return odds.value / 100;
    } else {
      // Negative: -150 → profit = 100/150 = 0.667 units
      return 100 / Math.abs(odds.value);
    }
  }
}

/**
 * Calculate ROI% for a single bet win
 * ROI% = (Profit per unit / 1 unit risked) × 100
 */
export function calculateSingleBetROI(odds: OddsValue): number {
  const profit = calculateProfitPerUnit(odds);
  return profit * 100; // Already per 1 unit, so multiply by 100 for %
}

/**
 * Calculate total return (stake + profit) for a win
 */
export function calculateTotalReturn(odds: OddsValue, units: number): number {
  if (odds.format === 'decimal') {
    return units * odds.value;
  } else {
    const profit = calculateProfitPerUnit(odds) * units;
    return units + profit;
  }
}

/**
 * Normalize odds to decimal format for storage
 * Always store as decimal in database for consistency
 */
export function normalizeToDecimal(odds: OddsValue): number {
  if (odds.format === 'decimal') {
    return odds.value;
  }
  return americanToDecimal(odds.value);
}

/**
 * Format odds for display
 */
export function formatOdds(odds: number, format: OddsFormat): string {
  if (format === 'decimal') {
    return odds.toFixed(2);
  } else {
    const american = decimalToAmerican(odds);
    return american > 0 ? `+${Math.round(american)}` : `${Math.round(american)}`;
  }
}

/**
 * Validate odds value based on format
 */
export function validateOdds(odds: OddsValue): { valid: boolean; error?: string } {
  if (odds.format === 'decimal') {
    if (odds.value < 1.01) {
      return { valid: false, error: 'Decimal odds must be at least 1.01' };
    }
    if (odds.value > 1000) {
      return { valid: false, error: 'Decimal odds too high (max 1000)' };
    }
  } else {
    // American odds
    if (odds.value > 0 && odds.value < 100) {
      return { valid: false, error: 'American odds must be at least +100' };
    }
    if (odds.value < 0 && Math.abs(odds.value) < 100) {
      return { valid: false, error: 'American odds must be at most -100' };
    }
    // Convert to decimal to check reasonable range
    const decimal = americanToDecimal(odds.value);
    if (decimal > 1000) {
      return { valid: false, error: 'Odds too high' };
    }
  }
  return { valid: true };
}

