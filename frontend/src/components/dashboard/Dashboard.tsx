import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  DollarSign,
  TrendingUp,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Settings,
  FileText,
  BarChart3,
  UserPlus
} from 'lucide-react';
import { apiGetUsers, apiGetCompanies } from '@/lib/api';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [totalCompanies, setTotalCompanies] = useState<number>(0);
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const [systemStatus, setSystemStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [loading, setLoading] = useState(true);

  // Load real KPI data for admin dashboard
  useEffect(() => {
    if (user?.role === 'admin') {
      loadAdminKPIs();
    }
  }, [user]);

  const loadAdminKPIs = async () => {
    try {
      setLoading(true);
      const [usersRes, companiesRes] = await Promise.all([
        apiGetUsers({ pageSize: 1000 }), // Get large page to get total count
        apiGetCompanies({ pageSize: 1000 })
      ]);

      if (usersRes.success && usersRes.data) {
        // Handle both old array format and new paginated format
        if (Array.isArray(usersRes.data)) {
          // Legacy format
          const users = usersRes.data as any[];
          setTotalUsers(users.length);
          setActiveUsers(users.filter(u => u.isActive).length);
        } else {
          // New paginated format
          const paginatedData = usersRes.data as any;
          setTotalUsers(paginatedData.total || 0);
          setActiveUsers(paginatedData.items ? paginatedData.items.filter((u: any) => u.isActive).length : 0);
        }
      }

      if (companiesRes.success && companiesRes.data) {
        // Handle both old array format and new paginated format
        if (Array.isArray(companiesRes.data)) {
          // Legacy format
          setTotalCompanies(companiesRes.data.length);
        } else {
          // New paginated format
          const paginatedData = companiesRes.data as any;
          setTotalCompanies(paginatedData.total || 0);
        }
      }

      // Check system status by testing API connectivity
      setSystemStatus('online'); // If we got here, API is working
    } catch (error) {
      console.error('Failed to load admin KPIs:', error);
      setSystemStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  // Admin users should see a different dashboard
  if (user?.role === 'admin') {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
          <p className="text-lg text-gray-600 mt-2">
            Welcome back, {user.firstName}! System administration overview.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 shadow-md bg-white/80 backdrop-blur hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Total Users</CardTitle>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {loading ? '...' : (totalUsers || 0).toLocaleString()}
              </div>
              <p className="text-xs text-gray-600 font-medium">Registered users</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-white/80 backdrop-blur hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Active Users</CardTitle>
              <div className="p-2 bg-green-100 rounded-lg">
                <UserPlus className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {loading ? '...' : (activeUsers || 0).toLocaleString()}
              </div>
              <p className="text-xs text-gray-600 font-medium">Currently active</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-white/80 backdrop-blur hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Companies</CardTitle>
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {loading ? '...' : (totalCompanies || 0).toLocaleString()}
              </div>
              <p className="text-xs text-gray-600 font-medium">Registered companies</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-white/80 backdrop-blur hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">System Status</CardTitle>
              <div className={`p-2 rounded-lg ${
                systemStatus === 'online' ? 'bg-green-100' :
                systemStatus === 'offline' ? 'bg-red-100' : 'bg-yellow-100'
              }`}>
                <CheckCircle2 className={`h-4 w-4 ${
                  systemStatus === 'online' ? 'text-green-600' :
                  systemStatus === 'offline' ? 'text-red-600' : 'text-yellow-600'
                }`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`h-5 w-5 ${
                  systemStatus === 'online' ? 'text-green-600' :
                  systemStatus === 'offline' ? 'text-red-600' : 'text-yellow-600'
                }`} />
                <span className="text-2xl font-bold text-gray-900 capitalize">
                  {systemStatus === 'checking' ? 'Checking...' : systemStatus}
                </span>
              </div>
              <p className={`text-xs font-medium ${
                systemStatus === 'online' ? 'text-green-600' :
                systemStatus === 'offline' ? 'text-red-600' : 'text-yellow-600'
              }`}>
                {systemStatus === 'online' ? 'All systems operational' :
                 systemStatus === 'offline' ? 'System issues detected' : 'Checking status...'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-0 shadow-md bg-white/80 backdrop-blur hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-gray-900">Quick Admin Actions</CardTitle>
              <CardDescription className="text-gray-600">Common administrative tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="ghost"
                className="w-full justify-start h-auto p-3 text-left"
                onClick={() => window.location.hash = 'admin-users'}
              >
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-blue-600" />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Manage Users & Companies</div>
                    <div className="text-xs text-gray-500">View and manage all platform users</div>
                  </div>
                </div>
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start h-auto p-3 text-left"
                onClick={() => window.location.hash = 'admin-apps'}
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-green-600" />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Manage Applications</div>
                    <div className="text-xs text-gray-500">Add/edit business applications</div>
                  </div>
                </div>
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start h-auto p-3 text-left"
                onClick={() => window.location.hash = 'admin-settings'}
              >
                <div className="flex items-center gap-3">
                  <Settings className="h-4 w-4 text-purple-600" />
                  <div>
                    <div className="text-sm font-medium text-gray-700">System Settings</div>
                    <div className="text-xs text-gray-500">Configure PayFast and platform settings</div>
                  </div>
                </div>
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start h-auto p-3 text-left"
                onClick={() => window.location.hash = 'admin-analytics'}
              >
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-4 w-4 text-orange-600" />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Platform Analytics</div>
                    <div className="text-xs text-gray-500">View detailed platform metrics</div>
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-white/80 backdrop-blur hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-gray-900">Administrator Information</CardTitle>
              <CardDescription className="text-gray-600">System access and details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Role:</span>
                <Badge className="bg-blue-100 text-blue-700 border-blue-200">Platform Administrator</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Subscription Tier:</span>
                <Badge variant="default">DIY + Accountant</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Access Level:</span>
                <span className="text-sm font-medium">Full Platform Access</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Companies:</span>
                <span className="text-sm font-medium">{loading ? '...' : totalCompanies}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isTrialExpiringSoon = () => {
    if (user?.subscriptionTier !== 'trial') return false;

    // Ensure subscriptionExpiry is a Date object
    const expiryDate = user.subscriptionExpiry instanceof Date
      ? user.subscriptionExpiry
      : new Date(user.subscriptionExpiry);

    const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysLeft <= 3;
  };

  const getSubscriptionStatus = () => {
    if (!user) return null;

    // Ensure subscriptionExpiry is a Date object
    const expiryDate = user.subscriptionExpiry instanceof Date
      ? user.subscriptionExpiry
      : new Date(user.subscriptionExpiry);

    const isActive = expiryDate > new Date();
    const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    return { isActive, daysLeft };
  };

  const subscriptionStatus = getSubscriptionStatus();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.firstName}! Here's what's happening with your account.
          </p>
        </div>
      </div>

      {/* Subscription Status Alert */}
      {user?.subscriptionTier === 'trial' && (
        <Card className={`border-l-4 ${isTrialExpiringSoon() ? 'border-l-red-500 bg-red-50' : 'border-l-yellow-500 bg-yellow-50'}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className={`h-5 w-5 ${isTrialExpiringSoon() ? 'text-red-600' : 'text-yellow-600'}`} />
              <CardTitle className="text-lg">Trial Period</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">
              Your trial expires in {subscriptionStatus?.daysLeft} day(s).
              Upgrade to continue accessing all features.
            </p>
          </CardContent>
        </Card>
      )}

          {/* Subscribe/Upgrade CTA */}
          <div className="mt-3">
            {user?.subscriptionTier === 'trial' || !subscriptionStatus?.isActive ? (
              <a href="/subscribe" className="inline-flex items-center text-sm font-medium text-blue-600 hover:underline">
                Upgrade now →
              </a>
            ) : (
              <a href="/manage-subscription" className="inline-flex items-center text-sm font-medium text-green-600 hover:underline">
                Manage subscription →
              </a>
            )}
          </div>


      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscription</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user?.subscriptionTier === 'trial' ? 'Trial' :
               user?.subscriptionTier === 'diy' ? 'DIY' : 'DIY + Accountant'}
            </div>
            <p className="text-xs text-muted-foreground">
              {subscriptionStatus?.isActive ? 'Active' : 'Expired'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Days Remaining</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriptionStatus?.daysLeft}</div>
            <p className="text-xs text-muted-foreground">
              Until renewal
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Applications</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user?.subscriptionTier === 'diy_accountant' ? '12' : '6'}
            </div>
            <p className="text-xs text-muted-foreground">
              Available tools
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold">Active</span>
            </div>
            <p className="text-xs text-muted-foreground">
              All systems operational
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and shortcuts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">• Access Business Tools</p>
              <p className="text-sm font-medium">• Download Templates</p>
              <p className="text-sm font-medium">• Use Calculators</p>
              <p className="text-sm font-medium">• Manage Subscription</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>
              Your current plan and features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Plan Type:</span>
                <Badge variant={user?.subscriptionTier === 'trial' ? 'secondary' : 'default'}>
                  {user?.subscriptionTier === 'trial' ? 'Trial' :
                   user?.subscriptionTier === 'diy' ? 'DIY' : 'DIY + Accountant'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Company:</span>
                <span className="text-sm font-medium">Your Company</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Role:</span>
                <span className="text-sm font-medium capitalize">{user?.role}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};