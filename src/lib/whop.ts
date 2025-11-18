import { WhopServerSdk } from '@whop/api';

/**
 * Whop SDK Type Definitions
 * Based on actual @whop/api v0.0.51 package structure
 */
type WhopSdkShape = {
  verifyUserToken: (
    tokenOrHeadersOrRequest: string | Headers | Request | null | undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    overrideOptions?: any
  ) => Promise<{ userId: string; appId: string }>;
  messages: {
    sendMessageToChat: (variables: {
      experienceId: string;
      message: string;
      attachments?: Array<{ directUploadId?: string; id?: string }>;
    }, options?: RequestInit) => Promise<{
      _error?: Error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      message?: any;
    }>;
  };
  experiences: {
    getExperience: (variables: { experienceId: string }, options?: RequestInit) => Promise<{
      _error?: Error;
      experience?: {
        id: string;
        company?: {
          id: string;
          title?: string;
          route?: string;
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [key: string]: any;
      } | null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any;
    }>;
  };
  users: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getCurrentUser: (variables?: any, options?: RequestInit) => Promise<any>;
    getUser: (variables: { userId: string }, options?: RequestInit) => Promise<{
      id: string;
      name?: string;
      username?: string;
      profilePicture?: { sourceUrl?: string };
      city?: string;
      country?: string;
      bio?: string;
      phoneVerified?: boolean;
      banner?: { sourceUrl?: string };
      createdAt?: number;
      userStat?: {
        moneyEarned24Hours?: number;
        moneyEarned30Days?: number;
        moneyEarned7Days?: number;
        moneyEarnedLifetime?: number;
      };
    }>;
  };
  companies: {
    getCompany: (variables: { companyId: string }, options?: RequestInit) => Promise<{
      _error?: Error;
      company?: {
        id: string;
        title?: string;
        route?: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [key: string]: any;
      } | null;
    }>;
    listAuthorizedUsers: (variables: {
      companyId: string;
    }, options?: RequestInit) => Promise<{
      _error?: Error;
      company?: {
        authorizedUsers?: Array<{
          role?: string | null;
          userId?: string | null;
        } | null> | null;
      } | null;
    }>;
    listPlans: (variables: {
      companyId: string;
      first?: number;
      after?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filter?: any;
    }, options?: RequestInit) => Promise<{
      _error?: Error;
      company?: {
        plans?: {
          nodes?: Array<{
            id: string;
            title: string;
            formattedPrice: string;
            rawInitialPrice: number;
            rawRenewalPrice: number;
            billingPeriod?: number | null;
            planType: string;
            visibility: string;
            accessPass?: {
              id: string;
              title: string;
              route: string;
            } | null;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            [key: string]: any;
          } | null> | null;
          totalCount: number;
        };
      } | null;
    }>;
    listMembers: (variables: {
      companyId: string;
      first?: number;
    }, options?: RequestInit) => Promise<{
      _error?: Error;
      company?: {
        members?: {
          totalCount: number;
          nodes?: Array<{
            role?: string | null;
            user?: { id?: string | null } | null;
          } | null>;
        };
      } | null;
    }>;
  };
  accessPasses: {
    listAccessPasses: (variables: {
      companyId: string;
      first?: number;
      after?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filter?: any;
    }, options?: RequestInit) => Promise<{
      _error?: Error;
      company?: {
        accessPasses?: {
          nodes?: Array<{
            id: string;
            title?: string;
            route?: string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            [key: string]: any;
          } | null> | null;
          totalCount?: number;
        };
      } | null;
    }>;
  };
  withUser: (userId: string) => WhopSdkShape;
  withCompany: (companyId: string) => WhopSdkShape;
};

let cachedSdk: WhopSdkShape | null = null;

export function getWhopSdk(companyId?: string): WhopSdkShape {
  const apiKey = process.env.WHOP_API_KEY;
  const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID;
  const agentUserId = process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID;
  const defaultCompanyId = process.env.NEXT_PUBLIC_WHOP_COMPANY_ID;
  
  if (!apiKey || !appId) {
    throw new Error('Missing WHOP credentials');
  }

  // Use provided companyId or fall back to default from env
  const finalCompanyId = companyId || defaultCompanyId;

  // Build base options (without companyId)
  const baseOptions: {
    appId: string;
    appApiKey: string;
    onBehalfOfUserId?: string;
  } = {
    appId,
    appApiKey: apiKey,
  };
  
  if (agentUserId) {
    baseOptions.onBehalfOfUserId = agentUserId;
  }

  // Initialize base SDK
  const baseSdk = WhopServerSdk(baseOptions) as unknown as WhopSdkShape;

  // If companyId is provided, use withCompany() method for proper company context
  if (finalCompanyId) {
    return baseSdk.withCompany(finalCompanyId);
  }

  // Cache base SDK if no companyId
  if (cachedSdk) return cachedSdk;
  
  cachedSdk = baseSdk;
  return baseSdk;
}


/**
 * Get company ID from experience using experienceId (Whop lead dev approach)
 * 
 * Based on your Whop app configuration:
 * - Experience path: /?experience=[experienceId]
 * 
 * This extracts experienceId from the query parameter 'experience' in the URL.
 */
async function getCompanyIdFromExperience(headers: Headers, requestUrl?: string): Promise<string | undefined> {
  try {
    let experienceId: string | undefined;
    
    // Method 1: Try to get experienceId from direct headers (if Whop sends them)
    experienceId = headers.get('x-whop-experience-id') || 
                   headers.get('whop-experience-id') ||
                   headers.get('x-experience-id') ||
                   headers.get('experience-id') ||
                   undefined;
    
    // Method 2: Extract from URL query parameters and path (PRIMARY METHOD)
    // Your app is configured with: /?experience=[experienceId]
    // So we check the 'experience' query parameter first
    if (!experienceId) {
      const referer = headers.get('referer') || headers.get('referrer') || '';
      const origin = headers.get('origin') || '';
      // Use requestUrl if provided (for API routes), otherwise use referer/origin
      const url = requestUrl || referer || origin;
      
      if (url) {
        try {
          const urlObj = new URL(url);
          
          // Priority 1: Check 'experience' query parameter (your app config: /?experience=[experienceId])
          // This is the primary method based on your Whop app configuration
          experienceId = urlObj.searchParams.get('experience') || undefined;
          
          // Priority 2: Check other query param variations (fallback)
          if (!experienceId) {
            experienceId = urlObj.searchParams.get('experienceId') || 
                          urlObj.searchParams.get('experience_id') ||
                          undefined;
          }
          
          // Priority 3: Check URL path for /experiences/[experienceId] pattern (template approach)
          if (!experienceId) {
            const pathParts = urlObj.pathname.split('/').filter(p => p);
            const experiencesIndex = pathParts.indexOf('experiences');
            if (experiencesIndex >= 0 && experiencesIndex < pathParts.length - 1) {
              experienceId = pathParts[experiencesIndex + 1];
            }
          }
          
          // Priority 4: Look for exp_ prefix anywhere in path (fallback)
          if (!experienceId) {
            const pathParts = urlObj.pathname.split('/').filter(p => p);
            const expIdInPath = pathParts.find(p => p.startsWith('exp_'));
            if (expIdInPath) {
              experienceId = expIdInPath;
            }
          }
        } catch {
          // Invalid URL, skip
        }
      }
    }
    
    if (!experienceId) {
      return undefined;
    }
    
    // Retrieve experience using SDK (Whop lead dev approach)
    const whopSdk = getWhopSdk();
    const experienceResult = await whopSdk.experiences.getExperience({ experienceId });
    
    if (experienceResult._error) {
      console.warn('Error retrieving experience:', experienceResult._error);
      return undefined;
    }
    
    // Extract companyId from experience.company.id
    const experience = experienceResult.experience || experienceResult;
    const companyId = experience?.company?.id;
    
    return companyId;
  } catch (error) {
    console.error('Error fetching company ID from experience:', error);
    return undefined;
  }
}

/**
 * Verify user token from request headers
 * Returns userId and companyId if valid, null otherwise
 * Automatically fetches companyId using multiple fallback methods:
 * 1. Request headers (multiple possible header names)
 * 2. Request URL/referrer (extract from Whop company URL)
 * 3. Experience retrieval (Whop lead dev approach - get experienceId from ?experience= query param, then experience.company.id)
 * 
 * @param headers - Request headers
 * @param requestUrl - Optional request URL (for API routes, pass request.url to extract experienceId from ?experience= query parameter)
 */
export async function verifyWhopUser(headers: Headers, requestUrl?: string): Promise<{ userId: string; companyId?: string } | null> {
  try {
    const whopSdk = getWhopSdk();
    const result = await whopSdk.verifyUserToken(headers);
    if (!result || !result.userId) return null;
    
   let companyId: string | undefined;
    
    // Method 3: Get experienceId from params/URL (template approach) and retrieve experience to get companyId
    // This follows the template pattern: extract experienceId from URL path like /experiences/[experienceId]
    if (!companyId) {
      companyId = await getCompanyIdFromExperience(headers, requestUrl);
    }
    
    return {
      userId: result.userId,
      companyId,
    };
  } catch (error) {
    console.error('Error verifying Whop user:', error);
    return null;
  }
}

/**
 * Get company information from Whop API
 */
export async function getWhopCompany(companyId: string): Promise<{ id: string; name?: string; url?: string } | null> {
  try {
    const whopSdk = getWhopSdk();
    const result = await whopSdk.companies.getCompany({ companyId });
    
    if (result._error) {
      console.error('Error fetching company:', result._error);
      return { id: companyId };
    }
    
    const company = result.company;
    if (!company) {
      return { id: companyId };
    }
    
    return {
      id: company.id,
      name: company.title || company.id,
      url: company.route ? `https://whop.com/${company.route}` : `https://whop.com/${companyId}`,
    };
  } catch (error) {
    console.error('Error fetching Whop company:', error);
    return { id: companyId };
  }
}

export async function getWhopProducts(companyId: string): Promise<Array<{
  id: string;
  name: string;
  route: string;
  url: string;
}>> {
  try {
    const whopSdk = getWhopSdk();
    const result = await whopSdk.accessPasses.listAccessPasses({ 
      companyId,
      first: 100
    });
    
    if (result._error) {
      console.error('Error fetching products:', result._error);
      return [];
    }
    
    const products = result.company?.accessPasses?.nodes || [];
    
    return products
      .filter((product): product is NonNullable<typeof product> => product !== null)
      .map((product) => ({
        id: product.id,
        name: product.title || product.id,
        route: product.route || '',
        url: product.route ? `https://whop.com/${product.route}` : `https://whop.com/${product.id}`,
      }));
  } catch (error) {
    console.error('Error fetching Whop products:', error);
    return [];
  }
}

/**
 * Get user data from Whop API
 */
export async function getWhopUser(userId: string): Promise<{
  id: string;
  name?: string;
  username?: string;
  profilePicture?: { sourceUrl?: string };
  city?: string;
  country?: string;
  bio?: string;
  phoneVerified?: boolean;
  banner?: { sourceUrl?: string };
  createdAt?: number;
} | null> {
  try {
    const whopSdk = getWhopSdk();
    const user = await whopSdk.users.getUser({ userId });
    return user;
  } catch (error) {
    console.error('Error fetching Whop user data:', error);
    return null;
  }
}

export async function getWhopProductsCount(companyId: string): Promise<number> {
  try {
    const whopSdk = getWhopSdk();
    const result = await whopSdk.accessPasses.listAccessPasses({ 
      companyId,
      first: 1
    });
    
    if (result._error) {
      console.error('Error fetching products count:', result._error);
      return 0;
    }
    
    return result.company?.accessPasses?.totalCount || 0;
  } catch (error) {
    console.error('Error fetching Whop products count:', error);
    return 0;
  }
}

export async function getWhopMembershipPlans(companyId: string): Promise<Array<{
  id: string;
  name: string;
  price: string;
  url: string;
  isPremium: boolean;
  productId?: string;
  productName?: string;
  productRoute?: string;
}>> {
  try {
    const whopSdk = getWhopSdk();
    const result = await whopSdk.companies.listPlans({ 
      companyId,
      first: 100
    });
    
    if (result._error) {
      console.error('Error fetching plans:', result._error);
      return [];
    }
    
    const plans = result.company?.plans?.nodes || [];
    
    return plans
      .filter((plan): plan is NonNullable<typeof plan> => plan !== null)
      .map((plan) => {
        const isFree = plan.rawInitialPrice === 0 && plan.rawRenewalPrice === 0;
        const isPremium = !isFree;
        
        let priceStr = plan.formattedPrice || 'Free';
        if (plan.rawInitialPrice > 0 && !priceStr.includes('$')) {
          priceStr = `$${plan.rawInitialPrice.toFixed(2)}`;
          if (plan.billingPeriod) {
            if (plan.billingPeriod === 1) {
              priceStr += ' / month';
            } else if (plan.billingPeriod === 12) {
              priceStr += ' / year';
            }
          }
        }
        
        const checkoutUrl = plan.accessPass?.route 
          ? `https://whop.com/${plan.accessPass.route}`
          : `https://whop.com/checkout/${plan.id}`;
        
        return {
          id: plan.id,
          name: plan.title || plan.id,
          price: priceStr,
          url: checkoutUrl,
          isPremium,
          productId: plan.accessPass?.id,
          productName: plan.accessPass?.title,
          productRoute: plan.accessPass?.route,
        };
      });
  } catch (error) {
    console.error('Error fetching Whop membership plans:', error);
    return [];
  }
}

/**
 * Get total member count for a Whop company
 */
export async function getWhopMemberCount(companyId: string): Promise<number> {
  try {
    const whopSdk = getWhopSdk();
    const result = await whopSdk.companies.listMembers({ 
      companyId,
      first: 1 // We only need the total count
    });
    
    if (result._error) {
      console.error('Error fetching member count:', result._error);
      return 0;
    }
    
    return result.company?.members?.totalCount || 0;
  } catch (error) {
    console.error('Error fetching Whop member count:', error);
    return 0;
  }
}

export async function getWhopCompanyData(companyId: string): Promise<{
  company: { id: string; name?: string; url?: string };
  products: Array<{
    id: string;
    name: string;
    route: string;
    url: string;
  }>;
  productsCount: number;
  membershipPlans: Array<{
    id: string;
    name: string;
    price: string;
    url: string;
    isPremium: boolean;
    productId?: string;
    productName?: string;
    productRoute?: string;
  }>;
  memberCount: number;
}> {
  const [company, products, productsCount, membershipPlans, memberCount] = await Promise.all([
    getWhopCompany(companyId),
    getWhopProducts(companyId),
    getWhopProductsCount(companyId),
    getWhopMembershipPlans(companyId),
    getWhopMemberCount(companyId),
  ]);
  
  return {
    company: company || { id: companyId },
    products,
    productsCount,
    membershipPlans,
    memberCount,
  };
}

/**
 * Get user role from database (replaces Whop API-based role checking)
 */
export async function getUserRoleFromDB({ userId, companyId }: { userId: string; companyId: string }): Promise<'owner' | 'admin' | 'member' | 'none'> {
  try {
    const { User } = await import('@/models/User');
    const connectDB = await import('@/lib/db').then(m => m.default);
    await connectDB();
    
    const user = await User.findOne({ whopUserId: userId, companyId });
    if (!user) return 'none';
    
    return user.role || 'member';
  } catch {
    return 'none';
  }
}

/**
 * Legacy function - now uses database instead of Whop API
 */
export async function userHasCompanyAccess({ userId, companyId }: { userId: string; companyId: string }): Promise<'owner' | 'admin' | 'member' | 'none'> {
  return getUserRoleFromDB({ userId, companyId });
}

