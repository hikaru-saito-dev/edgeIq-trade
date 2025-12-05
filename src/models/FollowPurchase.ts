import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IFollowPurchase extends Document {
  followerUserId: Types.ObjectId; // User who purchased the follow (MongoDB ID, for reference)
  capperUserId: Types.ObjectId; // Creator/company owner being followed (MongoDB ID, for reference)
  followerWhopUserId: string; // Whop user ID of follower (person-level tracking)
  capperWhopUserId: string; // Whop user ID of capper (person-level tracking)
  companyId: string; // Company ID (capper's company, for tracking/filtering follows by company)
  numPlaysPurchased: number; // Number of plays user paid for
  numPlaysConsumed: number; // Number of plays already delivered
  status: 'active' | 'completed'; // active = still has plays remaining, completed = all plays delivered
  planId: string; // Whop plan ID used for this purchase
  paymentId: string; // Whop payment ID (from webhook)
  createdAt: Date;
  updatedAt: Date;
}

const FollowPurchaseSchema = new Schema<IFollowPurchase>(
  {
    followerUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    capperUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    followerWhopUserId: {
      type: String,
      required: true,
      index: true,
    },
    capperWhopUserId: {
      type: String,
      required: true,
      index: true,
    },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
    numPlaysPurchased: {
      type: Number,
      required: true,
      min: 1,
    },
    numPlaysConsumed: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'completed'],
      required: true,
      default: 'active',
      index: true,
    },
    planId: {
      type: String,
      required: true,
      index: true,
    },
    paymentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
FollowPurchaseSchema.index({ followerUserId: 1, status: 1 }); // For fetching user's active follows
FollowPurchaseSchema.index({ capperUserId: 1, status: 1 }); // For tracking plays consumed
FollowPurchaseSchema.index({ followerWhopUserId: 1, status: 1 }); // For person-level duplicate checks
FollowPurchaseSchema.index({ capperWhopUserId: 1, status: 1 }); // For person-level play tracking
FollowPurchaseSchema.index({ companyId: 1, status: 1 }); // For company-scoped queries

export const FollowPurchase =
  (mongoose.models && mongoose.models.FollowPurchase) ||
  mongoose.model<IFollowPurchase>('FollowPurchase', FollowPurchaseSchema);

