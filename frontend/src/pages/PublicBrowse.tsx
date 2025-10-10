import React from 'react';
import { apiGetPublicApplicationsPaged, PublicAppItem, apiGetPublicTemplatesPaged, PublicTemplateItem } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const categories = [
  { key: 'accounting', label: 'Accounting & Finance' },
  { key: 'hr', label: 'Human Resources' },
  { key: 'sales', label: 'Sales & Marketing' },
  { key: 'project', label: 'Project Management' },
  { key: 'calculators', label: 'Calculators' },
  { key: 'general', label: 'General' },
];


const labelFromType = (fileType?: string | null, fileName?: string | null) => {
  const t = (fileType || '').toLowerCase();
  const ext = (fileName || '').toLowerCase();
  if (t.includes('spreadsheet') || t.includes('ms-excel') || /\.(xlsx?|xlsm|xls)$/.test(ext)) return 'Excel';
  if (t.includes('word') || t.includes('msword') || /\.(docx?|rtf)$/.test(ext)) return 'Word';
  if (t.includes('powerpoint') || /\.(pptx?|key)$/.test(ext)) return 'PowerPoint';
  if (t.includes('pdf') || ext.endsWith('.pdf')) return 'PDF';
  return 'File';
};
const tierLabel = (t: string) => t === 'diy' ? 'DIY' : t === 'diy_accountant' ? 'DIY + Accountant' : t;

const AppCard: React.FC<{ item: PublicAppItem; onUse: (item: PublicAppItem) => void; }> = ({ item, onUse }) => {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{item.name}</span>
          <div className="flex gap-2">
            {item.subscriptionTiers?.map(t => (
              <Badge key={t} variant="outline">{tierLabel(t)}</Badge>
            ))}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {item.images?.length && /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(item.images[0]) ? (
          <img src={item.images[0]} alt={item.name} className="w-full h-40 object-cover rounded" />
        ) : null}
        <p className="text-sm text-gray-600">{item.description}</p>
        {item.features?.length ? (
          <ul className="list-disc pl-4 text-sm text-gray-700">
            {item.features.slice(0, 4).map((f, i) => (<li key={i}>{f}</li>))}
          </ul>
        ) : null}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700">Application</span>
          {item.price ? <span className="font-semibold">R{item.price}</span> : null}
        </div>
        <Button className="w-full" onClick={() => onUse(item)}>
          Sign up to use this tool
        </Button>
      </CardContent>
    </Card>
  );
};

const TemplateCard: React.FC<{ item: PublicTemplateItem; onUse: (id: string) => void; }> = ({ item, onUse }) => {
  return (
    <Card className="h-full relative">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{item.name}</span>
          <div className="flex gap-2">
            {item.subscriptionTiers?.map(t => (
              <Badge key={t} variant="outline">{tierLabel(t)}</Badge>
            ))}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-600">{item.description}</p>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium">{labelFromType(item.fileType, item.fileName)}</span>
          {item.fileSize && (
            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium">{item.fileSize}</span>
          )}
        </div>
        <Button className="w-full" onClick={() => onUse(item.id)}>Login to download</Button>
      </CardContent>
    </Card>
  );
};

const PublicBrowse: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = React.useState<PublicAppItem[]>([]);
  const [q, setQ] = React.useState('');
  const [type, setType] = React.useState<'application' | 'template' | ''>('');
  const [templates, setTemplates] = React.useState<PublicTemplateItem[]>([]);
  const [appsPage, setAppsPage] = React.useState(1);
  const [appsPageSize, setAppsPageSize] = React.useState(12);
  const [appsTotal, setAppsTotal] = React.useState(0);
  const [templatesPage, setTemplatesPage] = React.useState(1);
  const [templatesPageSize, setTemplatesPageSize] = React.useState(12);
  const [templatesTotal, setTemplatesTotal] = React.useState(0);
  const [appsSortBy, setAppsSortBy] = React.useState<'date'|'name'>('date');
  const [appsSortDir, setAppsSortDir] = React.useState<'asc'|'desc'>('desc');
  const [templatesSortBy, setTemplatesSortBy] = React.useState<'date'|'name'>('date');
  const [templatesSortDir, setTemplatesSortDir] = React.useState<'asc'|'desc'>('desc');


  const fetchTemplates = React.useCallback(async () => {
    const res = await apiGetPublicTemplatesPaged({ q, category: category || undefined, page: templatesPage, pageSize: templatesPageSize, sortBy: templatesSortBy, sortDir: templatesSortDir });
    if (res.success && res.data) {
      setTemplates(res.data.items);
      setTemplatesTotal(res.data.total);
    }
  }, [q, category, templatesPage, templatesPageSize, templatesSortBy, templatesSortDir]);
  const [category, setCategory] = React.useState<string>('');

  const fetchItems = React.useCallback(async () => {
    const res = await apiGetPublicApplicationsPaged({ q, type: type || undefined, category: category || undefined, page: appsPage, pageSize: appsPageSize, sortBy: appsSortBy, sortDir: appsSortDir });
    if (res.success && res.data) {
      setItems(res.data.items);
      setAppsTotal(res.data.total);
    }
  }, [q, type, category, appsPage, appsPageSize, appsSortBy, appsSortDir]);

  React.useEffect(() => { fetchItems(); fetchTemplates(); }, [fetchItems, fetchTemplates]);

  const handleUse = (item: PublicAppItem) => {
    const intentObj = { id: item.id, type: item.type } as const;
    localStorage.setItem('postAuthIntent', JSON.stringify(intentObj));
    if (isAuthenticated) {
      // User is logged in: navigate to tool or trigger download
      if (item.type === 'application') {
        navigate('/');
        window.location.hash = 'business-tools';
      } else {
        // Template: go to templates tab and trigger auto-download via TemplatesManager
        navigate('/');
        window.location.hash = 'templates';
        localStorage.setItem('autoDownloadTemplateId', item.id);
      }
    } else {
      // Not logged in: redirect to LandingPage with intent markers
      const intent = encodeURIComponent(JSON.stringify(intentObj));
      navigate(`/?intent=${intent}`);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Browse Business Tools & Templates</h1>
          <div className="flex items-center gap-2 text-sm">
            <span>Sort:</span>
            <select className="border rounded h-8 px-2" value={appsSortBy} onChange={(e)=>{ setAppsSortBy(e.target.value as any); setAppsPage(1); }}>
              <option value="date">Date</option>
              <option value="name">Name</option>
            </select>
            <select className="border rounded h-8 px-2" value={appsSortDir} onChange={(e)=>{ setAppsSortDir(e.target.value as any); setAppsPage(1); }}>
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>

        {/* Applications Section */}
        <h2 className="text-lg font-semibold">Applications</h2>
        <div className="flex items-center justify-between my-2">
          <div />
          <div className="flex items-center gap-2 text-sm">
            <span>Page size:</span>
            <select className="border rounded h-8 px-2" value={appsPageSize} onChange={(e)=>{ setAppsPageSize(Number(e.target.value)); setAppsPage(1); }}>
              {[6,12,18,24,36,48].map(n => (<option key={n} value={n}>{n}</option>))}
            </select>
          </div>
        </div>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-3 flex gap-2">
            <Input placeholder="Search tools and templates" value={q} onChange={(e)=>setQ(e.target.value)} />
            <Button onClick={() => { fetchItems(); fetchTemplates(); }}>Search</Button>
          </div>
          <div className="flex gap-2">
            <select className="w-full border rounded h-9 px-2" value={category} onChange={(e)=>{ setCategory(e.target.value); setAppsPage(1); setTemplatesPage(1); }}>
              <option value="">All Categories</option>
              {categories.map(c => (<option key={c.key} value={c.key}>{c.label}</option>))}
            </select>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <AppCard key={item.id} item={item} onUse={handleUse} />
          ))}
        </div>

          {/* Applications pagination */}
          <div className="flex justify-center items-center gap-3 mt-4">
            <Button variant="outline" disabled={appsPage<=1} onClick={()=>setAppsPage(p=>Math.max(1,p-1))}>Prev</Button>
            <span className="text-sm">Page {appsPage} of {Math.max(1, Math.ceil(appsTotal / appsPageSize))}</span>
            <Button variant="outline" disabled={appsPage >= Math.ceil(appsTotal / appsPageSize)} onClick={()=>setAppsPage(p=>p+1)}>Next</Button>
          </div>

          {/* Templates controls */}
          <div className="flex items-center justify-between my-6">
            <h2 className="text-lg font-semibold">Templates</h2>
            <div className="flex items-center gap-2 text-sm">
              <span>Page size:</span>
              <select className="border rounded h-8 px-2" value={templatesPageSize} onChange={(e)=>{ setTemplatesPageSize(Number(e.target.value)); setTemplatesPage(1); }}>
                {[6,12,18,24,36,48].map(n => (<option key={n} value={n}>{n}</option>))}
              </select>
            </div>
          </div>

          {/* Templates Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(t => (
              <TemplateCard key={t.id} item={t} onUse={(id) => {
                const intentObj = { id, type: 'template' } as const;
                localStorage.setItem('postAuthIntent', JSON.stringify(intentObj));
                if (isAuthenticated) {
                  navigate('/'); window.location.hash = 'templates'; localStorage.setItem('autoDownloadTemplateId', id);
                } else {
                  navigate(`/?intent=${encodeURIComponent(JSON.stringify(intentObj))}`);
                }
              }} />
            ))}
          </div>

          {/* Templates pagination */}
          <div className="flex justify-center items-center gap-3 mt-4">
            <Button variant="outline" disabled={templatesPage<=1} onClick={()=>setTemplatesPage(p=>Math.max(1,p-1))}>Prev</Button>
            <span className="text-sm">Page {templatesPage} of {Math.max(1, Math.ceil(templatesTotal / templatesPageSize))}</span>
            <Button variant="outline" disabled={templatesPage >= Math.ceil(templatesTotal / templatesPageSize)} onClick={()=>setTemplatesPage(p=>p+1)}>Next</Button>
          </div>

      </div>
    </div>
  );
};

export default PublicBrowse;

