import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Download, FileText, Upload, Loader2 } from 'lucide-react';
import { Application } from '@/types';

import { toast } from '@/components/ui/sonner';
import { useRefreshList } from '@/hooks/use-refresh';

export const TemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<Application[]>([]);

  const { isRefreshing, refresh } = useRefreshList<Application>(
    async () => {
      const { apiGetTemplates } = await import('@/lib/api');
      const res = await apiGetTemplates();
      return { success: res.success, data: (res.data as any) ?? undefined, error: res.error };
    },
    (items) => setTemplates(items as any),
    'Templates'
  );

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Application | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // initial load
  React.useEffect(() => { refresh(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    subscriptionTiers: [] as string[],
    file: null as File | null
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = [
    { value: 'accounting', label: 'Accounting & Finance' },
    { value: 'hr', label: 'Human Resources' },
    { value: 'sales', label: 'Sales & Marketing' },
    { value: 'inventory', label: 'Inventory Management' },
    { value: 'project', label: 'Project Management' },
    { value: 'calculators', label: 'Calculators' },
    { value: 'general', label: 'General' }
  ];

  const toggleTrialAvailability = () => {
    setFormData(prev => ({
      ...prev,
      subscriptionTiers: prev.subscriptionTiers.includes('trial')
        ? prev.subscriptionTiers.filter(t => t !== 'trial')
        : ['trial', ...prev.subscriptionTiers]
    }));
  };

  const subscriptionOptions = [
    { value: 'trial', label: 'Trial (Free)' },
    { value: 'diy', label: 'DIY' },
    { value: 'diy_accountant', label: 'DIY + Accountant' }
  ];

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      subscriptionTiers: [],
      file: null
    });
    setEditingTemplate(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, file }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!formData.name || !formData.category || formData.subscriptionTiers.length === 0) {
  toast.error('Please fill in all required fields');
  return;
  }

  if (!editingTemplate && !formData.file) {
  toast.error('Please select a file to upload');
  return;
  }

  setIsSubmitting(true);
  try {
  let downloadUrl = editingTemplate?.downloadUrl || '';
  let fileName = editingTemplate?.fileName || '';
  let fileSize = editingTemplate?.fileSize || '';
  let fileType = editingTemplate?.fileType || '';

  // If a new file is selected, upload to Azure Blob via SAS
  if (formData.file) {
    const file = formData.file;
    const { apiFilesGetSas, apiFilesConfirm } = await import('@/lib/api');

    // 1) Request SAS for upload
    const sas = await apiFilesGetSas({ fileName: file.name, fileType: file.type || 'application/octet-stream', fileSizeBytes: file.size });
    if (!sas.success || !sas.data) throw new Error(sas.error || 'Failed to prepare upload');

    // 2) Upload file directly to Azure Blob (PUT BlockBlob)
    const put = await fetch(sas.data.uploadUrl, {
      method: 'PUT',
      headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!put.ok && put.status !== 201) throw new Error(`Upload failed: ${put.status} ${put.statusText}`);

    // 3) Confirm to persist metadata in DB; mark as public for template assets
    const confirm = await apiFilesConfirm({
      blobName: sas.data.blobName,
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSizeBytes: file.size,
      isPublic: true,
    });
    if (!confirm.success || !confirm.data) throw new Error(confirm.error || 'Failed to confirm upload');

    // For template usage we store the blob URL as downloadUrl
    downloadUrl = confirm.data.azureCdnUrl || confirm.data.azureBlobUrl;
    fileName = file.name;
    fileSize = `${(file.size / 1024 / 1024).toFixed(1)} MB`;
    fileType = file.type || 'application/octet-stream';
  }

  const templateData = {
    name: formData.name,
    description: formData.description,
    category: formData.category,
    isActive: true,
    downloadUrl,
    fileName,
    fileSize,
    fileType,
    subscriptionTiers: formData.subscriptionTiers,
    createdAt: editingTemplate?.createdAt || new Date(),
    updatedAt: new Date()
  };

  if (editingTemplate) {
    const { apiUpdateTemplate, apiGetTemplates } = await import('@/lib/api');
    const res = await apiUpdateTemplate(editingTemplate.id, templateData as any);
    if (!res.success) throw new Error(res.error || 'Failed to update template');
    const refreshed = await apiGetTemplates();
    if (refreshed.success && refreshed.data) setTemplates(refreshed.data as any);
    toast.success('Template updated');
  } else {
    const { apiCreateTemplate, apiGetTemplates } = await import('@/lib/api');
    const res = await apiCreateTemplate(templateData as any);
    if (!res.success || !res.data) throw new Error(res.error || 'Failed to add template');
    const newTemplate: Application = { ...(templateData as any), id: res.data } as any; // includes fileType
    setTemplates(prev => [...prev, newTemplate]);
    const refreshed = await apiGetTemplates();
    if (refreshed.success && refreshed.data) setTemplates(refreshed.data as any);
    toast.success('Template added');
  }

      setIsAddDialogOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err?.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (template: Application) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description,
      category: template.category,
      subscriptionTiers: template.subscriptionTiers,
      file: null // Don't set the existing file, user can optionally upload a new one
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    setDeletingId(id);
    try {
      const { apiDeleteTemplate, apiGetTemplates } = await import('@/lib/api');
      const res = await apiDeleteTemplate(id);
      if (!res.success) throw new Error(res.error || 'Failed to delete template');
      setTemplates(prev => prev.filter(t => t.id !== id));
      const refreshed = await apiGetTemplates();
      if (refreshed.success && refreshed.data) setTemplates(refreshed.data as any);
      toast.success('Template deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
    };

  const toggleSubscriptionTier = (tier: string) => {
    setFormData(prev => ({
      ...prev,
      subscriptionTiers: prev.subscriptionTiers.includes(tier)
        ? prev.subscriptionTiers.filter(t => t !== tier)
        : [...prev.subscriptionTiers, tier]
    }));
  };

  const formatFileSize = (size: string) => {
    return size || 'Unknown size';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Template Management</h1>
          <p className="text-muted-foreground">
            Manage downloadable templates and documents uploaded via admin panel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refresh} disabled={isRefreshing}>
            {isRefreshing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Refreshing</>) : 'Refresh'}
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Add Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Edit Template' : 'Add New Template'}
              </DialogTitle>
              <DialogDescription>
                Upload a downloadable template file with access controls
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Business Plan Template"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
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
                <Label htmlFor="file">
                  Template File {!editingTemplate && '*'}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="file"
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-1" />
                    Browse
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Supported formats: PDF, Word, Excel, PowerPoint, ZIP
                  {editingTemplate && ' (Leave empty to keep existing file)'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the template's purpose and contents"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Subscription Tiers * (Select at least one)</Label>
                <div className="flex gap-2">
                  {subscriptionOptions.map((tier) => (
                    <Button
                      key={tier.value}
                      type="button"
                      variant={formData.subscriptionTiers.includes(tier.value) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleSubscriptionTier(tier.value)}
                    >
                      {tier.label}
                    </Button>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                 {editingTemplate ? 'Update Template' : 'Add Template'}
                 </Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
          </div>
               </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {template.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {template.description}
                  </CardDescription>
                </div>
                <Badge variant={template.isActive ? 'default' : 'secondary'}>
                  {template.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium">Category:</span>
                  <Badge variant="outline" className="ml-2">
                    {categories.find(c => c.value === template.category)?.label}
                  </Badge>
                </div>

                <div>
                  <span className="text-sm font-medium">File:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                      {template.fileName}
                    </code>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={template.downloadUrl} download>
                        <Download className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Size: {formatFileSize(template.fileSize || '')}
                  </p>
                </div>

                <div>
                  <span className="text-sm font-medium">Access:</span>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {template.subscriptionTiers.map((tier) => (
                      <Badge key={tier} variant="secondary" className="text-xs">
                        {subscriptionOptions.find(s => s.value === tier)?.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(template)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleDelete(template.id)}
                    disabled={deletingId === template.id}
                  >
                    {deletingId === template.id ? (
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

      {templates.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Templates Yet</h3>
            <p className="text-muted-foreground mb-4">
              Upload your first template to get started
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Template
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};