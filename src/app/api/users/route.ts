import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { User } from '@/models/User';
import { z } from 'zod';

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

    // Build query based on role:
    // - companyOwner: can see users in their company
    // - owner: can see users in their company (but not companyOwner or other owners)
    const query: Record<string, unknown> = {};
    
    if (currentUser.role === 'companyOwner') {
      // CompanyOwner can see all users in their company
      query.companyId = companyId;
    } else if (currentUser.role === 'owner') {
      // Owner can see users in their company, but exclude companyOwner and other owners
      query.companyId = companyId;
    }

    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const searchConditions = [
        { alias: regex },
        { whopUsername: regex },
        { whopDisplayName: regex },
      ];
      
      // Combine search with existing $or if it exists
      if (query.$or) {
        // If we already have $or (from owner role filter), combine with AND logic
        query.$and = [
          { $or: query.$or },
          { $or: searchConditions },
        ];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    // Get total count for pagination
    const totalCount = await User.countDocuments(query);

    // Fetch users with pagination
    const users = await User.find(query)
      .select('whopUserId alias role whopUsername whopDisplayName whopAvatarUrl createdAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    return NextResponse.json({ 
      users,
      totalPages,
      totalCount,
      page,
      pageSize,
    });
  } catch {
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

