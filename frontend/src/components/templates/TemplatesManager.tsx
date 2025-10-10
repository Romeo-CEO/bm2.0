import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  Download,
  Search,
  FileSpreadsheet,
  FileImage,
  Presentation,
  File,
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

  const isBasic = (t: any) => Array.isArray(t.subscriptionTiers) && t.subscriptionTiers.includes('trial');
  const goUpgrade = () => { window.location.href = '/subscribe'; };

export const TemplatesManager: React.FC = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { apiGetTemplates } = await import('@/lib/api');
      const res = await apiGetTemplates();
      if (res.success && res.data) setTemplates(res.data as any[]);
    })();
  }, []);
  // Auto-download a template if directed by post-auth intent
  useEffect(() => {
    const targetId = localStorage.getItem('autoDownloadTemplateId');
    if (!targetId) return;
    const t = templates.find(t => t.id === targetId);
    if (t) {
      localStorage.removeItem('autoDownloadTemplateId');
      setTimeout(() => {
        toast.info(`Downloading “${t.name}”...`);
        downloadTemplate(t);
      }, 300);
    } else {
      // No matching template -> show not found toast
      toast.error('We could not find that template. It may have been removed.');
    }
  }, [templates]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'excel': return <FileSpreadsheet className="h-4 w-4" />;
      case 'word': return <FileText className="h-4 w-4" />;
      case 'powerpoint': return <Presentation className="h-4 w-4" />;
      case 'pdf': return <File className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'excel': return 'bg-green-100 text-green-800';
      case 'word': return 'bg-blue-100 text-blue-800';
      case 'powerpoint': return 'bg-orange-100 text-orange-800';
      case 'pdf': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const canDownloadTemplate = (template: any) => {
    if (!user) return false;
    // Platform admins have full access to all templates
    if (user.role === 'admin') return true;
    if (user.subscriptionTier === 'trial') return isBasic(template);
    return template.subscriptionTiers.includes(user.subscriptionTier);
  };

  const downloadTemplate = async (template: any) => {
    if (!canDownloadTemplate(template) && localStorage.getItem('autoDownloadTemplateId') !== template.id) {
      // premium for trial: preserve intent and go upgrade
      localStorage.setItem('postAuthIntent', JSON.stringify({ id: template.id, type: 'template' }));
      window.location.href = '/subscribe';
      return;
    }
    const { apiDownloadTemplate } = await import('@/lib/api');
    const res = await apiDownloadTemplate(template.id);
    if (!res.success || !res.data) {
      alert(res.error || 'Download failed');
      return;
    }
    const blobUrl = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = template.fileName || template.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  };

  const filteredTemplates = templates.filter(template => {
    const q = searchQuery.toLowerCase();
    const matchesText = template.name.toLowerCase().includes(q) ||
      template.description.toLowerCase().includes(q) ||
      template.category.toLowerCase().includes(q);
    // Trial users can see all but can only download trial items; paid users see items allowed for their tier (already filtered by API for auth route)
    return matchesText;
  });

  const inferType = (t: any): string => {
    const ext = (t.fileName || '').toLowerCase();
    if (t.fileType) return t.fileType.toLowerCase();
    if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) return 'excel';
    if (/(\.docx?|\.rtf)$/.test(ext)) return 'word';
    if (/(\.pptx?|\.key)$/.test(ext)) return 'powerpoint';
    if (ext.endsWith('.pdf')) return 'pdf';
    return 'other';
  };
  const templatesByType = {
    all: filteredTemplates,
    excel: filteredTemplates.filter(t => inferType(t) === 'excel'),
    word: filteredTemplates.filter(t => inferType(t) === 'word'),
    powerpoint: filteredTemplates.filter(t => inferType(t) === 'powerpoint'),
    pdf: filteredTemplates.filter(t => inferType(t) === 'pdf'),
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Business Templates
          </h1>
          <p className="text-base sm:text-lg text-gray-600 mt-2">
            Download professional templates for your business needs
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      {/* Template Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 bg-gray-100 p-1 rounded-lg gap-1">
          <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm">
            All ({templatesByType.all.length})
          </TabsTrigger>
          <TabsTrigger value="excel" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm">
            Excel ({templatesByType.excel.length})
          </TabsTrigger>
          <TabsTrigger value="word" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm">
            Word ({templatesByType.word.length})
          </TabsTrigger>
          <TabsTrigger value="powerpoint" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm">
            PPT ({templatesByType.powerpoint.length})
          </TabsTrigger>
          <TabsTrigger value="pdf" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm">
            PDF ({templatesByType.pdf.length})
          </TabsTrigger>
        </TabsList>



        {Object.entries(templatesByType).map(([type, templates]) => (
          <TabsContent key={type} value={type}>
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <Card key={template.id} className="group hover:shadow-xl transition-all duration-300 border-0 shadow-md bg-white/80 backdrop-blur">
                    {/* Lock overlay for premium items when user can't access */}
                    {!canDownloadTemplate(template) && (
                      <>
                        <div className="pointer-events-none absolute inset-0 rounded-lg bg-white/60" aria-hidden="true" />
                        <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-100/90 text-amber-800 border border-amber-200 rounded px-2 py-1 text-xs font-medium">
                          <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Premium
                        </div>
                      </>
                    )}
                    {/* File info badges */}
                    <div className="absolute top-2 left-2 flex gap-2">
                      {template.fileType && (
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium">{template.fileType}</span>
                      )}
                      {template.fileSize && (
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium">{template.fileSize}</span>
                      )}
                    </div>
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors flex-shrink-0">
                          {getTypeIcon(inferType(template))}
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base sm:text-lg text-gray-900 truncate">{template.name}</CardTitle>
                        </div>
                      </div>
                      <Badge className={cn(getTypeColor(inferType(template)), "font-medium text-xs flex-shrink-0 ml-2")}>
                        {inferType(template).toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="mb-4 sm:mb-6 text-gray-600 leading-relaxed text-sm sm:text-base">
                      {template.description}
                    </CardDescription>

                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                      <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300 text-xs">
                        {template.category}
                      </Badge>
                    </div>

                    <Button
                      className="w-full transition-all duration-200 font-medium"
                      onClick={() => downloadTemplate(template)}
                      disabled={!canDownloadTemplate(template)}
                      variant={canDownloadTemplate(template) ? 'default' : 'secondary'}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {canDownloadTemplate(template) ? 'Download Template' : 'Upgrade Required'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {templates.length === 0 && (
              <div className="text-center py-12">
                <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-lg">
                  {searchQuery ? 'No templates found matching your search.' : 'No templates available in this category.'}
                </p>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};