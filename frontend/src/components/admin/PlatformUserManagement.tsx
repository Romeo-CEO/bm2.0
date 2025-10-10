import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users,
  UserPlus,
  Search,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Building2,
  Shield,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { 
  apiGetUsers, 
  apiGetCompanies, 
  apiCreateUser, 
  apiDeleteUser, 
  apiAssignUserToCompany,
  apiSetUserCompanyAdmin 
} from '@/lib/api';

interface PaginatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user';
  subscriptionTier: 'trial' | 'diy' | 'diy_accountant';
  isActive: boolean;
  companyId?: string;
  company_name?: string;
  company_admin?: boolean;
  createdAt: string;
}

interface Company {
  id: string;
  name: string;
  domain: string;
  user_count: number;
  subscription_tier: string;
}

export const PlatformUserManagement: React.FC = () => {
  const [users, setUsers] = useState<PaginatedUser[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAssignCompany, setShowAssignCompany] = useState(false);
  const [selectedUser, setSelectedUser] = useState<PaginatedUser | null>(null);

  const [newUser, setNewUser] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'user' as 'admin' | 'user',
    companyId: '',
    subscriptionTier: 'trial' as 'trial' | 'diy' | 'diy_accountant',
    isActive: true
  });

  useEffect(() => {
    loadUsers();
  }, [page, search, selectedCompany]);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await apiGetUsers({
        page,
        pageSize: 20,
        search: search || undefined,
        companyId: selectedCompany || undefined
      });

      if (res.success && res.data) {
        setUsers(res.data.items);
        setTotalPages(res.data.totalPages);
        setTotal(res.data.total);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const res = await apiGetCompanies({ page: 1, pageSize: 100 });
      if (res.success && res.data) {
        setCompanies(res.data.items);
      }
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.firstName || !newUser.lastName) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const userData = {
        ...newUser,
        companyId: newUser.companyId === 'none' ? undefined : newUser.companyId
      };
      const res = await apiCreateUser(userData);
      if (res.success) {
        alert(`User created successfully! Temporary password: ${res.data.tempPassword}`);
        setNewUser({
          email: '',
          firstName: '',
          lastName: '',
          role: 'user',
          companyId: '',
          subscriptionTier: 'trial',
          isActive: true
        });
        setShowAddUser(false);
        loadUsers();
      } else {
        alert('Failed to create user: ' + res.error);
      }
    } catch (error) {
      console.error('Failed to create user:', error);
      alert('Failed to create user');
    }
  };

  const handleDeleteUser = async (user: PaginatedUser) => {
    if (!confirm(`Are you sure you want to delete ${user.firstName} ${user.lastName}? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await apiDeleteUser(user.id);
      if (res.success) {
        loadUsers();
      } else {
        alert('Failed to delete user: ' + res.error);
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user');
    }
  };

  const handleAssignCompany = async () => {
    if (!selectedUser || !selectedUser.id) return;

    try {
      const companyId = newUser.companyId === 'none' ? '' : newUser.companyId;
      const res = await apiAssignUserToCompany(selectedUser.id, companyId);
      if (res.success) {
        setShowAssignCompany(false);
        setSelectedUser(null);
        loadUsers();
      } else {
        alert('Failed to assign company: ' + res.error);
      }
    } catch (error) {
      console.error('Failed to assign company:', error);
      alert('Failed to assign company');
    }
  };

  const handleToggleCompanyAdmin = async (user: PaginatedUser) => {
    if (!user.companyId) {
      alert('User must be assigned to a company first');
      return;
    }

    if (user.role === 'admin') {
      alert('Platform admins are automatically company admins');
      return;
    }

    try {
      const newStatus = !user.company_admin;
      const res = await apiSetUserCompanyAdmin(user.id, newStatus);
      if (res.success) {
        loadUsers(); // Refresh the list
      } else {
        alert('Failed to update company admin status: ' + res.error);
      }
    } catch (error) {
      console.error('Failed to update company admin status:', error);
      alert('Failed to update company admin status');
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleCompanyFilter = (value: string) => {
    setSelectedCompany(value === 'all' ? '' : value);
    setPage(1);
  };

  if (loading && users.length === 0) {
    return <div className="flex items-center justify-center p-8">Loading users...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
          <p className="text-muted-foreground">
            Manage all platform users, assign companies, and control access
          </p>
        </div>
        <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new platform user and assign them to a company
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={newUser.firstName}
                    onChange={(e) => setNewUser(prev => ({ ...prev, firstName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={newUser.lastName}
                    onChange={(e) => setNewUser(prev => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={newUser.role} onValueChange={(value: 'admin' | 'user') => setNewUser(prev => ({ ...prev, role: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Platform Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subscriptionTier">Subscription Tier</Label>
                  <Select value={newUser.subscriptionTier} onValueChange={(value: 'trial' | 'diy' | 'diy_accountant') => setNewUser(prev => ({ ...prev, subscriptionTier: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="diy">DIY</SelectItem>
                      <SelectItem value="diy_accountant">DIY + Accountant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Company (Optional)</Label>
                <Select value={newUser.companyId} onValueChange={(value) => setNewUser(prev => ({ ...prev, companyId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Company</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowAddUser(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddUser}>
                  Create User
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCompany || 'all'} onValueChange={handleCompanyFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by company" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companies.map((company) => (
              <SelectItem key={company.id} value={company.id}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
            <p className="text-xs text-muted-foreground">
              Across all companies
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.isActive).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Admins</CardTitle>
            <Shield className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.role === 'admin').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Admin users
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Users</CardTitle>
          <CardDescription>
            {loading ? 'Loading...' : `Showing ${users.length} of ${total} users`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600">
                      {user.firstName[0]}{user.lastName[0]}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{user.firstName} {user.lastName}</h3>
                      {user.role === 'admin' && (
                        <Badge variant="secondary">Platform Admin</Badge>
                      )}
                      {user.company_admin && user.role !== 'admin' && (
                        <Badge variant="default">Company Admin</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={user.isActive ? 'default' : 'secondary'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline">
                        {user.subscriptionTier === 'diy' ? 'DIY' : 
                         user.subscriptionTier === 'diy_accountant' ? 'DIY + Accountant' : 
                         'Trial'}
                      </Badge>
                      {user.company_name && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {user.company_name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedUser(user);
                      setNewUser(prev => ({ ...prev, companyId: user.companyId || '' }));
                      setShowAssignCompany(true);
                    }}
                  >
                    <Building2 className="mr-1 h-3 w-3" />
                    Assign Company
                  </Button>

                  {user.companyId && user.role !== 'admin' && (
                    <Button
                      variant={user.company_admin ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleToggleCompanyAdmin(user)}
                    >
                      <Shield className="mr-1 h-3 w-3" />
                      {user.company_admin ? 'Remove Admin' : 'Make Admin'}
                    </Button>
                  )}

                  {user.role !== 'admin' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteUser(user)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
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

      {/* Assign Company Dialog */}
      <Dialog open={showAssignCompany} onOpenChange={setShowAssignCompany}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Company</DialogTitle>
            <DialogDescription>
              Assign {selectedUser?.firstName} {selectedUser?.lastName} to a company
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assignCompany">Company</Label>
              <Select value={newUser.companyId} onValueChange={(value) => setNewUser(prev => ({ ...prev, companyId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Company</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAssignCompany(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignCompany}>
                Assign Company
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
