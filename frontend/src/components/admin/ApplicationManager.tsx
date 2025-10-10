import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, ExternalLink, Globe, Loader2 } from 'lucide-react';
import { Application } from '@/types';
import { apiGetApplications, apiCreateApplication, apiUpdateApplication, apiDeleteApplication } from '@/lib/api';
import { toast } from '@/components/ui/sonner';
import { useRefreshList } from '@/hooks/use-refresh';

export const ApplicationManager: React.FC = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const { isRefreshing, refresh } = useRefreshList<Application>(
    async () => {
      const res = await apiGetApplications('application', {
        page,
        pageSize: 20,
        search: search || undefined,
        category: category || undefined
      });

      if (res.success && res.data) {
        // Handle both paginated and non-paginated responses
        if (Array.isArray(res.data)) {
          // Legacy format
          return { success: true, data: res.data, error: undefined };
        } else {
          // Paginated format
          const paginatedData = res.data as any;
          setTotalPages(paginatedData.totalPages || 1);
          setTotal(paginatedData.total || 0);
          return { success: true, data: paginatedData.items || [], error: undefined };
        }
      }

      return { success: res.success, data: [], error: res.error };
    },
    (items) => setApplications(items as any),
    'Applications'
  );

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, category]);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingApplication, setEditingApplication] = useState<Application | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    url: '',
    subscriptionTiers: [] as string[],
  });

  const categories = [
    { value: 'accounting', label: 'Accounting & Finance' },
    { value: 'hr', label: 'Human Resources' },
    { value: 'sales', label: 'Sales & Marketing' },
    { value: 'inventory', label: 'Inventory Management' },
    { value: 'project', label: 'Project Management' },
    { value: 'calculators', label: 'Calculators' },
    { value: 'general', label: 'General' },
  ];

  const subscriptionOptions = [
    { value: 'trial', label: 'Trial (Free)' },
    { value: 'diy', label: 'DIY' },
    { value: 'diy_accountant', label: 'DIY + Accountant' },
  ];



  const resetForm = () => {
    setFormData({ name: '', description: '', category: '', url: '', subscriptionTiers: [] });
    setEditingApplication(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.category || !formData.url || formData.subscriptionTiers.length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const applicationData = {
        ...formData,
        type: 'application' as const,
        isActive: true,
        createdAt: editingApplication?.createdAt || new Date(),
        updatedAt: new Date(),
      };

      if (editingApplication) {
        const res = await apiUpdateApplication(editingApplication.id, applicationData as any);
        if (!res.success) throw new Error(res.error || 'Failed to update application');
        const refreshed = await apiGetApplications('application');
        if (refreshed.success && refreshed.data) setApplications(refreshed.data as any);
        toast.success('Application updated');
      } else {
        const res = await apiCreateApplication(applicationData as any);
        if (!res.success || !res.data) throw new Error(res.error || 'Failed to create application');
        // Optimistic update so it appears immediately
        const newApplication: Application = { ...(applicationData as any), id: res.data } as any;
        setApplications((prev) => [...prev, newApplication]);
        // Then refresh from server to ensure consistency
        const refreshed = await apiGetApplications('application');
        if (refreshed.success && refreshed.data) setApplications(refreshed.data as any);
        toast.success('Application created');
      }

      setIsAddDialogOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err?.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (application: Application) => {
    setEditingApplication(application);
    setFormData({
      name: application.name,
      description: application.description,
      category: application.category,
      url: application.url || '',
      subscriptionTiers: application.subscriptionTiers,
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this application?')) return;
    setDeletingId(id);
    try {
      const res = await apiDeleteApplication(id);
      if (!res.success) throw new Error(res.error || 'Failed to delete application');
      const refreshed = await apiGetApplications('application');
      if (refreshed.success && refreshed.data) setApplications(refreshed.data as any);
      toast.success('Application deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSubscriptionTier = (tier: string) => {
    setFormData((prev) => ({
      ...prev,
      subscriptionTiers: prev.subscriptionTiers.includes(tier)
        ? prev.subscriptionTiers.filter((t) => t !== tier)
        : [...prev.subscriptionTiers, tier],
    }));
  };

  const toggleTrialAvailability = () => {
    setFormData(prev => ({
      ...prev,
      subscriptionTiers: prev.subscriptionTiers.includes('trial')
        ? prev.subscriptionTiers.filter(t => t !== 'trial')
        : ['trial', ...prev.subscriptionTiers]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Application Management</h1>
          <p className="text-muted-foreground">Manage hosted applications with URLs and external links</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refresh} disabled={isRefreshing}>
            {isRefreshing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Refreshing
              </>
            ) : (
              'Refresh'
            )}
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" /> Add Application
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingApplication ? 'Edit Application' : 'Add New Application'}</DialogTitle>
                <DialogDescription>Add a hosted application with URL and access controls</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Application Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="ROI Calculator Pro"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="url">Application URL *</Label>
                  <Input
                    id="url"
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
                    placeholder="https://your-app.example.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the application's features and benefits"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Subscription Tiers * (Select at least one)</Label>
                  <div className="flex gap-2">
                    {subscriptionOptions.map((tier) => (
                      <Button key={tier.value}

                      type="button"
                      variant={formData.subscriptionTiers.includes(tier.value) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleSubscriptionTier(tier.value)}
                    >
                      {tier.label}
                    </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trialAvailable">Available in Trial</Label>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant={formData.subscriptionTiers.includes('trial') ? 'default' : 'outline'}
                      size="sm"
                      onClick={toggleTrialAvailability}
                      aria-pressed={formData.subscriptionTiers.includes('trial')}
                    >
                      {formData.subscriptionTiers.includes('trial') ? 'Included in Trial' : 'Not in Trial'}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Toggle to allow trial users to access this application
                    </span>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingApplication ? 'Update Application' : 'Add Application'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {applications.map((application) => (
          <Card key={application.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    {application.name}
                  </CardTitle>
                  <CardDescription className="mt-1">{application.description}</CardDescription>
                </div>
                <Badge variant={application.isActive ? 'default' : 'secondary'}>
                  {application.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium">Category:</span>
                  <Badge variant="outline" className="ml-2">
                    {categories.find((c) => c.value === application.category)?.label}
                  </Badge>
                </div>

                <div>
                  <span className="text-sm font-medium">URL:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{application.url}</code>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={application.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>

                <div>
                  <span className="text-sm font-medium">Access:</span>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {application.subscriptionTiers.map((tier) => (
                      <Badge key={tier} variant="secondary" className="text-xs">
                        {subscriptionOptions.find((s) => s.value === tier)?.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(application)}>
                    <Edit className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleDelete(application.id)}
                    disabled={deletingId === application.id}
                  >
                    {deletingId === application.id ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-3 w-3 mr-1" /> Delete
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {applications.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Applications Yet</h3>
            <p className="text-muted-foreground mb-4">Add your first hosted application to get started</p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Application
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
