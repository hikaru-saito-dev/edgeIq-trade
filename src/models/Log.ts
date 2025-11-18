import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ILog extends Document {
  userId: Types.ObjectId;
  tradeId?: Types.ObjectId; // Reference to Trade (replaces betId)
  action: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

const LogSchema = new Schema<ILog>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tradeId: { type: Schema.Types.ObjectId, ref: 'Trade', index: true },
  action: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, {
  timestamps: true,
});

// Index for efficient queries
LogSchema.index({ userId: 1, timestamp: -1 });
LogSchema.index({ tradeId: 1, timestamp: -1 });

export const Log = (mongoose.models && mongoose.models.Log) || mongoose.model<ILog>('Log', LogSchema);

