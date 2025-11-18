/**
 * API client utility that automatically includes userId and companyId headers
 * from the AccessProvider context
 */

export interface ApiClientOptions extends RequestInit {
  userId?: string | null;
  companyId?: string | null;
}

/**
 * Make an API request with automatic userId and companyId headers
 */
export async function apiRequest(
  url: string,
  options: ApiClientOptions = {}
): Promise<Response> {
  const { userId, companyId, headers = {}, ...restOptions } = options;

  // Build headers with userId and companyId if provided
  const requestHeaders: Record<string, string> = {
    ...(headers as Record<string, string>),
  };

  if (userId) {
    requestHeaders['x-user-id'] = userId;
  }

  if (companyId) {
    requestHeaders['x-company-id'] = companyId;
  }

  return fetch(url, {
    ...restOptions,
    headers: requestHeaders,
    credentials: 'include',
  });
}

