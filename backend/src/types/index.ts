// Database entity types
export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'user';
  company_id: string;
  company_admin: 0 | 1;

  subscription_tier: 'free' | 'diy' | 'diy_accountant';
  subscription_expiry: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  domain: string;
  owner_id: string;
  description?: string | null;
  industry?: string | null;
  size?: string | null;
  website?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  tagline?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthToken {
  token: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

export interface Application {
  id: string;
  name: string;
  description: string | null;
  category: string;
  type: 'application' | 'template';
  url: string | null;
  download_url: string | null;
  file_name: string | null;
  file_size: string | null;
  subscription_tiers: string[];
  subdomain?: string | null;
  app_url?: string | null;
  icon_url?: string | null;
  screenshots?: string[] | null;
  developer?: string | null;
  version?: string | null;
  status?: string | null;
  deployed_at?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  download_url: string | null;
  file_name: string | null;
  file_size: string | null;
  file_type: string | null;
  icon_url?: string | null;
  subscription_tiers: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// API Request/Response types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: Omit<User, 'password_hash'>;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
}

export interface RegisterResponse {
  success: boolean;
  token: string;
  user: Omit<User, 'password_hash'>;
}

export interface MeResponse {
  success: boolean;
  user: Omit<User, 'password_hash'>;
}

export interface UserUpdateRequest {
  firstName: string;
  lastName: string;
  subscriptionTier: string;
  subscriptionExpiry: string;
  isActive: boolean;
}

// Database connection types
export interface DatabaseConfig {
  host: string;
  database: string;
  user: string;
  password: string;
  port?: number;
}

// JWT payload type
export interface JWTPayload {
  userId: string;
  email: string;
  companyId: string;
  companyAdmin?: boolean;
  role?: 'admin' | 'user';
  iat?: number;
  exp?: number;
}

// SSO JWT payload extension
export interface SSOJWTPayload extends JWTPayload {
  contextType?: 'domain' | 'master';
  domain?: string;
}

// SSO types for backend SDK
export interface SSOUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  company_id: string;
  subscription_tier: string;
  sso_provider?: string;
}

export interface SSOTokenRequest {
  code: string;
  provider: 'azure' | 'google' | 'local';
  redirect_uri?: string;
}

export interface SSOTokenResponse {
  success: boolean;
  user?: SSOUser;
  token?: string;
  error?: string;
}

export interface SSOHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    application: boolean;
    database: boolean;
    azure?: boolean;
    google?: boolean;
  };
}

export interface SSOConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authorizationEndpoint: string;
  tokenEndpoint: string;
}

// Database SSO entity types
export interface SSOSession {
  id: string;
  user_id: string;
  session_token: string;
  provider: string;
  created_at: string;
  expires_at: string;
}

export interface SSOProviderToken {
  id: string;
  user_id: string;
  provider: 'azure' | 'google' | 'local';
  access_token: string;
  refresh_token?: string;
  expires_at: Date;
  created_at: string;
}

export interface SSOMetrics {
  timestamp: string;
  summary: {
    totalSessions: number;
    activeSessions: number;
    expiringSoon: number;
    totalApplications: number;
    enabledApplications: number;
  };
  activity: {
    loginsLastHour: number;
    domainTokensLastHour: number;
    validationsLastHour: number;
    failuresLastHour: number;
    failureRate24h: number;
  };
  health: {
    status: 'healthy' | 'degraded' | 'warning';
    lastFailureAt?: string | null;
  };
}
