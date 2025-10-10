import React, { useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { BusinessTools } from '@/components/business-tools/BusinessTools';
import { TemplatesManager } from '@/components/templates/TemplatesManager';
import { FinancialCalculators } from '@/components/calculators/FinancialCalculators';
import { BusinessCalculators } from '@/components/calculators/BusinessCalculators';
import { AdminPanel } from '@/components/admin/AdminPanel';
import { CompanyProfile } from '@/components/company/CompanyProfile';
import { CompanyUserManagement } from '@/components/company/CompanyUserManagement';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/sonner';

export const MainApp: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const intentProcessedRef = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  // Sync activeTab with location.hash for deep-linking and in-app navigation
  React.useEffect(() => {
    const applyHash = () => {
      const hash = (window.location.hash || '').replace('#', '');
      if (!hash) return;
      setActiveTab(hash);
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);
  // Resolve any post-auth intent (from landing/public browse)
  React.useEffect(() => {
    if (intentProcessedRef.current) return;
    // Ensure we only run this once we know the user is authenticated (works for both login and register)
    if (!isAuthenticated) {
      console.log('[MainApp] Skipping intent resolution: not authenticated yet');
      return;
    }
    try {
      const raw = localStorage.getItem('postAuthIntent');
      console.log('[MainApp] Checking postAuthIntent:', raw);
      if (!raw) return;
      const intent = JSON.parse(raw) as { id: string; type: 'application'|'template' };
      console.log('[MainApp] Parsed intent:', intent);
      if (intent.type === 'application') {
        console.log('[MainApp] Resolving application intent: set tab -> business-tools, hash, highlight');
        setActiveTab('business-tools');
        window.location.hash = 'business-tools';
        localStorage.setItem('highlightAppId', intent.id);
        toast.success('Taking you to the application you selected...');
      } else if (intent.type === 'template') {
        console.log('[MainApp] Resolving template intent: set tab -> templates, hash, auto-download');
        setActiveTab('templates');
        window.location.hash = 'templates';
        localStorage.setItem('autoDownloadTemplateId', intent.id);
        toast.success('Preparing your template download...');
      }
      localStorage.removeItem('postAuthIntent');
      intentProcessedRef.current = true;
      console.log('[MainApp] Intent processed and cleared');
    } catch (e) {
      console.error('[MainApp] Failed to resolve postAuthIntent', e);
      localStorage.removeItem('postAuthIntent');
    }
  }, [isAuthenticated]);


  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'business-tools':
        return <BusinessTools />;
      case 'templates':
        return <TemplatesManager />;
      case 'calculators':
        return (
          <div className="space-y-8">
            <Tabs defaultValue="financial" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="financial">Financial</TabsTrigger>
                <TabsTrigger value="business">Business</TabsTrigger>
              </TabsList>
              <TabsContent value="financial">
                <FinancialCalculators />
              </TabsContent>
              <TabsContent value="business">
                <BusinessCalculators />
              </TabsContent>
            </Tabs>
          </div>
        );
      case 'company-profile':
        return <CompanyProfile />;
      case 'company-users':
        return <CompanyUserManagement />;
      case 'admin-users':
      case 'admin-apps':
      case 'admin-templates':
      case 'admin-settings':
      case 'admin-analytics':
        return <AdminPanel activeTab={activeTab} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30">
      <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            window.location.hash = tab;
          }}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};