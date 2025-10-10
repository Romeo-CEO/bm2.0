import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Shield, 
  MoreHorizontal,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle
} from 'lucide-react';

interface CompanyUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user';
  company_admin?: boolean;
  subscriptionTier: 'trial' | 'diy' | 'diy_accountant';
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
}

interface NewUserForm {
  email: string;
  firstName: string;
  lastName: string;
  role: 'user';
  sendInvite: boolean;
}

export const CompanyUserManagement: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState<NewUserForm>({
    email: '',
    firstName: '',
    lastName: '',
    role: 'user',
    sendInvite: true
  });
  const [saving, setSaving] = useState(false);

  const isPlatformAdmin = user?.role === 'admin';
  const isCompanyAdmin = (user as any)?.company_admin || isPlatformAdmin;
  const canManageUsers = isCompanyAdmin || isPlatformAdmin;

  useEffect(() => {
    if (canManageUsers) {
      loadCompanyUsers();
    }
  }, [user, canManageUsers]);

  const loadCompanyUsers = async () => {
    try {
      setLoading(true);
      const { apiGetCompanyUsers } = await import('@/lib/api');
      const res = await apiGetCompanyUsers(user?.companyId);

      if (res.success && res.data) {
        const mappedUsers = res.data.map((userData: any) => ({
          id: userData.id,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          subscriptionTier: userData.subscriptionTier,
          isActive: userData.isActive,
          lastLoginAt: userData.lastLoginAt ? new Date(userData.lastLoginAt) : undefined,
          createdAt: new Date(userData.createdAt)
        }));
        setUsers(mappedUsers);
      } else {
        console.error('Failed to load company users:', res.error);
        setUsers([]);
      }
    } catch (error) {
      console.error('Failed to load company users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.firstName || !newUser.lastName) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      const { apiAddCompanyUser } = await import('@/lib/api');

      const res = await apiAddCompanyUser({
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        sendInvite: newUser.sendInvite
      }, user?.companyId);

      if (!res.success) throw new Error(res.error);

      // Add to local state
      const newUserData: CompanyUser = {
        id: res.data.userId,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: 'user',
        subscriptionTier: user?.subscriptionTier || 'trial',
        isActive: true,
        createdAt: new Date()
      };
      setUsers(prev => [...prev, newUserData]);

      // Reset form
      setNewUser({
        email: '',
        firstName: '',
        lastName: '',
        role: 'user',
        sendInvite: true
      });
      setShowAddUser(false);

      if (newUser.sendInvite) {
        alert(`User added successfully! Temporary password: ${res.data.tempPassword}\n\nIn production, this would be sent via email.`);
      } else {
        alert('User added successfully!');
      }
    } catch (error) {
      console.error('Failed to add user:', error);
      alert('Failed to add user: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      // TODO: Implement API call
      // const res = await apiUpdateUserStatus(userId, isActive);
      // if (!res.success) throw new Error(res.error);
      
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, isActive } : u
      ));
      
      console.log(`User ${userId} ${isActive ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('Failed to update user status:', error);
      alert('Failed to update user status');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      // TODO: Implement API call
      // const res = await apiDeleteUser(userId);
      // if (!res.success) throw new Error(res.error);

      setUsers(prev => prev.filter(u => u.id !== userId));
      console.log(`User ${userId} deleted`);
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user');
    }
  };

  const handleToggleCompanyAdmin = async (targetUser: CompanyUser) => {
    // Only platform admins and company admins can change roles
    if (!canManageUsers) {
      alert('You do not have permission to change user roles');
      return;
    }

    // Platform admins cannot have their company admin status changed
    if (targetUser.role === 'admin') {
      alert('Platform admins are automatically company admins');
      return;
    }

    // Company admins cannot change platform admin roles
    if (!isPlatformAdmin && targetUser.role === 'admin') {
      alert('You cannot change platform admin roles');
      return;
    }

    try {
      const { apiSetUserCompanyAdmin } = await import('@/lib/api');
      const newStatus = !targetUser.company_admin;
      const res = await apiSetUserCompanyAdmin(targetUser.id, newStatus);

      if (res.success) {
        setUsers(prev => prev.map(u =>
          u.id === targetUser.id ? { ...u, company_admin: newStatus } : u
        ));
      } else {
        alert('Failed to update company admin status: ' + res.error);
      }
    } catch (error) {
      console.error('Failed to update company admin status:', error);
      alert('Failed to update company admin status');
    }
  };

  if (!canManageUsers) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-600">You don't have permission to manage users.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading users...</div>;
  }

  const activeUsers = users.filter(u => u.isActive).length;
  const totalUsers = users.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Manage users in your company workspace
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
                Add a new user to your company workspace. They will inherit your subscription tier.
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

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="sendInvite"
                  checked={newUser.sendInvite}
                  onChange={(e) => setNewUser(prev => ({ ...prev, sendInvite: e.target.checked }))}
                />
                <Label htmlFor="sendInvite">Send invitation email</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowAddUser(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddUser} disabled={saving}>
                  {saving ? 'Adding...' : 'Add User'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              Company workspace users
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscription</CardTitle>
            <Shield className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user?.subscriptionTier === 'diy' ? 'DIY' : 
               user?.subscriptionTier === 'diy_accountant' ? 'DIY + Accountant' : 
               'Trial'}
            </div>
            <p className="text-xs text-muted-foreground">
              Current plan
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Company Users</CardTitle>
          <CardDescription>
            All users in your company workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((companyUser) => (
              <div key={companyUser.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600">
                      {companyUser.firstName[0]}{companyUser.lastName[0]}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{companyUser.firstName} {companyUser.lastName}</h3>
                      {companyUser.role === 'admin' && (
                        <Badge variant="secondary">Platform Admin</Badge>
                      )}
                      {companyUser.company_admin && companyUser.role !== 'admin' && (
                        <Badge variant="default">Company Admin</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{companyUser.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={companyUser.isActive ? 'default' : 'secondary'}>
                        {companyUser.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Last login: {companyUser.lastLoginAt?.toLocaleDateString() || 'Never'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleUserStatus(companyUser.id, !companyUser.isActive)}
                  >
                    {companyUser.isActive ? (
                      <>
                        <XCircle className="mr-1 h-3 w-3" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Activate
                      </>
                    )}
                  </Button>

                  {canManageUsers && companyUser.role !== 'admin' && (
                    <Button
                      variant={companyUser.company_admin ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleToggleCompanyAdmin(companyUser)}
                    >
                      <Shield className="mr-1 h-3 w-3" />
                      {companyUser.company_admin ? 'Remove Admin' : 'Make Admin'}
                    </Button>
                  )}

                  {companyUser.role !== 'admin' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteUser(companyUser.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
