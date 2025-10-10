import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Building2, 
  Plus, 
  Search, 
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { 
  apiGetCompanies, 
  apiCreateCompany, 
  apiDeleteCompany,
  apiGetCompanySubscription 
} from '@/lib/api';

interface PaginatedCompany {
  id: string;
  name: string;
  domain: string;
  user_count: number;
  subscription_tier: string;
  subscriptionExpiry: string | null;
  isActive: boolean;
  createdAt: string;
}

interface CompanySubscription {
  subscription_tier: string;
  subscriptionExpiry: string | null;
  isActive: boolean;
  company_name: string;
  total_users: number;
  active_users: number;
  status: 'trial' | 'active' | 'expired';
  daysRemaining?: number;
  daysOverdue?: number;
}

export const PlatformCompanyManagement: React.FC = () => {
  const [companies, setCompanies] = useState<PaginatedCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<PaginatedCompany | null>(null);
  const [subscriptionDetails, setSubscriptionDetails] = useState<CompanySubscription | null>(null);

  const [newCompany, setNewCompany] = useState({
    name: '',
    domain: '',
    isActive: true
  });

  useEffect(() => {
    loadCompanies();
  }, [page, search]);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const res = await apiGetCompanies({
        page,
        pageSize: 20,
        search: search || undefined
      });

      if (res.success && res.data) {
        setCompanies(res.data.items);
        setTotalPages(res.data.totalPages);
        setTotal(res.data.total);
      }
    } catch (error) {
      console.error('Failed to load companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCompany = async () => {
    if (!newCompany.name) {
      alert('Please enter a company name');
      return;
    }

    try {
      const res = await apiCreateCompany(newCompany);
      if (res.success) {
        setNewCompany({
          name: '',
          domain: '',
          isActive: true
        });
        setShowAddCompany(false);
        loadCompanies();
      } else {
        alert('Failed to create company: ' + res.error);
      }
    } catch (error) {
      console.error('Failed to create company:', error);
      alert('Failed to create company');
    }
  };

  const handleDeleteCompany = async (company: PaginatedCompany) => {
    if (company.user_count > 0) {
      alert('Cannot delete company with existing users. Please reassign or remove users first.');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${company.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await apiDeleteCompany(company.id);
      if (res.success) {
        loadCompanies();
      } else {
        alert('Failed to delete company: ' + res.error);
      }
    } catch (error) {
      console.error('Failed to delete company:', error);
      alert('Failed to delete company');
    }
  };

  const handleViewSubscription = async (company: PaginatedCompany) => {
    try {
      const res = await apiGetCompanySubscription(company.id);
      if (res.success) {
        setSubscriptionDetails(res.data);
        setSelectedCompany(company);
        setShowSubscription(true);
      } else {
        alert('Failed to load subscription details: ' + res.error);
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
      alert('Failed to load subscription details');
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const getSubscriptionBadge = (tier: string, status?: string) => {
    if (status === 'expired') {
      return <Badge variant="destructive">Expired</Badge>;
    }
    
    switch (tier) {
      case 'trial':
        return <Badge variant="secondary">Trial</Badge>;
      case 'diy':
        return <Badge variant="default">DIY</Badge>;
      case 'diy_accountant':
        return <Badge variant="default">DIY + Accountant</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (loading && companies.length === 0) {
    return <div className="flex items-center justify-center p-8">Loading companies...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Company Management</h2>
          <p className="text-muted-foreground">
            Manage companies, view subscriptions, and track usage
          </p>
        </div>
        <Dialog open={showAddCompany} onOpenChange={setShowAddCompany}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Company
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Company</DialogTitle>
              <DialogDescription>
                Create a new company workspace
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={newCompany.name}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter company name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="domain">Domain (Optional)</Label>
                <Input
                  id="domain"
                  value={newCompany.domain}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, domain: e.target.value }))}
                  placeholder="company.com"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowAddCompany(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddCompany}>
                  Create Company
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search companies..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
            <p className="text-xs text-muted-foreground">
              Registered companies
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Companies</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {companies.filter(c => c.isActive).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trial Companies</CardTitle>
            <Calendar className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {companies.filter(c => c.subscription_tier === 'trial').length}
            </div>
            <p className="text-xs text-muted-foreground">
              On trial plans
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {companies.reduce((sum, c) => sum + c.user_count, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all companies
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Companies Table */}
      <Card>
        <CardHeader>
          <CardTitle>Companies</CardTitle>
          <CardDescription>
            {loading ? 'Loading...' : `Showing ${companies.length} of ${total} companies`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {companies.map((company) => (
              <div key={company.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{company.name}</h3>
                      {!company.isActive && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{company.domain}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {getSubscriptionBadge(company.subscription_tier)}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {company.user_count} users
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Created {new Date(company.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewSubscription(company)}
                  >
                    View Subscription
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteCompany(company)}
                    disabled={company.user_count > 0}
                    className={company.user_count > 0 ? '' : 'text-red-600 hover:text-red-700'}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Details Dialog */}
      <Dialog open={showSubscription} onOpenChange={setShowSubscription}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Subscription Details</DialogTitle>
            <DialogDescription>
              {selectedCompany?.name} subscription information
            </DialogDescription>
          </DialogHeader>
          {subscriptionDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Subscription Tier</Label>
                  <div className="mt-1">
                    {getSubscriptionBadge(subscriptionDetails.subscription_tier, subscriptionDetails.status)}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="mt-1">
                    <Badge variant={
                      subscriptionDetails.status === 'active' ? 'default' :
                      subscriptionDetails.status === 'trial' ? 'secondary' : 'destructive'
                    }>
                      {subscriptionDetails.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Total Users</Label>
                  <p className="text-sm text-muted-foreground">{subscriptionDetails.total_users}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Active Users</Label>
                  <p className="text-sm text-muted-foreground">{subscriptionDetails.active_users}</p>
                </div>
              </div>

              {subscriptionDetails.subscriptionExpiry && (
                <div>
                  <Label className="text-sm font-medium">Expiry Date</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(subscriptionDetails.subscriptionExpiry).toLocaleDateString()}
                  </p>
                  {subscriptionDetails.daysRemaining && (
                    <p className="text-xs text-green-600">
                      {subscriptionDetails.daysRemaining} days remaining
                    </p>
                  )}
                  {subscriptionDetails.daysOverdue && (
                    <p className="text-xs text-red-600">
                      {subscriptionDetails.daysOverdue} days overdue
                    </p>
                  )}
                </div>
              )}

              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Platform admins can view subscription status but cannot modify payments. 
                  Payment actions are handled through PayFast integration.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
