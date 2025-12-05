import mongoose, { Schema, Document, Types } from 'mongoose';

export type TradeSide = 'BUY' | 'SELL';
export type TradeStatus = 'OPEN' | 'CLOSED' | 'REJECTED';
export type TradeOutcome = 'WIN' | 'LOSS' | 'BREAKEVEN';
export type OptionType = 'C' | 'P' | 'CALL' | 'PUT';

export interface ITrade extends Document {
  userId: Types.ObjectId;
  whopUserId: string; // Whop user ID for person-level tracking across companies
  side: TradeSide; // BUY for creation, SELL for settlement fills
  contracts: number; // Number of contracts
  ticker: string; // Underlying ticker (e.g., "AAPL")
  strike: number; // Strike price
  optionType: 'C' | 'P'; // C for CALL, P for PUT
  expiryDate: Date; // Expiration date
  fillPrice: number; // Price per contract
  status: TradeStatus; // OPEN, CLOSED, or REJECTED
  priceVerified: boolean; // Whether price passed ±5% verification
  optionContract?: string; // Massive.com option contract ticker (e.g., "O:AAPL250117C00200000")
  refPrice?: number; // Reference price from Massive.com API at time of fill
  refTimestamp?: Date; // Timestamp when ref price was fetched
  remainingOpenContracts: number; // Remaining contracts after partial sells
  outcome?: TradeOutcome; // WIN, LOSS, or BREAKEVEN (only for CLOSED trades)
  netPnl?: number; // Net P&L in dollars (only for CLOSED trades)
  totalBuyNotional?: number; // Total buy notional (contracts * fill_price * 100)
  totalSellNotional?: number; // Total sell notional (sum of all SELL fills)
  isMarketOrder?: boolean; // Whether this was a market order (always true now)
  selectedWebhookIds?: string[]; // IDs of all selected webhooks for notifications
  createdAt: Date;
  updatedAt: Date;
}

const TradeSchema = new Schema<ITrade>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  whopUserId: { type: String, required: true, index: true },
  side: { type: String, enum: ['BUY', 'SELL'], required: true, index: true },
  contracts: { type: Number, required: true, min: 1 },
  ticker: { type: String, required: true, trim: true, uppercase: true, index: true },
  strike: { type: Number, required: true, min: 0 },
  optionType: { type: String, enum: ['C', 'P'], required: true },
  expiryDate: { type: Date, required: true, index: true },
  fillPrice: { type: Number, required: true, min: 0 },
  status: { 
    type: String, 
    enum: ['OPEN', 'CLOSED', 'REJECTED'], 
    default: 'OPEN',
    index: true
  },
  priceVerified: { type: Boolean, default: false, index: true },
  optionContract: { type: String, trim: true },
  refPrice: { type: Number },
  refTimestamp: { type: Date },
  remainingOpenContracts: { type: Number, required: true, min: 0 },
  outcome: { type: String, enum: ['WIN', 'LOSS', 'BREAKEVEN'] },
  netPnl: { type: Number },
  totalBuyNotional: { type: Number },
  totalSellNotional: { type: Number },
  isMarketOrder: { type: Boolean, default: true }, // Always true - market orders only
  selectedWebhookIds: {
    type: [String],
    default: undefined,
  },
}, {
  timestamps: true,
});

// Compound indexes for efficient queries
TradeSchema.index({ userId: 1, createdAt: -1 });
TradeSchema.index({ userId: 1, status: 1 });
TradeSchema.index({ ticker: 1, strike: 1, optionType: 1, expiryDate: 1 });
TradeSchema.index({ status: 1, priceVerified: 1 }); // For leaderboard filtering
TradeSchema.index({ whopUserId: 1, createdAt: -1 });
TradeSchema.index({ whopUserId: 1, status: 1 });
TradeSchema.index({ whopUserId: 1, status: 1, createdAt: -1 }); // For cross-company stats aggregation

export const Trade = (mongoose.models && mongoose.models.Trade) || mongoose.model<ITrade>('Trade', TradeSchema);

