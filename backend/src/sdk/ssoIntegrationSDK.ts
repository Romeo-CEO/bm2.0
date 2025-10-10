/**
 * SSO Integration SDK for Business Suite Applications
 *
 * This SDK provides a simple, type-safe interface for applications to integrate
 * with the Unified Single Sign-On infrastructure.
 *
 * Usage:
 * ```typescript
 * import { SSOIntegrationSDK } from '@business-suite/sso';
 *
 * const sdk = new SSOIntegrationSDK({
 *   appName: 'accounting-app',
 *   domain: 'accounting.business-suite.com',
 *   ssoEndpoint: '/api/sso'
 * });
 *
 * const user = await sdk.authenticate();
 * ```
 */

// DOM Types for Node.js environment
declare const window: {
  location: {
    origin: string;
    hostname: string;
    protocol: string;
  };
};

declare const localStorage: {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export interface SSOSDKConfig {
  appName: string;
  domain: string;
  ssoEndpoint?: string;
  fallbackUrl?: string;
  debug?: boolean;
}

export interface SSOUser {
  id: string;
  role: string;
  permissions: string[];
  companyId?: string;
  subscriptionTier: string;
}

export interface SSOTokenResponse {
  success: boolean;
  token?: string;
  user?: SSOUser;
  error?: string;
}

/**
 * SSO Events for application integration
 */
export type SSOEventType =
  | 'user_authenticated'
  | 'authentication_failed'
  | 'session_expired'
  | 'fallback_triggered';

export interface SSOEvent {
  type: SSOEventType;
  user?: SSOUser;
  error?: string;
  timestamp: number;
}

export interface SSOEventListener {
  (event: SSOEvent): void;
}

/**
 * Main SSO Integration SDK Class
 */
export class SSOIntegrationSDK {
  private config: SSOSDKConfig;
  private tokenCache: Map<string, SSOTokenResponse> = new Map();
  private eventListeners: SSOEventListener[] = [];
  private sessionTimer?: NodeJS.Timeout;

  constructor(config: SSOSDKConfig) {
    this.config = {
      ssoEndpoint: '/api/sso',
      debug: false,
      ...config
    };

    this.log('SDK initialized for', config.appName);
  }

  /**
   * Authenticate user and get SSO token
   */
  async authenticate(sessionId?: string): Promise<SSOUser | null> {
    try {
      if (sessionId && this.tokenCache.has(sessionId)) {
        const cached = this.tokenCache.get(sessionId);
        if (cached && cached.token && this.isTokenValid(cached.token)) {
          this.log('Using cached token');
          return cached.user || null;
        }
      }

      const user = await this._authenticatePlatform(sessionId);

      if (user) {
        this.emitEvent({
          type: 'user_authenticated',
          user,
          timestamp: Date.now()
        });

        // Setup session monitoring
        this.monitorSession(sessionId || '');
      }

      return user;

    } catch (error) {
      this.log('Authentication failed:', error);

      this.emitEvent({
        type: 'authentication_failed',
        error: String(error),
        timestamp: Date.now()
      });

      // Try fallback authentication
      try {
        return await this._authenticateFallback();
      } catch (fallbackError) {
        this.log('Fallback authentication failed:', fallbackError);

        this.emitEvent({
          type: 'fallback_triggered',
          error: 'Authentication and fallback both failed',
          timestamp: Date.now()
        });

        return null;
      }
    }
  }

  /**
   * Private method for platform authentication
   */
  private async _authenticatePlatform(sessionId?: string): Promise<SSOUser | null> {
    const ssoUrl = this.buildSSOUrl('/validate/default-domain');

    const requestBody = {
      sessionId: sessionId || this.getStoredSessionId()
    };

    const response = await fetch(ssoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Name': this.config.appName,
        'X-App-Domain': this.config.domain
      },
      body: JSON.stringify(requestBody),
      credentials: 'include' // Send cookies for CORS
    });

    if (!response.ok) {
      throw new Error(`SSO authentication failed: ${response.status}`);
    }

    const data: SSOTokenResponse = await response.json() as SSOTokenResponse;

    if (!data.success) {
      throw new Error(data.error || 'SSO authentication failed');
    }

    this.tokenCache.set(sessionId || 'default', data);

    return data.user || null;
  }

  /**
   * Private method for fallback authentication
   */
  private async _authenticateFallback(): Promise<SSOUser | null> {
    if (!this.config.fallbackUrl) {
      return null;
    }

    const response = await fetch(this.config.fallbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Name': this.config.appName,
        'X-App-Domain': this.config.domain
      },
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Fallback authentication failed: ${response.status}`);
    }

    const data = await response.json() as SSOTokenResponse;

    if (!data.success) {
      throw new Error(data.error || 'Fallback authentication failed');
    }

    return data.user || null;
  }

  /**
   * Check if token is still valid
   */
  private isTokenValid(token: string): boolean {
    try {
      // Simple token validation - in production check expiration
      return token.length > 20; // Basic length check
    } catch (error) {
      this.log('Token validation error:', error);
      return false;
    }
  }

  /**
   * Monitor session and trigger events
   */
  private monitorSession(sessionId: string): void {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
    }

    // Check session every 5 minutes
    this.sessionTimer = setInterval(async () => {
      const cached = this.tokenCache.get(sessionId);

      if (!cached || !cached.token || !this.isTokenValid(cached.token)) {
        this.emitEvent({
          type: 'session_expired',
          timestamp: Date.now()
        });

        this.tokenCache.delete(sessionId);
        clearInterval(this.sessionTimer);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Event system for application integration
   */
  public addEventListener(listener: SSOEventListener): void {
    this.eventListeners.push(listener);
  }

  public removeEventListener(listener: SSOEventListener): void {
    this.eventListeners = this.eventListeners.filter(l => l !== listener);
  }

  private emitEvent(event: SSOEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        this.log('Event listener error:', error);
      }
    });
  }

  /**
   * Logout user from SSO
   */
  async logout(): Promise<void> {
    const logoutUrl = this.buildSSOUrl('/logout');

    try {
      await fetch(logoutUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Name': this.config.appName
        },
        credentials: 'include'
      });

      // Clear local cache
      this.tokenCache.clear();

      if (this.sessionTimer) {
        clearInterval(this.sessionTimer);
      }

    } catch (error) {
      this.log('Logout error:', error);
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const healthUrl = this.buildSSOUrl('/health');

    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'X-App-Name': this.config.appName,
          'X-App-Domain': this.config.domain
        },
        credentials: 'include'
      });

      if (response.ok) {
        const health = await response.json() as { services: { application: boolean } };
        return health.services.application || false;
      }

      return false;

    } catch (error) {
      this.log('Health check error:', error);
      return false;
    }
  }

  /**
   * Get current user context
   */
  async getUserContext(): Promise<SSOUser | null> {
    const contextUrl = this.buildSSOUrl('/user/context');

    try {
      const response = await fetch(contextUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Name': this.config.appName
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Context API failed: ${response.status}`);
      }

      const data = await response.json() as SSOTokenResponse;

      if (data.success) {
        return data.user || null;
      }

      return null;

    } catch (error) {
      this.log('Get context error:', error);
      return null;
    }
  }

  /**
   * Build SSO URL
   */
  private buildSSOUrl(path: string): string {
    const origin = window.location.origin;
    const ssoUrl = `${origin}${this.config.ssoEndpoint}${path}`;
    return ssoUrl;
  }

  /**
   * Get stored session ID from localStorage or similar
   */
  private getStoredSessionId(): string {
    try {
      return localStorage.getItem('sso_session_id') || '';
    } catch (error) {
      this.log('Could not access localStorage:', error);
      return '';
    }
  }

  /**
   * Store session ID
   */
  private setStoredSessionId(sessionId: string): void {
    try {
      localStorage.setItem('sso_session_id', sessionId);
    } catch (error) {
      this.log('Could not store session ID:', error);
    }
  }

  /**
   * Debug logging
   */
  private log(message: string, ...args: any[]): void {
    if (this.config.debug) {
      console.log(`[SSO-${this.config.appName}]`, message, ...args);
    }
  }
}

/**
 * React Hook for SSO Integration
 * Usage:
 * ```tsx
 * const { user, isAuthenticated, logout } = useSSO(config);
 * ```
 */
export function useSSO(config: SSOSDKConfig) {
  const [user, setUser] = React?.useState(null);
  const [isAuthenticated, setIsAuthenticated] = React?.useState(false);
  const [isLoading, setIsLoading] = React?.useState(true);

  // Initialize SDK
  const sdk = React?.useMemo(() => new SSOIntegrationSDK(config), [config]);

  // Set up event listeners
  React?.useEffect(() => {
    if (!sdk) return;

    const handleEvent = (event: SSOEvent) => {
      switch (event.type) {
        case 'user_authenticated':
          if (event.user) {
            setUser(event.user);
            setIsAuthenticated(true);
            setIsLoading(false);
          }
          break;

        case 'authentication_failed':
        case 'session_expired':
          setUser(null);
          setIsAuthenticated(false);
          setIsLoading(false);
          break;
      }
    };

    sdk.addEventListener(handleEvent);

    return () => {
      sdk.removeEventListener(handleEvent);
    };
  }, [sdk]);

  // Initial authentication check
  React?.useEffect(() => {
    if (!sdk) return;

    const initAuth = async () => {
      try {
        const authenticated = await sdk.authenticate();

        if (authenticated) {
          setUser(authenticated);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Initial authentication failed:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [sdk]);

  const logout = React?.useCallback(async (): Promise<void> => {
    if (!sdk) return;

    try {
      await sdk.logout();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [sdk]);

  // For environments without React (plain JavaScript)
  if (!React) {
    return {
      user: null,
      isAuthenticated: false,
      isLoading: true,
      logout: () => Promise.resolve()
    };
  }

  return {
    user,
    isAuthenticated,
    isLoading,
    logout
  };
}

/**
 * Utility function for plain JavaScript integration
 */
export async function initSSO(config: SSOSDKConfig): Promise<SSOIntegrationSDK> {
  const sdk = new SSOIntegrationSDK(config);

  // Set up basic event logging
  sdk.addEventListener((event) => {
    console.log('SSO Event:', event);
  });

  return sdk;
}

/**
 * Global SSO Manager for multi-application coordination
 */
export class SSOCoordinator {
  private static instance: SSOCoordinator;
  private registeredApps: Map<string, SSOIntegrationSDK> = new Map();

  static getInstance(): SSOCoordinator {
    if (!SSOCoordinator.instance) {
      SSOCoordinator.instance = new SSOCoordinator();
    }
    return SSOCoordinator.instance;
  }

  /**
   * Register an application with the SSO coordinator
   */
  registerApplication(appName: string, sdk: SSOIntegrationSDK): void {
    this.registeredApps.set(appName, sdk);
  }

  /**
   * Global logout across all registered applications
   */
  async globalLogout(): Promise<void> {
    const logoutPromises = Array.from(this.registeredApps.values())
      .map(sdk => sdk.logout().catch(error => console.error('App logout failed:', error)));

    await Promise.all(logoutPromises);
  }

  /**
   * Get authentication status across all applications
   */
  async getGlobalStatus(): Promise<Record<string, boolean>> {
    const statusPromises = Array.from(this.registeredApps.entries())
      .map(async ([appName, sdk]) => {
        try {
          const isAuthenticated = await sdk.isAuthenticated();
          return [appName, isAuthenticated] as [string, boolean];
        } catch (error) {
          return [appName, false] as [string, boolean];
        }
      });

    const results = await Promise.all(statusPromises);
    return Object.fromEntries(results);
  }

  /**
   * Health check across all SSO services
   */
  async checkSSOStatus(): Promise<boolean> {
    try {
      const healthUrl = `/api/sso/health`;
      const response = await fetch(healthUrl);

      if (response.ok) {
        const health = await response.json() as { status: string };
        return health.status === 'healthy';
      }

      return false;
    } catch (error) {
      console.error('SSO health check failed:', error);
      return false;
    }
  }
}

export const ssoCoordinator = SSOCoordinator.getInstance();

// Declare React if not available (for environments without React)
declare const React: any;
