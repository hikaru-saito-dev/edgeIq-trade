import { z } from 'zod';

/**
 * Validation schemas for trade creation and settlement
 */

// Option type enum
export const optionTypeSchema = z.enum(['C', 'P', 'CALL', 'PUT']).transform((val) => {
  // Normalize to C or P
  if (val === 'CALL' || val === 'C') return 'C';
  if (val === 'PUT' || val === 'P') return 'P';
  return val;
});

// Date string in MM/DD/YYYY format
const dateStringSchema = z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, {
  message: 'Expiration date must be in MM/DD/YYYY format',
});

/**
 * Schema for creating a new BUY trade
 * All trades must use market orders (fill price determined automatically)
 */
export const createTradeSchema = z.object({
  contracts: z
    .number()
    .int()
    .positive('Number of contracts must be greater than 0')
    .max(5, 'A maximum of 5 contracts can be submitted per trade'),
  ticker: z.string().min(1).max(10).regex(/^[A-Z]+$/, {
    message: 'Ticker must be alphabetic (e.g., "AAPL")',
  }).transform((val) => val.toUpperCase()),
  strike: z.number().positive('Strike price must be greater than 0'),
  optionType: optionTypeSchema,
  expiryDate: dateStringSchema,
  marketOrder: z.boolean().default(true), // Always true - market orders only
});

export type CreateTradeInput = z.infer<typeof createTradeSchema>;

/**
 * Schema for settling a trade (SELL/scale-out)
 * All settlements must use market orders (fill price determined automatically)
 */
export const settleTradeSchema = z.object({
  tradeId: z.string().min(1, 'Trade ID is required'),
  contracts: z.number().int().positive('Number of contracts must be greater than 0'),
  marketOrder: z.boolean().default(true), // Always true - market orders only
});

export type SettleTradeInput = z.infer<typeof settleTradeSchema>;

/**
 * Parse MM/DD/YYYY date string to Date object
 */
export function parseExpiryDate(dateString: string): Date {
  const [month, day, year] = dateString.split('/').map(Number);
  // Store normalized to UTC midnight to avoid timezone shifts
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Format Date to MM/DD/YYYY string (uses UTC components)
 */
export function formatExpiryDate(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${month}/${day}/${year}`;
}

