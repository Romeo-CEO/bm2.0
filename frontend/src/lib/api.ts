export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

// PayFast types
export interface PayFastSettings {
  merchantId: string;
  sandbox: boolean;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  hasMerchantKey: boolean;
  hasPassPhrase: boolean;
}

export interface PayFastCheckoutResponse {
  action: string;
  fields: Record<string, string>;
}

const buildApiBase = (): string => {
  const ensureTrailingSlash = (value: string) => (value.endsWith('/') ? value : `${value}/`);
  const sanitize = (value: string) => ensureTrailingSlash(value.replace(/\s+/g, '').replace(/\/*$/, '/'));

  const fromEnv = (import.meta as any).env?.VITE_API_BASE as string | undefined;
  if (fromEnv) {
    return sanitize(fromEnv);
  }

  try {
    const qs = new URLSearchParams(window.location.search);
    const fromQuery = qs.get('apiBase') || qs.get('api');
    if (fromQuery) {
      const normalized = sanitize(fromQuery);
      localStorage.setItem('API_BASE_OVERRIDE', normalized);
      return normalized;
    }
  } catch {}

  try {
    const fromStorage = localStorage.getItem('API_BASE_OVERRIDE');
    if (fromStorage) {
      return sanitize(fromStorage);
    }
  } catch {}

  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return 'https://premwebs.com/api/';
  }

  if (typeof window !== 'undefined') {
    const origin = window.location.origin.replace(/\/$/, '');
    return `${origin}/api/`;
  }

  return '/api/';
};

export const API_BASE = buildApiBase();
console.log('API_BASE =', API_BASE);

// Quick helpers for testing different backends from console
// window.__setApiBase = (url) => { localStorage.setItem('API_BASE_OVERRIDE', url); location.reload(); };
// window.__clearApiBaseOverride = () => { localStorage.removeItem('API_BASE_OVERRIDE'); location.reload(); };
//
// SSL Certificate Issue Solutions:
// window.__setApiBase('http://premwebs.com/api/');
// window.__setApiBase('https://www.premwebs.com/api/');
// window.__setApiBase('https://premwebs.com:2083/api/');


const jsonHeaders: HeadersInit = { "Content-Type": "application/json" };
function authHeaders(opts?: { json?: boolean }): HeadersInit {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (opts?.json) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function toBoolean(value: any): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value === "1" || value.toLowerCase() === "true";
  return Boolean(value);
}

export type ApiUser = any;

export interface FrontendUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "user";
  companyId?: string;
  subscriptionTier: "trial" | "diy" | "diy_accountant";
  subscriptionExpiry: Date;
  isActive: boolean;
}

export interface FrontendApplication {
  id: string;
  name: string;
  description: string;
  category: string;
  type: "application" | "template";
  url?: string;
  downloadUrl?: string;
  fileName?: string;
  fileSize?: string;
  subscriptionTiers: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SsoSession {
  sessionId: string;
  expiresAt?: string;
}

export interface SsoDomainTokenPayload {
  token: string;
  user: {
    id: string;
    role: string;
    permissions: string[];
    companyId?: string;
  };
}

export async function apiSsoAuthenticate(): Promise<ApiResult<SsoSession>> {
  const masterToken = localStorage.getItem('token');
  if (!masterToken) {
    return { success: false, error: 'Not authenticated', status: 401 };
  }

  const res = await fetch(`${API_BASE}sso/authenticate`, {
    method: 'POST',
    headers: authHeaders({ json: true }),
    body: JSON.stringify({ token: masterToken })
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success || !data?.sessionId) {
    return {
      success: false,
      error: (data && (data.error as string)) || res.statusText,
      status: res.status
    };
  }

  return {
    success: true,
    data: {
      sessionId: data.sessionId as string,
      expiresAt: data.expiresAt as string | undefined
    },
    status: res.status
  };
}

export async function apiSsoGetDomainToken(
  domain: string,
  sessionId: string
): Promise<ApiResult<SsoDomainTokenPayload>> {
  const sanitizedDomain = domain.trim().toLowerCase();
  const res = await fetch(`${API_BASE}sso/validate/${encodeURIComponent(sanitizedDomain)}`, {
    method: 'POST',
    headers: authHeaders({ json: true }),
    body: JSON.stringify({ sessionId })
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success || !data?.token) {
    return {
      success: false,
      error: (data && (data.error as string)) || res.statusText,
      status: res.status
    };
  }

  return {
    success: true,
    data: {
      token: data.token as string,
      user: {
        id: data.user?.id as string,
        role: data.user?.role as string,
        permissions: Array.isArray(data.user?.permissions) ? data.user.permissions as string[] : [],
        companyId: data.user?.companyId as string | undefined
      }
    },
    status: res.status
  };
}

export interface FrontendCompany {
  id: string;
  name: string;
  domain: string;
  ownerId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export function mapUserFromApi(input: any): FrontendUser {
  const firstName = input.firstName ?? input.first_name ?? "";
  const lastName = input.lastName ?? input.last_name ?? "";
  const companyId = input.companyId ?? input.company_id ?? undefined;
  const subscriptionTier = input.subscriptionTier ?? input.subscription_tier ?? "trial";
  const subscriptionExpiry = input.subscriptionExpiry ?? input.subscription_expiry ?? null;
  const isActiveRaw = input.isActive ?? input.is_active ?? true;
  return {
    id: String(input.id),
    email: String(input.email),
    firstName: String(firstName),
    lastName: String(lastName),
    role: (input.role as any) ?? "user",
    companyId: companyId ? String(companyId) : undefined,
    subscriptionTier: subscriptionTier,
    subscriptionExpiry: subscriptionExpiry ? new Date(subscriptionExpiry) : new Date(),
    isActive: toBoolean(isActiveRaw),
  };
}

export function mapApplicationFromApi(input: any): FrontendApplication {
  const createdAt = input.createdAt ?? input.created_at ?? new Date().toISOString();
  const updatedAt = input.updatedAt ?? input.updated_at ?? new Date().toISOString();
  const isActiveRaw = input.isActive ?? input.is_active ?? true;
  return {
    id: String(input.id),
    name: String(input.name),
    description: String(input.description ?? ""),
    category: String(input.category ?? ""),
    type: input.type as any,
    url: input.url ?? undefined,
    downloadUrl: input.downloadUrl ?? undefined,
    fileName: input.fileName ?? undefined,
    fileSize: input.fileSize ?? undefined,
    subscriptionTiers: Array.isArray(input.subscriptionTiers) ? input.subscriptionTiers : [],
    isActive: toBoolean(isActiveRaw),
    createdAt: new Date(createdAt),
    updatedAt: new Date(updatedAt),
  };
}

export function mapCompanyFromApi(input: any): FrontendCompany {
  const createdAt = input.createdAt ?? input.created_at ?? new Date().toISOString();
  const updatedAt = input.updatedAt ?? input.updated_at ?? null;
  const isActiveRaw = input.isActive ?? input.is_active ?? true;
  return {
    id: String(input.id),
    name: String(input.name),
    domain: String(input.domain ?? ""),
    ownerId: String(input.owner_id ?? input.ownerId ?? ""),
    isActive: toBoolean(isActiveRaw),
    createdAt: new Date(createdAt),
    updatedAt: updatedAt ? new Date(updatedAt) : undefined,
  };
}

export async function apiLogin(email: string, password: string): Promise<ApiResult<FrontendUser>> {
  console.log('API: Sending login request to:', `${API_BASE}auth/login`);
  const res = await fetch(`${API_BASE}auth/login`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => null);
  console.log('API: Raw response status:', res.status, 'ok:', res.ok);
  console.log('API: Raw response data:', data);

  if (!res.ok || !data) {
    console.log('API: HTTP error or no data');
    return { success: false, error: (data && data.error) || res.statusText };
  }

  // Check if the backend returned success: false in the response
  if (data.success === false) {
    console.log('API: Backend returned success: false');
    return { success: false, error: data.error || 'Login failed' };
  }

  // Check if we have the required data for successful login
  if (!data.success || !data.user || !data.token) {
    console.log('API: Missing required data - success:', data.success, 'user:', !!data.user, 'token:', !!data.token);
    return { success: false, error: 'Invalid response from server' };
  }

  console.log('API: Login successful, mapping user');
  const user = mapUserFromApi(data.user);
  localStorage.setItem('token', data.token);
  return { success: true, data: user };
}

export async function apiRegister(params: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
}): Promise<ApiResult<FrontendUser>> {
  const res = await fetch(`${API_BASE}auth/register`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    return { success: false, error: (data && data.error) || res.statusText };
  }

  // Check if the backend returned success: false in the response
  if (data.success === false) {
    return { success: false, error: data.error || 'Registration failed' };
  }

  // Check if we have the required data for successful registration
  if (!data.success || !data.user || !data.token) {
    return { success: false, error: 'Invalid response from server' };
  }

  const user = mapUserFromApi(data.user);
  localStorage.setItem('token', data.token);
  return { success: true, data: user };
}

export async function apiLogout(): Promise<void> {
  try {
    await fetch(`${API_BASE}auth/logout`, {
      method: 'POST',
      headers: authHeaders({ json: true }),
      body: JSON.stringify({}),
    });
  } catch (error) {
    console.warn('[apiLogout] request failed', error);
  }
}

// Enhanced User Management with Pagination
export async function apiGetUsers(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  companyId?: string;
}): Promise<ApiResult<{ items: FrontendUser[]; page: number; pageSize: number; total: number; totalPages: number }>> {
  const url = new URL(`${API_BASE}users`);
  if (params?.page) url.searchParams.set('page', params.page.toString());
  if (params?.pageSize) url.searchParams.set('pageSize', params.pageSize.toString());
  if (params?.search) url.searchParams.set('search', params.search);
  if (params?.companyId) url.searchParams.set('companyId', params.companyId);

  const res = await fetch(url.toString(), { method: 'GET', headers: authHeaders() });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { success: false, error: data?.error || res.statusText };

  if (data.items) {
    // Paginated response
    return {
      success: true,
      data: {
        items: data.items.map(mapUserFromApi),
        page: data.page,
        pageSize: data.pageSize,
        total: data.total,
        totalPages: data.totalPages
      }
    };
  } else {
    // Legacy response (array)
    const users = Array.isArray(data) ? data.map(mapUserFromApi) : [];
    return { success: true, data: { items: users, page: 1, pageSize: users.length, total: users.length, totalPages: 1 } };
  }
}

export async function apiGetUser(userId: string): Promise<ApiResult<FrontendUser>> {
  const res = await fetch(`${API_BASE}users/${userId}`, { method: 'GET', headers: authHeaders() });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { success: false, error: data?.error || res.statusText };
  return { success: true, data: mapUserFromApi(data) };
}

export async function apiCreateUser(userData: {
  email: string;
  firstName: string;
  lastName: string;
  role?: 'admin' | 'user';
  companyId?: string;
  subscriptionTier?: 'trial' | 'diy' | 'diy_accountant';
  subscriptionExpiry?: string;
  isActive?: boolean;
}): Promise<ApiResult<{ userId: string; tempPassword: string }>> {
  const res = await fetch(`${API_BASE}users`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify(userData)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { success: false, error: data?.error || res.statusText };
  return { success: true, data };
}

export async function apiDeleteUser(userId: string): Promise<ApiResult<true>> {
  const res = await fetch(`${API_BASE}users/${userId}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { success: false, error: data?.error || res.statusText };
  return { success: true, data: true };
}

export async function apiMe(): Promise<ApiResult<FrontendUser>> {
  const url = `${API_BASE}auth/me`;
  const headers = authHeaders();
  console.log('API: Calling me:', url, 'auth header present:', Boolean((headers as any).Authorization));
  console.log('API: auth header value:', (headers as any).Authorization ? (headers as any).Authorization.substring(0, 20) + '...' : 'none');
  console.log('API: full auth header:', (headers as any).Authorization);
  const res = await fetch(url, { method: 'GET', headers });
  const data = await res.json().catch(() => null);
  console.log('API: /auth/me status:', res.status, 'ok:', res.ok, 'data:', data);
  console.log('API: data.user exists:', !!data?.user, 'data.success:', data?.success);
  if (!res.ok || !data?.user) return { success: false, error: (data && data.error) || res.statusText };
  return { success: true, data: mapUserFromApi(data.user) };
}
export async function apiGetPayFastSettings(): Promise<ApiResult<PayFastSettings>> {
  const res = await fetch(`/api/settings/payfast`, { method: 'GET', headers: authHeaders() });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) return { success: false, error: data?.error || res.statusText };
  return { success: true, data };
}

export async function apiSavePayFastSettings(input: Partial<PayFastSettings> & { merchantKey?: string; passPhrase?: string }): Promise<ApiResult<true>> {
  const res = await fetch(`/api/settings/payfast`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) return { success: false, error: data?.error || res.statusText };
  return { success: true, data: true };
}

export async function apiPayFastCheckout(input: Record<string, any>): Promise<ApiResult<PayFastCheckoutResponse>> {
  const res = await fetch(`/api/payments/payfast/checkout`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) return { success: false, error: data?.error || res.statusText };
  return { success: true, data: { action: data.action, fields: data.fields } };
}

export async function apiGetPaymentStatus(mPaymentId: string): Promise<ApiResult<{ status: string }>> {
  const res = await fetch(`/api/payments/status?m_payment_id=${encodeURIComponent(mPaymentId)}`, { method: 'GET' });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) return { success: false, error: data?.error || res.statusText };
  return { success: true, data: { status: data.status } };
}

export async function apiPayFastVerify(mPaymentId: string): Promise<ApiResult<{ status: string }>> {
  const res = await fetch(`/api/payments/payfast/verify`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({ m_payment_id: mPaymentId }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) return { success: false, error: data?.error || res.statusText };
  return { success: true, data: { status: data.status } };
}

// Real subscription cancellation
export async function apiCancelSubscription(input?: { reason?: string; immediate?: boolean }): Promise<ApiResult<{ effectiveAt: string | null }>> {
  const res = await fetch(`/api/payments/subscription/cancel`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify(input || {})
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) return { success: false, error: data?.error || res.statusText };
  return { success: true, data: { effectiveAt: data.effectiveAt ?? null } };
}



export async function apiUpdateUser(id: string, input: Partial<FrontendUser>): Promise<ApiResult<true>> {
  const payload = {
    firstName: input.firstName,
    lastName: input.lastName,
    subscriptionTier: input.subscriptionTier,
    subscriptionExpiry: input.subscriptionExpiry ? input.subscriptionExpiry.toISOString() : undefined,
    isActive: input.isActive != null ? (input.isActive ? 1 : 0) : undefined,
  };
  const res = await fetch(`${API_BASE}users/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    return { success: false, error: (data && data.error) || res.statusText };
  }
  return { success: true, data: true };
}


export interface PaginatedResult<T> { items: T[]; page: number; pageSize: number; total: number; }

export async function apiGetPublicApplicationsPaged(params?: { type?: string; category?: string; q?: string; page?: number; pageSize?: number; sortBy?: 'date'|'name'; sortDir?: 'asc'|'desc' }): Promise<ApiResult<PaginatedResult<PublicAppItem>>> {
  const qs = new URLSearchParams();
  if (params?.sortBy) qs.set('sortBy', params.sortBy);
  if (params?.sortDir) qs.set('sortDir', params.sortDir);
  if (params?.type) qs.set('type', params.type);
  if (params?.category) qs.set('category', params.category);
  if (params?.q) qs.set('q', params.q);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
  const url = `${API_BASE}applications/public${qs.toString() ? `?${qs.toString()}` : ''}`;
  const res = await fetch(url, { method: 'GET' });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { success: false, error: (data as any)?.error || res.statusText };
  return { success: true, data: data as PaginatedResult<PublicAppItem> };
}

export async function apiGetApplications(
  type: "application" | "template" = "application",
  params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    category?: string;
  }
): Promise<ApiResult<FrontendApplication[] | { items: FrontendApplication[]; page: number; pageSize: number; total: number; totalPages: number }>> {
  const url = new URL(`${API_BASE}applications`);
  url.searchParams.set("type", type);

  if (params?.page) url.searchParams.set("page", params.page.toString());
  if (params?.pageSize) url.searchParams.set("pageSize", params.pageSize.toString());
  if (params?.search) url.searchParams.set("search", params.search);
  if (params?.category) url.searchParams.set("category", params.category);

  const headers = authHeaders();
  console.log('API: get applications ->', url.toString(), 'auth header present:', Boolean((headers as any).Authorization));
  console.log('API: auth header value:', (headers as any).Authorization ? (headers as any).Authorization.substring(0, 20) + '...' : 'none');
  const res = await fetch(url.toString(), { method: "GET", headers });
  const data = await res.json().catch(() => []);
  console.log('API: get applications status:', res.status, 'count:', Array.isArray(data) ? data.length : 'n/a');
  console.log('API: raw response data:', data);
  console.log('API: is data array?', Array.isArray(data));
  console.log('API: data type:', typeof data);
  if (!res.ok) return { success: false, error: res.statusText };

  if (Array.isArray(data)) {
    // Legacy format - simple array
    const apps = data.map(mapApplicationFromApi);
    console.log('API: mapped applications:', apps);
    console.log('API: mapped apps length:', apps.length);
    return { success: true, data: apps };
  } else if (data && data.items) {
    // Paginated format
    const apps = data.items.map(mapApplicationFromApi);
    console.log('API: mapped paginated applications:', apps);
    return {
      success: true,
      data: {
        items: apps,
        page: data.page,
        pageSize: data.pageSize,
        total: data.total,
        totalPages: data.totalPages
      }
    };
  } else {
    // Fallback
    return { success: true, data: [] };
  }
}

export async function apiCreateApplication(input: Omit<FrontendApplication, "id" | "createdAt" | "updatedAt">): Promise<ApiResult<string>> {
  const payload: any = {
    name: input.name,
    description: input.description,
    category: input.category,
    type: input.type,
    url: input.url ?? null,
    downloadUrl: input.downloadUrl ?? null,
    fileName: input.fileName ?? null,
    fileSize: input.fileSize ?? null,
    subscriptionTiers: input.subscriptionTiers,
    isActive: input.isActive ? 1 : 0,
  };
  const res = await fetch(`${API_BASE}applications`, {
    method: "POST",
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    return { success: false, error: (data && data.error) || res.statusText };
  }
  return { success: true, data: data.id as string };
}

export interface PublicAppItem {
  id: string; name: string; description: string; category: string; type: 'application'|'template';
  subscriptionTiers: string[]; images?: string[]; features?: string[]; price?: string | number | null;
}

export async function apiGetPublicApplications(params?: { type?: string; category?: string; q?: string }): Promise<ApiResult<PublicAppItem[]>> {
  const qs = new URLSearchParams();
  if (params?.type) qs.set('type', params.type);
  if (params?.category) qs.set('category', params.category);
  if (params?.q) qs.set('q', params.q);
  const url = `${API_BASE}applications/public${qs.toString() ? `?${qs.toString()}` : ''}`;
  const res = await fetch(url, { method: 'GET' });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { success: false, error: data?.error || res.statusText };
  return { success: true, data };
}

// Templates API (new dedicated endpoints)
export interface TemplateItem {
  id: string;
  name: string;
  description: string;
  category: string;
  downloadUrl?: string | null;
  fileName?: string | null;
  fileSize?: string | null;
  fileType?: string | null;
  subscriptionTiers: string[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export async function apiGetTemplates(): Promise<ApiResult<TemplateItem[]>> {
  const url = `${API_BASE}templates`;
  const res = await fetch(url, { method: 'GET', headers: authHeaders() });
  const data = await res.json().catch(() => []);
  if (!res.ok) return { success: false, error: (data as any)?.error || res.statusText };
  return { success: true, data: data as TemplateItem[] };
}

export async function apiCreateTemplate(payload: Partial<TemplateItem>): Promise<ApiResult<string>> {
  const res = await fetch(`${API_BASE}templates`, { method: 'POST', headers: authHeaders({ json: true }), body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { success: false, error: (data as any)?.error || res.statusText };
  return { success: true, data: (data as any).id };
}

export async function apiUpdateTemplate(id: string, payload: Partial<TemplateItem>): Promise<ApiResult<void>> {
  const res = await fetch(`${API_BASE}templates/${encodeURIComponent(id)}`, { method: 'PUT', headers: authHeaders({ json: true }), body: JSON.stringify(payload) });
  if (!res.ok) return { success: false, error: await res.text() } as any;
  return { success: true };
}

export async function apiDeleteTemplate(id: string): Promise<ApiResult<void>> {
  const res = await fetch(`${API_BASE}templates/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) return { success: false, error: await res.text() } as any;
  return { success: true };
}

// Files API (Azure Blob via SAS)
export interface FileSasResponse {
  blobName: string;
  uploadUrl: string;
  blobUrl: string;
  expiresAt: string;
}

export async function apiFilesGetSas(input: { fileName: string; fileType: string; fileSizeBytes: number }): Promise<ApiResult<FileSasResponse>> {
  const res = await fetch(`/api/files/sas`, { method: 'POST', headers: authHeaders({ json: true }), body: JSON.stringify(input) })
  const data = await res.json().catch(() => null)
  if (!res.ok) return { success: false, error: data?.error || res.statusText }
  return { success: true, data }
}

export interface ApiFileRecord {
  id: string;
  azureBlobUrl: string;
  azureCdnUrl?: string | null;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  uploadedAt?: string;
}

export async function apiFilesConfirm(input: { blobName: string; fileName: string; fileType: string; fileSizeBytes: number; isPublic?: boolean }): Promise<ApiResult<ApiFileRecord>> {
  const res = await fetch(`/api/files/confirm`, { method: 'POST', headers: authHeaders({ json: true }), body: JSON.stringify(input) })
  const data = await res.json().catch(() => null)
  if (!res.ok) return { success: false, error: data?.error || res.statusText }
  return { success: true, data: (data?.file as any) }
}

export async function apiDownloadTemplate(id: string): Promise<ApiResult<Blob>> {
  // This path is not used with the new platform template flow; keeping for compatibility
  const res = await fetch(`${API_BASE}templates/${encodeURIComponent(id)}`, { method: 'GET', headers: authHeaders() });
  if (!res.ok) return { success: false, error: res.statusText };
  const data = await res.json().catch(() => null);
  if (!data?.downloadUrl) return { success: false, error: 'No download URL' };
  const follow = await fetch(data.downloadUrl, { method: 'GET' });
  if (!follow.ok) return { success: false, error: follow.statusText };
  const blob = await follow.blob();
  return { success: true, data: blob };
}


export interface PublicTemplateItem {
  id: string; name: string; description: string; category: string;
  fileName?: string | null; fileSize?: string | null; fileType?: string | null;
  subscriptionTiers: string[];
}

export async function apiGetPublicTemplatesPaged(params?: { category?: string; q?: string; page?: number; pageSize?: number; sortBy?: 'date'|'name'; sortDir?: 'asc'|'desc' }): Promise<ApiResult<PaginatedResult<PublicTemplateItem>>> {
  const qs = new URLSearchParams();
  if (params?.sortBy) qs.set('sortBy', params.sortBy);
  if (params?.sortDir) qs.set('sortDir', params.sortDir);
  if (params?.category) qs.set('category', params.category);
  if (params?.q) qs.set('q', params.q);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
  const url = `${API_BASE}templates/public${qs.toString() ? `?${qs.toString()}` : ''}`;
  const res = await fetch(url, { method: 'GET' });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { success: false, error: (data as any)?.error || res.statusText };
  return { success: true, data: data as PaginatedResult<PublicTemplateItem> };
}

export async function apiGetPublicTemplates(params?: { category?: string; q?: string }): Promise<ApiResult<PublicTemplateItem[]>> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set('category', params.category);
  if (params?.q) qs.set('q', params.q);
  const url = `${API_BASE}templates/public${qs.toString() ? `?${qs.toString()}` : ''}`;
  const res = await fetch(url, { method: 'GET' });
  const data = await res.json().catch(() => []);
  if (!res.ok) return { success: false, error: (data as any)?.error || res.statusText };
  return { success: true, data: data as PublicTemplateItem[] };
}

export async function apiUpdateApplication(id: string, input: Partial<FrontendApplication>): Promise<ApiResult<true>> {
  const payload: any = {
    name: input.name,
    description: input.description,
    category: input.category,
    url: input.url ?? null,
    downloadUrl: input.downloadUrl ?? null,
    fileName: input.fileName ?? null,
    fileSize: input.fileSize ?? null,
    subscriptionTiers: input.subscriptionTiers,
    isActive: input.isActive != null ? (input.isActive ? 1 : 0) : undefined,
  };
  const res = await fetch(`${API_BASE}applications/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    return { success: false, error: (data && data.error) || res.statusText };
  }
  return { success: true, data: true };
}

export async function apiDeleteApplication(id: string): Promise<ApiResult<true>> {
  const res = await fetch(`${API_BASE}applications/${encodeURIComponent(id)}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    return { success: false, error: (data && data.error) || res.statusText };
  }
  return { success: true, data: true };
}

// Enhanced Company Management with Pagination
export async function apiGetCompanies(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<ApiResult<{ items: FrontendCompany[]; page: number; pageSize: number; total: number; totalPages: number }>> {
  const url = new URL(`${API_BASE}companies`);
  if (params?.page) url.searchParams.set('page', params.page.toString());
  if (params?.pageSize) url.searchParams.set('pageSize', params.pageSize.toString());
  if (params?.search) url.searchParams.set('search', params.search);

  const res = await fetch(url.toString(), { method: 'GET', headers: authHeaders() });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { success: false, error: data?.error || res.statusText };

  if (data.items) {
    // Paginated response
    return {
      success: true,
      data: {
        items: data.items.map(mapCompanyFromApi),
        page: data.page,
        pageSize: data.pageSize,
        total: data.total,
        totalPages: data.totalPages
      }
    };
  } else {
    // Legacy response (array)
    const companies = Array.isArray(data) ? data.map(mapCompanyFromApi) : [];
    return { success: true, data: { items: companies, page: 1, pageSize: companies.length, total: companies.length, totalPages: 1 } };
  }
}

export async function apiGetCompany(companyId: string): Promise<ApiResult<FrontendCompany>> {
  const res = await fetch(`${API_BASE}companies/${companyId}`, { method: 'GET', headers: authHeaders() });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { success: false, error: data?.error || res.statusText };
  return { success: true, data: mapCompanyFromApi(data) };
}

export async function apiCreateCompany(companyData: {
  name: string;
  domain?: string;
  ownerId?: string;
  isActive?: boolean;
}): Promise<ApiResult<{ companyId: string }>> {
  const res = await fetch(`${API_BASE}companies`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify(companyData)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { success: false, error: data?.error || res.statusText };
  return { success: true, data };
}

export async function apiUpdateCompany(companyId: string, companyData: {
  name?: string;
  domain?: string;
  ownerId?: string;
  isActive?: boolean;
}): Promise<ApiResult<true>> {
  const res = await fetch(`${API_BASE}companies/${companyId}`, {
    method: 'PUT',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify(companyData)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { success: false, error: data?.error || res.statusText };
  return { success: true, data: true };
}

export async function apiDeleteCompany(companyId: string): Promise<ApiResult<true>> {
  const res = await fetch(`${API_BASE}companies/${companyId}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { success: false, error: data?.error || res.statusText };
  return { success: true, data: true };
}

// Company Profile Management
export async function apiGetCompanyProfile(companyId?: string): Promise<ApiResult<any>> {
  const url = companyId ? `${API_BASE}company/profile/${companyId}` : `${API_BASE}company/profile`;
  const res = await fetch(url, { method: 'GET', headers: authHeaders() });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { success: false, error: data?.error || res.statusText };
  return { success: true, data };
}

export async function apiUpdateCompanyProfile(profile: any, companyId?: string): Promise<ApiResult<true>> {
  const url = companyId ? `${API_BASE}company/profile/${companyId}` : `${API_BASE}company/profile`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify(profile)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { success: false, error: data?.error || res.statusText };
  return { success: true, data: true };
}

// Company User Management
export async function apiGetCompanyUsers(companyId?: string): Promise<ApiResult<any[]>> {
  const url = companyId ? `${API_BASE}companies/${companyId}/users` : `${API_BASE}company/users`;
  const res = await fetch(url, { method: 'GET', headers: authHeaders() });
  const data = await res.json().catch(() => []);
  if (!res.ok) return { success: false, error: data?.error || res.statusText };
  return { success: true, data: Array.isArray(data) ? data : [] };
}

export async function apiAddCompanyUser(userData: {
  email: string;
  firstName: string;
  lastName: string;
  sendInvite?: boolean;
}, companyId?: string): Promise<ApiResult<{ userId: string; tempPassword: string }>> {
  const url = companyId ? `${API_BASE}companies/${companyId}/users` : `${API_BASE}company/users`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify(userData)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { success: false, error: data?.error || res.statusText };
  return { success: true, data };
}

// User-Company Assignment and Role Management
export async function apiAssignUserToCompany(userId: string, companyId: string): Promise<ApiResult<true>> {
  const res = await fetch(`${API_BASE}users/${userId}/assign-company`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({ companyId })
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { success: false, error: data?.error || res.statusText };
  return { success: true, data: true };
}

export async function apiSetUserCompanyAdmin(userId: string, isCompanyAdmin: boolean): Promise<ApiResult<true>> {
  const res = await fetch(`${API_BASE}users/${userId}/set-company-admin`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({ isCompanyAdmin })
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { success: false, error: data?.error || res.statusText };
  return { success: true, data: true };
}

// Company Subscription Management
export async function apiGetCompanySubscription(companyId: string): Promise<ApiResult<{
  subscription_tier: string;
  subscriptionExpiry: string | null;
  isActive: boolean;
  company_name: string;
  total_users: number;
  active_users: number;
  status: 'trial' | 'active' | 'expired';
  daysRemaining?: number;
  daysOverdue?: number;
}>> {
  const res = await fetch(`${API_BASE}companies/${companyId}/subscription`, {
    method: 'GET',
    headers: authHeaders()
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { success: false, error: data?.error || res.statusText };
  return { success: true, data };
}

// File Upload for Company Logo
export async function apiUploadCompanyLogo(file: File): Promise<ApiResult<{ url: string }>> {
  try {
    // Step 1: Request a write SAS for the logo file
    const sasRes = await fetch(`/api/files/sas`, {
      method: 'POST',
      headers: authHeaders({ json: true }),
      body: JSON.stringify({ fileName: file.name, fileType: file.type || 'application/octet-stream', fileSizeBytes: file.size })
    })
    const sasData = await sasRes.json().catch(() => null)
    if (!sasRes.ok || !sasData?.uploadUrl || !sasData?.blobName) {
      return { success: false, error: (sasData && sasData.error) || sasRes.statusText }
    }

    // Step 2: Upload the file directly to Azure Blob via SAS URL
    const putRes = await fetch(sasData.uploadUrl, {
      method: 'PUT',
      headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    })
    if (!putRes.ok) {
      return { success: false, error: putRes.statusText }
    }

    // Step 3: Confirm upload to persist metadata
    const confirmRes = await fetch(`/api/files/confirm`, {
      method: 'POST',
      headers: authHeaders({ json: true }),
      body: JSON.stringify({
        blobName: sasData.blobName,
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSizeBytes: file.size,
        isPublic: true
      })
    })
    const confirmData = await confirmRes.json().catch(() => null)
    if (!confirmRes.ok || !confirmData?.file) {
      return { success: false, error: (confirmData && confirmData.error) || confirmRes.statusText }
    }

    const fileRecord = confirmData.file as any
    const logoUrl = fileRecord.azureCdnUrl || fileRecord.azureBlobUrl

    // Step 4: Update company branding with the logo URL
    const brandingRes = await fetch(`/api/companies/me/branding`, {
      method: 'PATCH',
      headers: authHeaders({ json: true }),
      body: JSON.stringify({ brandingLogoUrl: logoUrl })
    })
    const brandingData = await brandingRes.json().catch(() => null)
    if (!brandingRes.ok) {
      return { success: false, error: (brandingData && brandingData.error) || brandingRes.statusText }
    }

    return { success: true, data: { url: logoUrl } }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Upload failed' }
  }
}




// Mock payments/testing helpers
export async function apiMockActivateSubscription(params: { userId: string; tier: 'diy'|'diy_accountant'; days?: number }) {
  const res = await fetch(`${API_BASE}payments/mock/activate`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { success: false, error: data?.error || res.statusText };
  return { success: true, data };
}

export async function apiMockExpireSubscription(params: { userId: string }) {
  const res = await fetch(`${API_BASE}payments/mock/expire`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { success: false, error: data?.error || res.statusText };
  return { success: true, data };
}

export async function apiMockCancelSubscription(params: { userId: string }) {
  const res = await fetch(`${API_BASE}payments/mock/cancel`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { success: false, error: data?.error || res.statusText };
  return { success: true, data };
}
