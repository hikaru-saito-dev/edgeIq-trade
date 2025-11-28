import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { User } from '@/models/User';
import { z } from 'zod';

export const runtime = 'nodejs';

const transferOwnershipSchema = z.object({
  newOwnerUserId: z.string(),
});

/**
 * POST /api/users/transfer-ownership
 * Transfer company ownership from current companyOwner to another user
 * Only companyOwner can transfer ownership
 * Current owner becomes 'owner' role after transfer
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const headers = await import('next/headers').then(m => m.headers());
    
    // Read userId and companyId from headers
    const currentUserId = headers.get('x-user-id');
    const companyId = headers.get('x-company-id');
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find current user
    const currentUser = await User.findOne({ whopUserId: currentUserId, companyId: companyId });
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only companyOwner can transfer ownership
    if (currentUser.role !== 'companyOwner') {
      return NextResponse.json({ 
        error: 'Forbidden: Only company owner can transfer ownership' 
      }, { status: 403 });
    }

    const body = await request.json();
    const { newOwnerUserId } = transferOwnershipSchema.parse(body);

    if (newOwnerUserId === currentUserId) {
      return NextResponse.json({ 
        error: 'Cannot transfer ownership to yourself' 
      }, { status: 400 });
    }

    // Find target user - must be in same company
    const newOwner = await User.findOne({
      whopUserId: newOwnerUserId,
      companyId: companyId,
    });

    if (!newOwner) {
      return NextResponse.json({ 
        error: 'Target user not found in your company' 
      }, { status: 404 });
    }

    // Transfer ownership: 
    // 1. New owner becomes companyOwner
    // 2. Current owner becomes 'owner' (loses companyOwner role but keeps owner privileges)
    // Use MongoDB session for atomic transaction
    const session = await User.startSession();
    try {
      await session.withTransaction(async () => {
        newOwner.role = 'companyOwner';
        currentUser.role = 'owner';
        
        await Promise.all([
          newOwner.save({ session }),
          currentUser.save({ session }),
        ]);
      });
    } finally {
      await session.endSession();
    }

    return NextResponse.json({ 
      success: true,
      message: 'Company ownership transferred successfully',
      newOwner: {
        whopUserId: newOwner.whopUserId,
        alias: newOwner.alias,
        role: newOwner.role,
      },
      previousOwner: {
        whopUserId: currentUser.whopUserId,
        alias: currentUser.alias,
        role: currentUser.role,
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request data', 
        details: error.errors 
      }, { status: 400 });
    }
    console.error('Error transferring ownership:', error);
    return NextResponse.json(
      { error: 'Failed to transfer ownership' },
      { status: 500 }
    );
  }
}

