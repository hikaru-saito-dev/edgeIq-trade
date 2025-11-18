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
 */
export const createTradeSchema = z.object({
  contracts: z.number().int().positive('Number of contracts must be greater than 0'),
  ticker: z.string().min(1).max(10).regex(/^[A-Z]+$/, {
    message: 'Ticker must be alphabetic (e.g., "AAPL")',
  }).transform((val) => val.toUpperCase()),
  strike: z.number().positive('Strike price must be greater than 0'),
  optionType: optionTypeSchema,
  expiryDate: dateStringSchema,
  fillPrice: z.number().positive('Fill price must be greater than 0'),
});

export type CreateTradeInput = z.infer<typeof createTradeSchema>;

/**
 * Schema for settling a trade (SELL/scale-out)
 */
export const settleTradeSchema = z.object({
  tradeId: z.string().min(1, 'Trade ID is required'),
  contracts: z.number().int().positive('Number of contracts must be greater than 0'),
  fillPrice: z.number().positive('Fill price must be greater than 0'),
});

export type SettleTradeInput = z.infer<typeof settleTradeSchema>;

/**
 * Parse MM/DD/YYYY date string to Date object
 */
export function parseExpiryDate(dateString: string): Date {
  const [month, day, year] = dateString.split('/').map(Number);
  // Month is 0-indexed in Date constructor
  return new Date(year, month - 1, day);
}

/**
 * Format Date to MM/DD/YYYY string
 */
export function formatExpiryDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

