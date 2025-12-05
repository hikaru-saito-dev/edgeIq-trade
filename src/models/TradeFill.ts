import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITradeFill extends Document {
  tradeId: Types.ObjectId; // Reference to parent Trade
  side: 'SELL'; // Always SELL for fills
  contracts: number; // Number of contracts sold
  fillPrice: number; // Price per contract
  priceVerified: boolean; // Whether price passed ±5% verification
  refPrice?: number; // Reference price from Massive.com API
  refTimestamp?: Date; // Timestamp when ref price was fetched
  notional: number; // contracts * fill_price * 100
  isMarketOrder?: boolean; // Whether this was a market order (always true now)
  createdAt: Date;
  updatedAt: Date;
}

const TradeFillSchema = new Schema<ITradeFill>({
  tradeId: { type: Schema.Types.ObjectId, ref: 'Trade', required: true, index: true },
  side: { type: String, enum: ['SELL'], required: true },
  contracts: { type: Number, required: true, min: 1 },
  fillPrice: { type: Number, required: true, min: 0 },
  priceVerified: { type: Boolean, default: false, index: true },
  refPrice: { type: Number },
  refTimestamp: { type: Date },
  notional: { type: Number, required: true }, // contracts * fill_price * 100
  isMarketOrder: { type: Boolean, default: true }, // Always true - market orders only
}, {
  timestamps: true,
});

// Index for efficient queries
TradeFillSchema.index({ tradeId: 1, createdAt: -1 });

export const TradeFill = (mongoose.models && mongoose.models.TradeFill) || mongoose.model<ITradeFill>('TradeFill', TradeFillSchema);

