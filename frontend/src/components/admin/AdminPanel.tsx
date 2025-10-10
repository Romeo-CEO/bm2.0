import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, Building2, Settings, Plus, ExternalLink, Package, BarChart3 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { User, Company, Application } from '@/types';
import { apiGetUsers, apiGetCompanies } from '@/lib/api';
import { ApplicationManager } from './ApplicationManager';
import { TemplateManager } from './TemplateManager';
import { AdminSettings } from './AdminSettings';
import { AdminAnalytics } from './AdminAnalytics';
import { PlatformUserManagement } from './PlatformUserManagement';
import { PlatformCompanyManagement } from './PlatformCompanyManagement';

interface AdminPanelProps {
  activeTab?: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ activeTab }) => {
  const { user } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => {
    (async () => {
      const [u, c] = await Promise.all([apiGetUsers(), apiGetCompanies()]);
      if (u.success && u.data) setUsers(u.data as unknown as User[]);
      if (c.success && c.data) setCompanies(c.data as unknown as Company[]);
    })();
  }, []);

  const renderUsersTab = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Management</h1>
        <p className="text-muted-foreground">
          Comprehensive user and company management for platform administrators
        </p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="companies">Company Management</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <PlatformUserManagement />
        </TabsContent>

        <TabsContent value="companies" className="space-y-6">
          <PlatformCompanyManagement />
        </TabsContent>
      </Tabs>
    </div>
  );

  const renderCompaniesTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Company Management</h1>
          <p className="text-muted-foreground">
            Manage companies and their subscriptions
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Company
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {companies.map((company) => (
          <Card key={company.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{company.name}</CardTitle>
                <Badge variant={company.isActive ? 'default' : 'secondary'}>
                  {company.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <CardDescription>
                {company.industry} • {company.size} company
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Subscription:</span>
                  <Badge variant="outline">
                    {company.subscriptionTier === 'diy' ? 'DIY' : 
                     company.subscriptionTier === 'diy_accountant' ? 'DIY + Accountant' : 
                     'Trial'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Created:</span>
                  <span className="text-sm">{company.createdAt.toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" className="flex-1">
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderSelectedContent = () => {
    switch (activeTab) {
      case 'admin-users':
        return renderUsersTab();
      case 'admin-apps':
        return <ApplicationManager />;
      case 'admin-templates':
        return <TemplateManager />;
      case 'admin-settings':
        return <AdminSettings />;
      case 'admin-analytics':
        return <AdminAnalytics />;
      default:
        return renderUsersTab();
    }
  };

  const currentLabel = ({
    'admin-users': 'User Management',
    'admin-apps': 'Application Management',
    'admin-templates': 'Template Management',
    'admin-settings': 'System Settings',
    'admin-analytics': 'Analytics',
  } as Record<string, string>)[activeTab || 'admin-users'] || 'Admin';

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-gray-500">
        <button
          type="button"
          onClick={() => { window.location.hash = 'admin-users'; }}
          className="hover:text-gray-900"
          aria-label="Go to Admin Home"
        >
          Admin
        </button>
        <span className="mx-2" aria-hidden="true">/</span>
        <span className="text-gray-900 font-medium">{currentLabel}</span>
      </div>

      {renderSelectedContent()}
    </div>
  );
};