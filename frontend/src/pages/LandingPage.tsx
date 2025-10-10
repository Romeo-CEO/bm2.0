import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Star,
  ArrowRight,
  Zap,
  Shield,
  Users,
  BarChart3,
  Wrench,
  FileText,
  Calculator,
  ChevronDown,
  Menu,
  X,
  Play,
  Sparkles,
  TrendingUp,
  Globe,
  Lock,
  Loader2,
  AlertCircle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';

const PlaceholderCard: React.FC = () => (
  <Card className="group border border-gray-100 shadow-lg bg-white/90 backdrop-blur">
    <CardHeader className="pb-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>
    </CardHeader>
    <CardContent className="pt-0 space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-10/12" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-24 rounded" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-10 w-full rounded-md" />
    </CardContent>
  </Card>
);

import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { apiGetPublicApplicationsPaged, apiGetPublicTemplatesPaged, type PublicAppItem, type PublicTemplateItem } from '@/lib/api';

export const LandingPage: React.FC = () => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const appsSectionRef = useRef<HTMLDivElement | null>(null);
  const templatesSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);
  // Capture intent from query and stash; auth modals will then lead user into app where intent can be resolved
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const intent = params.get('intent');
    if (intent) {
      localStorage.setItem('postAuthIntent', decodeURIComponent(intent));
    }
  }, []);


  // Map visible labels to API category keys
  const labelToKey: Record<string, string> = {
    'Accounting & Finance': 'accounting',
    'Human Resources': 'hr',
    'Sales & Marketing': 'sales',
    'Inventory Management': 'inventory',
    'Project Management': 'project',
    'Calculators': 'calculators',
    'General': 'general',
  };

  // Featured sections state
  const [apps, setApps] = useState<PublicAppItem[]>([]);
  const [appsCategory, setAppsCategory] = useState<string>('');
  const [appsPage, setAppsPage] = useState(1);
  const [appsPageSize, setAppsPageSize] = useState(9);



  const [appsTotal, setAppsTotal] = useState(0);

  const [templates, setTemplates] = useState<PublicTemplateItem[]>([]);
  const [templatesCategory, setTemplatesCategory] = useState<string>('');
  const [templatesPage, setTemplatesPage] = useState(1);
  const [templatesPageSize, setTemplatesPageSize] = useState(9);
  const [templatesTotal, setTemplatesTotal] = useState(0);

  // Loading & error states
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const fetchApps = React.useCallback(async () => {
    setAppsLoading(true);
    setAppsError(null);
    try {
      const res = await apiGetPublicApplicationsPaged({ type: 'application', category: appsCategory || undefined, page: appsPage, pageSize: appsPageSize, sortBy: 'date', sortDir: 'desc' });
      if (res.success && res.data) {
        setApps(res.data.items);
        setAppsTotal(res.data.total);
      } else {
        setApps([]);
        setAppsTotal(0);
        setAppsError(res.error || 'Failed to load applications');
      }
    } catch (e: unknown) {
      setAppsError((e as Error)?.message || 'Failed to load applications');
      setApps([]);
      setAppsTotal(0);
    } finally {
      setAppsLoading(false);
    }
  }, [appsCategory, appsPage, appsPageSize]);

  const fetchTemplates = React.useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const res = await apiGetPublicTemplatesPaged({ category: templatesCategory || undefined, page: templatesPage, pageSize: templatesPageSize, sortBy: 'date', sortDir: 'desc' });
      if (res.success && res.data) {
        setTemplates(res.data.items);
        setTemplatesTotal(res.data.total);
      } else {
        setTemplates([]);
        setTemplatesTotal(0);
        setTemplatesError(res.error || 'Failed to load templates');
      }
    } catch (e: unknown) {
      setTemplatesError((e as Error)?.message || 'Failed to load templates');
      setTemplates([]);
      setTemplatesTotal(0);
    } finally {
      setTemplatesLoading(false);
    }
  }, [templatesCategory, templatesPage, templatesPageSize]);

  useEffect(() => { fetchApps(); }, [fetchApps]);
  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleCategorySelect = (section: 'apps' | 'templates', label: string) => {
    const key = labelToKey[label] || '';
    if (section === 'apps') {
      setAppsCategory(key);
      setAppsPage(1);
      setTimeout(() => appsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    } else {
      setTemplatesCategory(key);
      setTemplatesPage(1);
      setTimeout(() => templatesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    }
  };
  // On initial mount, restore filters from URL if present
  const restoredRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const appsCat = params.get('apps_category') || '';
    const templatesCat = params.get('templates_category') || '';
    if (appsCat) setAppsCategory(appsCat);
    if (templatesCat) setTemplatesCategory(templatesCat);
    restoredRef.current = true;
  }, []);

  // Sync filters to URL; push for user changes, replace on first paint
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (appsCategory) params.set('apps_category', appsCategory); else params.delete('apps_category');
    if (templatesCategory) params.set('templates_category', templatesCategory); else params.delete('templates_category');
    const qs = params.toString();
    const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    if (restoredRef.current) window.history.pushState(null, '', newUrl); else window.history.replaceState(null, '', newUrl);
  }, [appsCategory, templatesCategory]);

  // Respond to back/forward navigation by re-reading the URL
  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      setAppsCategory(params.get('apps_category') || '');
      setTemplatesCategory(params.get('templates_category') || '');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);


  const categories = [
    {
      name: 'Business Tools',
      description: 'All Categories',
      items: ['Accounting & Finance', 'Human Resources', 'Sales & Marketing', 'Inventory Management', 'Project Management', 'Calculators', 'General']
    },
    {
      name: 'Templates',
      description: 'All Categories',
      items: ['Accounting & Finance', 'Human Resources', 'Sales & Marketing', 'Inventory Management', 'Project Management', 'General']
    }
  ];



  const pricingPlans = [
    {
      name: 'DIY',
      price: 'R100',
      period: '/month',
      description: 'Perfect for small businesses getting started',
      features: [
        'Access to all business applications',
        'Download all business templates',
        'All financial & business calculators',
        'Email support',
        'Basic analytics'
      ],
      popular: false
    },
    {
      name: 'DIY + Accountant',
      price: 'R2,000',
      period: '/month',
      description: 'Complete solution with human expert assistance',
      features: [
        'Everything in DIY plan',
        'Human expert assistance',
        'Help with Financial Statements',
        'SARS representations support',
        'Audit assistance',
        'Priority expert support'
      ],
      popular: true
    }
  ];

  if (authMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div className="w-full max-w-md animate-in fade-in duration-500">
          {authMode === 'login' ? (
            <LoginForm onSwitchToRegister={() => setAuthMode('register')} />
          ) : (
            <RegisterForm onSwitchToLogin={() => setAuthMode('login')} />
          )}
          <div className="text-center mt-4">
            <button
              onClick={() => setAuthMode(null)}
              className="text-sm text-blue-600 hover:text-blue-500 transition-colors duration-200"
            >
              ← Back to homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-white/95 via-blue-50/30 to-purple-50/30 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-lg border-b border-blue-100/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 via-purple-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 bg-clip-text text-transparent">
              SaaS Platform
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {categories.map((category) => (
              <DropdownMenu key={category.name}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-1 text-gray-700 hover:text-blue-600 hover:bg-blue-50/50 transition-all duration-200">
                    {category.name}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64">
                  <div className="p-3">
                    <p className="text-sm font-medium mb-2">{category.description}</p>
                    <hr className="mb-3 border-gray-200" />
                    <div className="space-y-1">
                      {category.items.map((item) => (
                        <DropdownMenuItem
                          key={item}
                          className="cursor-pointer"
                          onClick={() => handleCategorySelect(category.name === 'Business Tools' ? 'apps' : 'templates', item)}
                        >
                          {item}
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Button variant="ghost" onClick={() => setAuthMode('login')} className="text-gray-700 hover:text-blue-600 hover:bg-blue-50/50 transition-all duration-200">
              Sign In
            </Button>
            <Button onClick={() => setAuthMode('register')} className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 hover:from-blue-700 hover:via-purple-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-200 text-white">
              Start Free Trial
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-blue-100/50 bg-gradient-to-b from-white/95 to-blue-50/20 backdrop-blur p-6 space-y-4 animate-in slide-in-from-top duration-300">
            {/* Mobile Categories */}
            {categories.map((category) => (
              <div key={category.name} className="space-y-3">
                <Button
                  variant="ghost"
                  className="w-full justify-start font-semibold text-gray-700 hover:text-blue-600 hover:bg-blue-50/50 transition-all duration-200"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    (category.name === 'Business Tools' ? appsSectionRef : templatesSectionRef).current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  {category.name}
                </Button>
                <div className="pl-4 space-y-2">
                  {category.items.slice(0, 2).map((item) => (
                    <Button
                      key={item}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-sm text-gray-600 hover:bg-gray-50"
                      onClick={() => { handleCategorySelect(category.name === 'Business Tools' ? 'apps' : 'templates', item); setMobileMenuOpen(false); }}
                    >
                      • {item}
                    </Button>
                  ))}
                </div>
              </div>
            ))}

            <div className="border-t border-blue-100/50 pt-6 mt-6 space-y-3">
              <Button
                variant="ghost"
                className="w-full justify-start font-semibold text-gray-700 hover:text-blue-600 hover:bg-blue-50/50 transition-all duration-200"
                onClick={() => {
                  setAuthMode('login');
                  setMobileMenuOpen(false);
                }}
              >
                Sign In
              </Button>
              <Button
                className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 hover:from-blue-700 hover:via-purple-700 hover:to-blue-800 text-white shadow-lg transition-all duration-200"
                onClick={() => {
                  setAuthMode('register');
                  setMobileMenuOpen(false);
                }}
              >
                Start Free Trial
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative py-24 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse" style={{animationDelay: '2s'}}></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse" style={{animationDelay: '4s'}}></div>
        </div>
        {/* Smooth transition overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent"></div>

        <div className="container mx-auto px-4 text-center relative z-10">
          <div className={cn(
            "transition-all duration-1000 ease-out",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}>
            <Badge className="mb-6 bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0 shadow-lg" variant="outline">
              <Sparkles className="w-4 h-4 mr-2" />
              Start your 1-day free trial
            </Badge>
            <h1 className="text-6xl md:text-7xl font-bold tracking-tight mb-8 leading-tight">
              All Your Business Tools<br />
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 bg-clip-text text-transparent">
                In One Platform
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
              Access powerful web applications, download professional templates, and use advanced calculators.
              Everything your business needs to succeed, all in one seamless platform.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Button
                size="lg"
                onClick={() => setAuthMode('register')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 px-8 py-4 text-lg"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => setAuthMode('login')}
                className="border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-all duration-300 px-8 py-4 text-lg"
              >
                Sign In
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="flex items-center justify-center gap-8 text-gray-500">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-500" />
                <span className="text-sm font-medium">Enterprise Security</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-medium">99.9% Uptime</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-500" />
                <span className="text-sm font-medium">10,000+ Users</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Applications Section */}
          <section ref={appsSectionRef} id="featured-apps" className="py-24 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative">
            <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-white/50 to-transparent"></div>
            <div className="container mx-auto px-4">
              <div className="text-center mb-12">
                <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 bg-clip-text text-transparent">Featured Applications</h2>
                <p className="text-lg text-gray-600">Explore powerful web applications. Click a category above to filter.</p>
              </div>

              <div className="flex items-center justify-between mb-6">
                <div className="text-sm text-gray-600 flex items-center gap-3">
                  {appsCategory ? (
                    <span className="inline-flex items-center gap-2">Filtering by: <span className="font-medium capitalize">{appsCategory}</span>
                      <button aria-label="Clear filter" className="ml-1 h-5 w-5 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700" onClick={() => { setAppsCategory(''); setAppsPage(1); }}>×</button>
                    </span>
                  ) : (
                    <span>All categories</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span>Page size:</span>
                  <select className="border rounded h-9 px-2" value={appsPageSize} onChange={(e)=>{ setAppsPageSize(Number(e.target.value)); setAppsPage(1); }}>
                    {[6,9,12,15,18].map(n => (<option key={n} value={n}>{n}</option>))}
                  </select>
                </div>
              </div>

              {appsLoading ? (
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <PlaceholderCard key={i} />
                  ))}
                </div>
              ) : appsError ? (
                <div className="flex items-center justify-center py-12 text-red-600"><AlertCircle className="h-5 w-5 mr-2"/> {appsError}</div>
              ) : apps.length === 0 ? (
                <div className="text-center text-gray-600 py-12">No applications found for this selection.</div>
              ) : (
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                  {apps.map((a) => (
                    <Card key={a.id} className="group hover:shadow-2xl transition-all duration-500 border border-gray-100 shadow-lg bg-white/90 backdrop-blur hover:-translate-y-2 hover:border-blue-200/50">
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xl text-gray-900 font-semibold">{a.name}</CardTitle>
                          <div className="flex gap-2">
                            {a.subscriptionTiers?.map(t => (<Badge key={t} variant="outline">{t === 'diy' ? 'DIY' : t === 'diy_accountant' ? 'DIY + Accountant' : t}</Badge>))}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-3">
                        <p className="text-gray-600 leading-relaxed text-base line-clamp-3">{a.description}</p>
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="capitalize">{a.category}</Badge>
                          {a.price ? <span className="text-sm font-semibold text-gray-700">R{a.price}</span> : <span className="text-sm text-gray-500">Included</span>}
                        </div>
                        <Button className="w-full" onClick={() => {
                          const intentObj = { id: a.id, type: a.type } as const;
                          localStorage.setItem('postAuthIntent', JSON.stringify(intentObj));
                          if (isAuthenticated) {
                            navigate('/');
                            window.location.hash = 'business-tools';
                          } else {
                            // open auth and persist intent in URL
                            setAuthMode('register');
                            const params = new URLSearchParams(window.location.search);
                            params.set('intent', JSON.stringify(intentObj));
                            const qs = params.toString();
                            window.history.pushState(null, '', `${window.location.pathname}?${qs}`);
                          }
                        }}>Use</Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              <div className="flex justify-center items-center gap-3 mt-8">
                <Button variant="outline" disabled={appsPage<=1} onClick={()=>setAppsPage(p=>Math.max(1,p-1))}>Prev</Button>
                <span className="text-sm">Page {appsPage} of {Math.max(1, Math.ceil(appsTotal / appsPageSize))}</span>
                <Button variant="outline" disabled={appsPage >= Math.ceil(appsTotal / appsPageSize)} onClick={()=>setAppsPage(p=>p+1)}>Next</Button>
              </div>
            </div>
          </section>

          {/* Featured Templates Section */}
          <section ref={templatesSectionRef} id="featured-templates" className="py-24 bg-white relative">
            <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-blue-50/50 to-transparent"></div>
            <div className="container mx-auto px-4">
              <div className="text-center mb-12">
                <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Featured Templates</h2>
                <p className="text-lg text-gray-600">Click a category above to filter templates.</p>
              </div>

              <div className="flex items-center justify-between mb-6">
                <div className="text-sm text-gray-600 flex items-center gap-3">
                  {templatesCategory ? (
                    <span className="inline-flex items-center gap-2">Filtering by: <span className="font-medium capitalize">{templatesCategory}</span>
                      <button aria-label="Clear filter" className="ml-1 h-5 w-5 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700" onClick={() => { setTemplatesCategory(''); setTemplatesPage(1); }}>×</button>
                    </span>
                  ) : (
                    <span>All categories</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span>Page size:</span>
                  <select className="border rounded h-9 px-2" value={templatesPageSize} onChange={(e)=>{ setTemplatesPageSize(Number(e.target.value)); setTemplatesPage(1); }}>
                    {[6,9,12,15,18].map(n => (<option key={n} value={n}>{n}</option>))}
                  </select>
                </div>
              </div>

              {templatesLoading ? (
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <PlaceholderCard key={i} />
                  ))}
                </div>
              ) : templatesError ? (
                <div className="flex items-center justify-center py-12 text-red-600"><AlertCircle className="h-5 w-5 mr-2"/> {templatesError}</div>
              ) : templates.length === 0 ? (
                <div className="text-center text-gray-600 py-12">No templates found for this selection.</div>
              ) : (
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                  {templates.map((t) => (
                    <Card key={t.id} className="group hover:shadow-2xl transition-all duration-500 border border-gray-100 shadow-lg bg-white/90 backdrop-blur hover:-translate-y-2 hover:border-blue-200/50">
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xl text-gray-900 font-semibold">{t.name}</CardTitle>
                          <div className="flex gap-2">
                            {t.subscriptionTiers?.map(s => (<Badge key={s} variant="outline">{s === 'diy' ? 'DIY' : s === 'diy_accountant' ? 'DIY + Accountant' : s}</Badge>))}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-3">
                        <p className="text-gray-600 leading-relaxed text-base line-clamp-3">{t.description}</p>
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="capitalize">{t.category}</Badge>
                        </div>
                        <Button className="w-full" onClick={() => {
                          const intentObj = { id: t.id, type: 'template' as const };
                          localStorage.setItem('postAuthIntent', JSON.stringify(intentObj));
                          if (isAuthenticated) {
                            navigate('/');
                            window.location.hash = 'templates';
                            localStorage.setItem('autoDownloadTemplateId', t.id);
                          } else {
                            setAuthMode('register');
                            const params = new URLSearchParams(window.location.search);
                            params.set('intent', JSON.stringify(intentObj));
                            const qs = params.toString();
                            window.history.pushState(null, '', `${window.location.pathname}?${qs}`);
                          }
                        }}>Download</Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              <div className="flex justify-center items-center gap-3 mt-8">
                <Button variant="outline" disabled={templatesPage<=1} onClick={()=>setTemplatesPage(p=>Math.max(1,p-1))}>Prev</Button>
                <span className="text-sm">Page {templatesPage} of {Math.max(1, Math.ceil(templatesTotal / templatesPageSize))}</span>
                <Button variant="outline" disabled={templatesPage >= Math.ceil(templatesTotal / templatesPageSize)} onClick={()=>setTemplatesPage(p=>p+1)}>Next</Button>
              </div>
            </div>
          </section>

      {/* Pricing Section */}
      <section className="py-24 bg-gradient-to-br from-gray-50 to-blue-50 relative">
        {/* Smooth transition overlay from templates */}
        <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-white/50 to-transparent"></div>
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Choose the plan that fits your business needs. Start with a free trial and upgrade anytime.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 max-w-5xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <Card
                key={index}
                className={cn(
                  "group hover:shadow-2xl transition-all duration-500 border border-gray-100 shadow-lg bg-white/90 backdrop-blur hover:-translate-y-2 hover:border-blue-200/50",
                  plan.popular ? 'ring-2 ring-blue-500 ring-opacity-50 relative' : ''
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0 shadow-lg px-4 py-1">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-6">
                  <CardTitle className="text-3xl text-gray-900 font-bold">{plan.name}</CardTitle>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      {plan.price}
                    </span>
                    <span className="text-gray-600 text-lg">{plan.period}</span>
                  </div>
                  <CardDescription className="text-gray-600 text-lg leading-relaxed">
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        </div>
                        <span className="text-gray-700 font-medium">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={cn(
                      "w-full py-4 text-lg font-semibold transition-all duration-300 transform hover:scale-105",
                      plan.popular
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-xl hover:shadow-2xl"
                        : "bg-white border-2 border-blue-500 text-blue-600 hover:bg-blue-50 hover:border-blue-600"
                    )}
                    onClick={() => setAuthMode('register')}
                  >
                    Start Free Trial
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 text-white relative overflow-hidden">
        {/* Smooth transition overlay from pricing */}
        <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-blue-50/50 to-transparent"></div>
        {/* Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-10 right-10 w-64 h-64 bg-white/10 rounded-full mix-blend-multiply filter blur-xl"></div>
          <div className="absolute bottom-10 left-10 w-64 h-64 bg-white/10 rounded-full mix-blend-multiply filter blur-xl"></div>
        </div>

        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Transform Your Business?</h2>
          <p className="text-xl md:text-2xl mb-10 opacity-90 max-w-3xl mx-auto leading-relaxed">
            Join thousands of businesses already using our platform to streamline their operations and accelerate growth.
          </p>
          <div className="flex justify-center">
            <Button
              size="lg"
              variant="secondary"
              onClick={() => setAuthMode('register')}
              className="bg-white text-blue-700 hover:bg-gray-50 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 px-8 py-4 text-lg font-semibold border-2 border-white/20"
            >
              Start Your Free Trial Today
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 bg-gray-900 text-white">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                <Zap className="h-7 w-7 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                SaaS Platform
              </span>
            </div>
            <p className="text-gray-400 text-lg">
              © 2024 SaaS Platform. All rights reserved.
            </p>
            <div className="flex items-center justify-center gap-6 mt-6 text-gray-400">
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Privacy Policy
              </span>
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Terms of Service
              </span>
              <span className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Status
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};