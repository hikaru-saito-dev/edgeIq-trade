import { NextRequest, NextResponse } from 'next/server';
import { verifyWhopUser, getWhopUser, getWhopCompany } from '@/lib/whop';
import connectDB from '@/lib/db';
import { User, IUser } from '@/models/User';

export const runtime = 'nodejs';

/**
 * Ensure user exists in database (create if doesn't exist)
 * companyId is auto-set from Whop headers
 * First user in each Whop becomes companyOwner
 */
async function ensureUserExists(userId: string, companyId?: string): Promise<'companyOwner' | 'owner' | 'admin' | 'member' | 'none'> {
  try {
    await connectDB();
    
    // Find user by whopUserId
    let user = await User.findOne({ whopUserId: userId, companyId: companyId });
    
    // Always try to fetch latest user data from Whop API
    let whopUserData = null;
    let whopCompanyData = null;
    try {
      whopUserData = await getWhopUser(userId);
      if (companyId) {
        whopCompanyData = await getWhopCompany(companyId);
      }
    } catch {
      // Continue even if Whop API calls fail
    }
    
    if (!user) {
      // Check if this is the first user in this company
      const isFirstUserInCompany = companyId 
        ? (await User.countDocuments({ companyId })) === 0
        : false;
      
      // Create user with companyId from Whop
      user = await User.create({
        whopUserId: userId,
        companyId: companyId || undefined, // Auto-set from Whop
        role: isFirstUserInCompany ? 'companyOwner' : 'member', // First user in Whop becomes companyOwner
        companyName: whopCompanyData?.name || undefined,
        alias: whopUserData?.name || whopUserData?.username || `User ${userId.slice(0, 8)}`,
        whopUsername: whopUserData?.username,
        whopDisplayName: whopUserData?.name,
        whopAvatarUrl: whopUserData?.profilePicture?.sourceUrl,
        optIn: false, // Default false, only owners can opt-in
        membershipPlans: [],
        stats: {
          winRate: 0,
          roi: 0,
          unitsPL: 0,
          currentStreak: 0,
          longestStreak: 0,
        },
      });
    } else {
      // Update companyId if it's not set and we have it from Whop
      if (companyId && !user.companyId) {
        user.companyId = companyId;
        // Check if this is the first user in this company
        const isFirstUserInCompany = (await User.countDocuments({ companyId, _id: { $ne: user._id } })) === 0;
        if (isFirstUserInCompany && user.role === 'member') {
          user.role = 'companyOwner';
        }
      }
      
      // Update company name/description from Whop if available
      if (companyId && whopCompanyData) {
        if (whopCompanyData.name && (!user.companyName || user.companyName !== whopCompanyData.name)) {
          user.companyName = whopCompanyData.name;
        }
      }
      
      // Update existing user with latest Whop data (especially avatar)
      const updates: {
        whopUsername?: string;
        whopDisplayName?: string;
        whopAvatarUrl?: string;
        whopName?: string;
      } = {};
      
      if (whopUserData) {
        if (whopUserData.username && whopUserData.username !== user.whopUsername) {
          updates.whopUsername = whopUserData.username;
        }
        if (whopUserData.name && whopUserData.name !== user.whopDisplayName) {
          updates.whopDisplayName = whopUserData.name;
        }
        // Always update avatar if available from Whop (even if currently null in DB)
        if (whopUserData.profilePicture?.sourceUrl) {
          if (whopUserData.profilePicture.sourceUrl !== user.whopAvatarUrl) {
            updates.whopAvatarUrl = whopUserData.profilePicture.sourceUrl;
          }
        }
      }
      
      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        Object.assign(user, updates);
        await user.save();
      }
    }
    
    return user.role || 'member';
  } catch (error) {
    console.error('Error ensuring user exists:', error);
    return 'none';
  }
}

export async function GET(request: NextRequest) {
  try {
    const headers = await import('next/headers').then(m => m.headers());
    const authInfo = await verifyWhopUser(headers, request.url);
    
    if (!authInfo) {
      return NextResponse.json({ role: 'none', isAuthorized: false }, { status: 401 });
    }

    const { userId, companyId } = authInfo;

    // Ensure user exists (companyId is auto-set from Whop)
    const role = await ensureUserExists(userId, companyId);
    
    // Get user to check if they have companyId set
    await connectDB();
    const user = await User.findOne({ whopUserId: userId, companyId: companyId });
    
    // Users are authorized if they're companyOwner/owner/admin/member (members can create trades and view profile)
    const isAuthorized = role === 'companyOwner' || role === 'owner' || role === 'admin' || role === 'member';

    // Get hideLeaderboardFromMembers setting from company owner
    let hideLeaderboardFromMembers = false;
    let hideCompanyStatsFromMembers = false;
    if (user?.companyId && (role === 'member' || role === 'admin')) {
      const companyOwner = await User.findOne({ 
        companyId: user.companyId, 
        role: 'companyOwner' 
      }).lean();
      if (companyOwner) {
        hideLeaderboardFromMembers = (companyOwner as unknown as IUser).hideLeaderboardFromMembers ?? false;
        hideCompanyStatsFromMembers = (companyOwner as unknown as IUser).hideCompanyStatsFromMembers ?? false;
      }
    }

    return NextResponse.json({ 
      role, 
      userId,
      companyId: user?.companyId || companyId || null,
      isAuthorized,
      hideLeaderboardFromMembers: role === 'member' ? hideLeaderboardFromMembers : undefined,
      hideCompanyStatsFromMembers: (role === 'member' || role === 'admin') ? hideCompanyStatsFromMembers : undefined
    });
  } catch {
    return NextResponse.json({ role: 'none', isAuthorized: false }, { status: 500 });
  }
}

