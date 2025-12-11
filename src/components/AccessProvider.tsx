'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type AccessRole = 'companyOwner' | 'owner' | 'admin' | 'member' | 'none';

type AccessContextValue = {
  role: AccessRole;
  isAuthorized: boolean;
  loading: boolean;
  userId: string | null;
  companyId: string | null;
  hideLeaderboardFromMembers?: boolean;
  hideCompanyStatsFromMembers?: boolean;
  refresh: () => Promise<void>;
};

const AccessContext = createContext<AccessContextValue>({
  role: 'none',
  isAuthorized: false,
  loading: true,
  userId: null,
  companyId: null,
  hideLeaderboardFromMembers: false,
  hideCompanyStatsFromMembers: false,
  refresh: async () => {},
});

// Global experienceId state (set from page.tsx)
let globalExperienceId: string | null = null;
const experienceIdListeners: Set<() => void> = new Set();

/**
 * Set experienceId from page.tsx
 * This allows page.tsx to pass experienceId to AccessProvider
 */
export function setExperienceId(experienceId: string | null) {
  globalExperienceId = experienceId;
  // Notify all listeners
  experienceIdListeners.forEach(listener => listener());
}

/**
 * Extract experienceId from current URL query parameters
 * This is needed because the home page (/) is the first page that loads with ?experience=exp_...

/**
 * Fetch access role and auth info from API
 * This calls verifyWhopUser ONCE on the server side
 */
async function fetchAccessRole(experienceId?: string | null): Promise<{ 
  role: AccessRole; 
  isAuthorized: boolean;
  userId: string | null;
  companyId: string | null;
  hideLeaderboardFromMembers?: boolean;
  hideCompanyStatsFromMembers?: boolean;
}> {
  try {
    // Include experienceId in the URL if present (from query parameter ?experience=exp_...)
    let url = '/api/auth/role';
    if (experienceId) {
      url += `?experience=${encodeURIComponent(experienceId)}`;
    } else {
      return { role: 'none', isAuthorized: false, userId: null, companyId: null, hideLeaderboardFromMembers: false, hideCompanyStatsFromMembers: false };
    }

    const response = await fetch(url, {
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      return { role: 'none', isAuthorized: false, userId: null, companyId: null, hideLeaderboardFromMembers: false, hideCompanyStatsFromMembers: false };
    }

    const data = await response.json();
    const role = data.role as AccessRole | undefined;
    const isAuthorized = Boolean(data.isAuthorized);
    const userId = data.userId || null;
    const companyId = data.companyId || null;
    const hideLeaderboardFromMembers = data.hideLeaderboardFromMembers ?? false;
    const hideCompanyStatsFromMembers = data.hideCompanyStatsFromMembers ?? false;
    
    if (role === 'companyOwner' || role === 'owner' || role === 'admin' || role === 'member' || role === 'none') {
      return { role, isAuthorized, userId, companyId, hideLeaderboardFromMembers, hideCompanyStatsFromMembers };
    }

    return { role: 'none', isAuthorized: false, userId: null, companyId: null, hideLeaderboardFromMembers: false, hideCompanyStatsFromMembers: false };
  } catch (error) {
    console.error('Failed to load access role', error);
    return { role: 'none', isAuthorized: false, userId: null, companyId: null, hideLeaderboardFromMembers: false, hideCompanyStatsFromMembers: false };
  }
}

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<AccessRole>('none');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [hideLeaderboardFromMembers, setHideLeaderboardFromMembers] = useState(false);
  const [hideCompanyStatsFromMembers, setHideCompanyStatsFromMembers] = useState(false);
  const [experienceId, setExperienceIdState] = useState<string | null>(null);

  // Listen for experienceId changes from page.tsx
  useEffect(() => {
    const listener = () => {
      setExperienceIdState(globalExperienceId);
    };
    experienceIdListeners.add(listener);
    // Set initial value
    setExperienceIdState(globalExperienceId);
    
    return () => {
      experienceIdListeners.delete(listener);
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    // Use experienceId from state (set by page.tsx) or fall back to URL
    const currentExperienceId = experienceId;
    const result = await fetchAccessRole(currentExperienceId);
    setRole(result.role);
    setIsAuthorized(result.isAuthorized);
    setUserId(result.userId);
    setCompanyId(result.companyId);
    setHideLeaderboardFromMembers(result.hideLeaderboardFromMembers ?? false);
    setHideCompanyStatsFromMembers(result.hideCompanyStatsFromMembers ?? false);
    setLoading(false);
  }, [experienceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AccessContextValue>(
    () => ({
      role,
      isAuthorized,
      loading,
      userId,
      companyId,
      hideLeaderboardFromMembers,
      hideCompanyStatsFromMembers,
      refresh,
    }),
    [role, isAuthorized, loading, userId, companyId, hideLeaderboardFromMembers, hideCompanyStatsFromMembers, refresh],
  );

  return (
    <AccessContext.Provider value={value}>
      {children}
    </AccessContext.Provider>
  );
}

export function useAccess() {
  const context = useContext(AccessContext);
  if (!context) {
    throw new Error('useAccess must be used within an AccessProvider');
  }
  return context;
}
