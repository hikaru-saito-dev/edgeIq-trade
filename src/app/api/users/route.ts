import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { User } from '@/models/User';
import { z } from 'zod';
import { PipelineStage } from 'mongoose';

export const runtime = 'nodejs';

const updateRoleSchema = z.object({
  userId: z.string(),
  role: z.enum(['companyOwner', 'owner', 'admin', 'member']),
});

/**
 * GET /api/users
 * List all users in the company (owner only) with pagination and search
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const headers = await import('next/headers').then(m => m.headers());
    
    // Read userId and companyId from headers (set by client from context)
    const userId = headers.get('x-user-id');
    const companyId = headers.get('x-company-id');  
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find current user by whopUserId (companyId is manually entered, not from Whop auth)
    const currentUser = await User.findOne({ whopUserId: userId, companyId: companyId });
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is companyOwner or owner
    if (currentUser.role !== 'companyOwner' && currentUser.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden: Only company owners and owners can view users' }, { status: 403 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10)));
    const search = (searchParams.get('search') || '').trim();

    const skip = (page - 1) * pageSize;
    const baseMatch: Record<string, unknown> = {
      companyId,
    };


    const pipeline: PipelineStage[] = [
      { $match: baseMatch },
    ];

    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      pipeline.push({
        $match: {
          $or: [
            { alias: regex },
            { whopUsername: regex },
            { whopDisplayName: regex },
          ],
        },
      });
    }

    pipeline.push(
      {
        $addFields: {
          rolePriority: {
            $switch: {
              branches: [
                { case: { $eq: ['$role', 'companyOwner'] }, then: 0 },
                { case: { $eq: ['$role', 'owner'] }, then: 1 },
                { case: { $eq: ['$role', 'admin'] }, then: 2 },
                { case: { $eq: ['$role', 'member'] }, then: 3 },
              ],
              default: 99,
            },
          },
        },
      },
      { $sort: { rolePriority: 1, createdAt: -1, _id: 1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: pageSize },
            {
              $project: {
                whopUserId: 1,
                alias: 1,
                role: 1,
                whopUsername: 1,
                whopDisplayName: 1,
                whopAvatarUrl: 1,
                createdAt: 1,
              },
            },
          ],
          totalCount: [{ $count: 'count' }],
        },
      },
      {
        $project: {
          users: '$data',
          totalCount: { $ifNull: [{ $arrayElemAt: ['$totalCount.count', 0] }, 0] },
        },
      },
    );

    const aggregated = await User.aggregate(pipeline).allowDiskUse(true);
    const result = aggregated[0] || { users: [], totalCount: 0 };

    const totalPages = Math.max(1, Math.ceil((result.totalCount || 0) / pageSize));

    return NextResponse.json({ 
      users: result.users,
      totalPages,
      totalCount: result.totalCount,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/users
 * Update user role (owner only)
 */
export async function PATCH(request: NextRequest) {
  try {
    await connectDB();
    const headers = await import('next/headers').then(m => m.headers());
    
    // Read userId and companyId from headers (set by client from context)
    const currentUserId = headers.get('x-user-id');
    const companyId = headers.get('x-company-id');
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find current user by whopUserId (companyId is manually entered, not from Whop auth)
    const currentUser = await User.findOne({ whopUserId: currentUserId, companyId: companyId });
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is companyOwner or owner
    if (currentUser.role !== 'companyOwner' && currentUser.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden: Only company owners and owners can update roles' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, role } = updateRoleSchema.parse(body);

    if (userId === currentUserId) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
    }

    // Find target user - must be in same company
    const targetUser = await User.findOne({
      whopUserId: userId,
      companyId: companyId, // Must be in same company
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent role changes based on permissions
    const newRole = role as 'companyOwner' | 'owner' | 'admin' | 'member';
    
    // CompanyOwner cannot grant companyOwner role
    if (newRole === 'companyOwner') {
      return NextResponse.json({ error: 'Cannot grant company owner role' }, { status: 400 });
    }
    
    // CompanyOwner cannot remove companyOwner role from themselves or others
    // Check if target is companyOwner and we're trying to change their role
    if (targetUser.role === 'companyOwner') {
      // Since we already checked newRole !== 'companyOwner' above, we know it's being changed
      return NextResponse.json({ error: 'Cannot remove company owner role' }, { status: 400 });
    }
    
    // Owner cannot manage companyOwner or other owners
    if (currentUser.role === 'owner') {
      if (targetUser.role === 'companyOwner' || targetUser.role === 'owner') {
        return NextResponse.json({ error: 'Cannot manage company owner or owner roles' }, { status: 403 });
      }
      // Owner cannot grant owner role
      if (newRole === 'owner') {
        return NextResponse.json({ error: 'Cannot grant owner role' }, { status: 403 });
      }
    }

    // CompanyId is already set from Whop, no need to assign manually

    targetUser.role = newRole;
    await targetUser.save();

    return NextResponse.json({ 
      success: true, 
      user: {
        whopUserId: targetUser.whopUserId,
        alias: targetUser.alias,
        role: targetUser.role,
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to update user role' },
      { status: 500 }
    );
  }
}

