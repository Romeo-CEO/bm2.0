import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { ExternalLink, Lock, Loader2 } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';
import { apiSsoAuthenticate, apiSsoGetDomainToken, type SsoSession } from '@/lib/api';
import type { Application } from '@/types';

const SSO_SESSION_STORAGE_KEY = 'bizmanager.sso.session';

const readStoredSsoSession = (): SsoSession | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SSO_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { sessionId?: unknown; expiresAt?: unknown } | null;
    if (!parsed || typeof parsed.sessionId !== 'string' || !parsed.sessionId) {
      return null;
    }
    return {
      sessionId: parsed.sessionId,
      expiresAt: typeof parsed.expiresAt === 'string' ? parsed.expiresAt : undefined
    };
  } catch {
    return null;
  }
};

const storeSsoSession = (session: SsoSession) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      SSO_SESSION_STORAGE_KEY,
      JSON.stringify({
        sessionId: session.sessionId,
        expiresAt: session.expiresAt ?? null,
        storedAt: new Date().toISOString()
      })
    );
  } catch {
    // Ignore persistence errors (e.g. private browsing quota)
  }
};

const clearStoredSsoSession = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SSO_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures
  }
};

export const BusinessTools: React.FC = () => {
  const { user } = useAuth();
  const { applications } = useData();
  const tools = useMemo(() => applications.filter(a => a.type === 'application'), [applications]);
  const [launchingAppId, setLaunchingAppId] = React.useState<string | null>(null);

  const isBasic = (requiredTiers: string[]) => requiredTiers.includes('trial');
  const canAccessApp = (requiredTiers: string[]) => {
    if (!user) return false;
    // Platform admins have full access to all applications
    if (user.role === 'admin') return true;
    if (user.subscriptionTier === 'trial') return isBasic(requiredTiers);
    return requiredTiers.includes(user.subscriptionTier);
  };
  const goUpgrade = () => {
    window.location.href = '/subscribe';
  };

  const ensureSsoSession = async (forceRefresh = false): Promise<SsoSession> => {
    const masterToken = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    if (!masterToken) {
      throw new Error('You need to sign in again before launching applications.');
    }

    if (!forceRefresh) {
      const cached = readStoredSsoSession();
      if (cached?.sessionId) {
        return cached;
      }
    }

    const result = await apiSsoAuthenticate();
    if (!result.success || !result.data) {
      if (result.status === 401) {
        throw new Error('Your session has expired. Please sign in again.');
      }
      throw new Error(result.error || 'Failed to start a secure session for this application.');
    }

    storeSsoSession(result.data);
    return result.data;
  };

  const obtainDomainToken = async (domain: string): Promise<string> => {
    let session = await ensureSsoSession(false);
    let result = await apiSsoGetDomainToken(domain, session.sessionId);

    if (result.success && result.data) {
      return result.data.token;
    }

    const shouldRetry =
      result.status === 401 ||
      result.error === 'SSO session expired' ||
      result.error === 'SSO session not found';

    if (shouldRetry) {
      clearStoredSsoSession();
      session = await ensureSsoSession(true);
      result = await apiSsoGetDomainToken(domain, session.sessionId);
      if (result.success && result.data) {
        return result.data.token;
      }
    }

    throw new Error(result.error || 'Failed to obtain access for this application.');
  };

  const openApplication = async (app: Application) => {
    if (!app.url) {
      toast.error('This application is not yet configured with a launch URL.');
      return;
    }

    setLaunchingAppId(app.id);

    try {
      const url = app.url.startsWith('http') ? new URL(app.url) : new URL(app.url, window.location.origin);
      const token = await obtainDomainToken(url.host);
      url.searchParams.set('token', token);
      window.open(url.toString(), '_blank', 'noopener');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open the application right now.';
      toast.error(message.includes('application') || message.includes('session') ? message : `We couldn't open ${app.name}. ${message}`);
      clearStoredSsoSession();
    } finally {
      setLaunchingAppId(null);
    }
  };

  // Clear highlight after first render to avoid persistent ring
  React.useEffect(() => {
    const id = localStorage.getItem('highlightAppId');
    if (!id) return;
    const to = setTimeout(() => {
      if (localStorage.getItem('highlightAppId') === id) localStorage.removeItem('highlightAppId');
    }, 1500);
    return () => clearTimeout(to);
  }, []);

  // Scroll highlighted card into view, or notify if missing
  React.useEffect(() => {
    const highlightId = localStorage.getItem('highlightAppId');
    if (!highlightId) return;
    const el = document.getElementById(`app-card-${highlightId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const t = setTimeout(() => {
      const elLater = document.getElementById(`app-card-${highlightId}`);
      if (elLater) {
        elLater.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        toast.error('We could not find that application. It may have been removed.');
        localStorage.removeItem('highlightAppId');
      }
    }, 600);
    return () => clearTimeout(t);
  }, [tools.length]);


  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Business Tools
          </h1>
          <p className="text-base sm:text-lg text-gray-600 mt-2">
            Access your business applications and tools
          </p>
        </div>
      </div>


      {user?.subscriptionTier === 'trial' && (
        <Card className="border-0 bg-white/95 backdrop-blur shadow-2xl ring-1 ring-gray-100">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white text-sm shadow-md">⚡</div>
              <div>
                <CardTitle className="text-base md:text-lg bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Upgrade Required</CardTitle>
                <CardDescription className="text-gray-600 text-sm">Business tools are available with paid subscriptions. Upgrade to access these powerful applications.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Button
              onClick={goUpgrade}
              className="mt-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Upgrade Now
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((app) => { const locked = user?.subscriptionTier === 'trial' && !isBasic(app.subscriptionTiers); const highlight = localStorage.getItem('highlightAppId') === app.id; return (
          <Card id={`app-card-${app.id}`} key={app.id} className={cn("relative group border-0 shadow-2xl hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] transition-all duration-300 bg-white/95 backdrop-blur rounded-xl transform hover:-translate-y-1 ring-1 ring-gray-100 hover:ring-blue-200", locked && "ring-1 ring-amber-100", highlight && "ring-2 ring-blue-400") } aria-disabled={locked}>
            {locked && (
              <>
                <div className="pointer-events-none absolute inset-0 rounded-lg bg-white/40 backdrop-blur-[1px] z-[1]" aria-hidden="true" />
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-100/90 text-amber-800 border border-amber-200 rounded px-2 py-1 text-xs font-medium">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Premium
                </div>
              </>
            )}
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="text-xl sm:text-2xl p-2 rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 group-hover:from-blue-100 group-hover:to-purple-100 transition-colors flex-shrink-0 ring-1 ring-gray-200">🔗</div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base sm:text-lg font-semibold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent truncate">{app.name}</CardTitle>
                    <Badge variant="outline" className="mt-2 bg-gray-100 text-gray-700 border-gray-200 text-xs">
                      {app.category}
                    </Badge>
                  </div>
                </div>
                {app.subscriptionTiers.includes('diy_accountant') && !app.subscriptionTiers.includes('diy') && (
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 text-xs flex-shrink-0 ml-2">Pro</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4 sm:mb-6 text-gray-600 leading-relaxed text-sm sm:text-base">
                {app.description}
              </CardDescription>

              <Button
                className={cn(
                  "w-full transition-all duration-200 font-medium",
                  canAccessApp(app.subscriptionTiers)
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                )}
                onClick={() => openApplication(app)}
                disabled={!canAccessApp(app.subscriptionTiers) || launchingAppId === app.id}
                variant={canAccessApp(app.subscriptionTiers) ? "default" : "secondary"}
              >
                {launchingAppId === app.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening…
                  </>
                ) : canAccessApp(app.subscriptionTiers) ? (
                  <>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Application
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    {isBasic(app.subscriptionTiers) ? 'Open Application' : 'Upgrade Required'}
                  </>
                )}
              </Button>

              {!canAccessApp(app.subscriptionTiers) && !isBasic(app.subscriptionTiers) && (
                <Button
                  className="w-full mt-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg relative z-10"
                  onClick={goUpgrade}
                >
                  Upgrade
                </Button>
              )}

              {!canAccessApp(app.subscriptionTiers) && (
                <p className="text-xs text-gray-500 mt-3 text-center">
                  Requires appropriate subscription tier
                </p>
              )}
            </CardContent>
          </Card>
        );
        })}
      </div>
    </div>
  );
};