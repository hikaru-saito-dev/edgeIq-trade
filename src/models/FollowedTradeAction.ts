import mongoose, { Schema, Document, Types } from 'mongoose';

export type FollowedTradeActionType = 'follow' | 'fade';

export interface IFollowedTradeAction extends Document {
  followerUserId: Types.ObjectId; // User who took the action (MongoDB ID, for reference)
  followerWhopUserId: string; // Whop user ID of the follower (person-level tracking)
  originalTradeId: Types.ObjectId; // The trade from the following feed that was acted upon
  action: FollowedTradeActionType; // 'follow' = trade was created, 'fade' = just marked as faded
  followedTradeId?: Types.ObjectId; // If action is 'follow', the new trade that was created for the follower
  createdAt: Date;
  updatedAt: Date;
}

const FollowedTradeActionSchema = new Schema<IFollowedTradeAction>({
  followerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  followerWhopUserId: { type: String, required: true, index: true },
  originalTradeId: { type: Schema.Types.ObjectId, ref: 'Trade', required: true, index: true },
  action: { type: String, enum: ['follow', 'fade'], required: true },
  followedTradeId: { type: Schema.Types.ObjectId, ref: 'Trade' }, // Only set if action is 'follow' - removed index: true to avoid duplicate
}, {
  timestamps: true,
});

// Compound indexes for efficient queries
FollowedTradeActionSchema.index({ followerWhopUserId: 1, originalTradeId: 1 }, { unique: true }); // One action per user per trade
FollowedTradeActionSchema.index({ originalTradeId: 1, action: 1 }); // For querying all actions on a trade
FollowedTradeActionSchema.index({ followedTradeId: 1 }); // For finding original trade from followed trade

export const FollowedTradeAction =
  (mongoose.models && mongoose.models.FollowedTradeAction) ||
  mongoose.model<IFollowedTradeAction>('FollowedTradeAction', FollowedTradeActionSchema);

