import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Building2, 
  Upload, 
  Save, 
  MapPin, 
  Phone, 
  Globe, 
  Palette,
  Users,
  FileText,
  Settings
} from 'lucide-react';

interface CompanyProfile {
  id: string;
  name: string;
  domain: string;
  logoUrl?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  website?: string;
  taxNumber?: string;
  registrationNumber?: string;
  primaryColor: string;
  secondaryColor: string;
  companyDescription?: string;
  industry?: string;
  employeeCount?: string;
  timezone: string;
  currency: string;
}

export const CompanyProfile: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCompanyAdmin = user?.role === 'user' && user?.companyId;
  const isPlatformAdmin = user?.role === 'admin';

  useEffect(() => {
    loadCompanyProfile();
  }, [user]);

  const loadCompanyProfile = async () => {
    if (!user?.companyId && !isPlatformAdmin) return;

    try {
      setLoading(true);
      const { apiGetCompanyProfile } = await import('@/lib/api');
      const res = await apiGetCompanyProfile(user?.companyId);

      if (res.success && res.data) {
        // Map API response to component state
        const data = res.data;
        setProfile({
          id: data.id,
          name: data.name || '',
          domain: data.domain || '',
          logoUrl: data.logo_url || data.logoUrl || '',
          addressLine1: data.address_line1 || data.addressLine1 || '',
          addressLine2: data.address_line2 || data.addressLine2 || '',
          city: data.city || '',
          stateProvince: data.state_province || data.stateProvince || '',
          postalCode: data.postal_code || data.postalCode || '',
          country: data.country || '',
          phone: data.phone || '',
          website: data.website || '',
          taxNumber: data.tax_number || data.taxNumber || '',
          registrationNumber: data.registration_number || data.registrationNumber || '',
          primaryColor: data.primary_color || data.primaryColor || '#3B82F6',
          secondaryColor: data.secondary_color || data.secondaryColor || '#1E40AF',
          companyDescription: data.company_description || data.companyDescription || '',
          industry: data.industry || '',
          employeeCount: data.employee_count || data.employeeCount || '',
          timezone: data.timezone || 'UTC',
          currency: data.currency || 'ZAR'
        });
      } else {
        console.error('Failed to load company profile:', res.error);
        // Set default profile for new companies
        setProfile({
          id: user?.companyId || 'new-company',
          name: '',
          domain: '',
          logoUrl: '',
          addressLine1: '',
          addressLine2: '',
          city: '',
          stateProvince: '',
          postalCode: '',
          country: '',
          phone: '',
          website: '',
          taxNumber: '',
          registrationNumber: '',
          primaryColor: '#3B82F6',
          secondaryColor: '#1E40AF',
          companyDescription: '',
          industry: '',
          employeeCount: '',
          timezone: 'UTC',
          currency: 'ZAR'
        });
      }
    } catch (error) {
      console.error('Failed to load company profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    try {
      setSaving(true);
      const { apiUploadCompanyLogo, apiUpdateCompanyProfile } = await import('@/lib/api');

      let updatedProfile = { ...profile };

      // Upload logo if a new file was selected
      if (logoFile) {
        const logoRes = await apiUploadCompanyLogo(logoFile);
        if (logoRes.success && logoRes.data) {
          updatedProfile.logoUrl = logoRes.data.url;
          setProfile(updatedProfile);
          setLogoPreview(null);
          setLogoFile(null);
        } else {
          console.error('Failed to upload logo:', logoRes.error);
          alert('Failed to upload logo: ' + logoRes.error);
          return;
        }
      }

      // Convert camelCase to snake_case for API
      const apiProfile = {
        name: updatedProfile.name,
        domain: updatedProfile.domain,
        logo_url: updatedProfile.logoUrl,
        address_line1: updatedProfile.addressLine1,
        address_line2: updatedProfile.addressLine2,
        city: updatedProfile.city,
        state_province: updatedProfile.stateProvince,
        postal_code: updatedProfile.postalCode,
        country: updatedProfile.country,
        phone: updatedProfile.phone,
        website: updatedProfile.website,
        tax_number: updatedProfile.taxNumber,
        registration_number: updatedProfile.registrationNumber,
        primary_color: updatedProfile.primaryColor,
        secondary_color: updatedProfile.secondaryColor,
        company_description: updatedProfile.companyDescription,
        industry: updatedProfile.industry,
        employee_count: updatedProfile.employeeCount,
        timezone: updatedProfile.timezone,
        currency: updatedProfile.currency
      };

      const res = await apiUpdateCompanyProfile(apiProfile, user?.companyId);
      if (!res.success) throw new Error(res.error);

      alert('Company profile saved successfully!');
    } catch (error) {
      console.error('Failed to save company profile:', error);
      alert('Failed to save company profile: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = (field: keyof CompanyProfile, value: string) => {
    if (!profile) return;
    setProfile({ ...profile, [field]: value });
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading company profile...</div>;
  }

  if (!profile) {
    return <div className="text-center p-8">No company profile found.</div>;
  }

  if (!isCompanyAdmin && !isPlatformAdmin) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-600">You don't have permission to manage company settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Company Profile</h1>
          <p className="text-muted-foreground">
            Manage your company information and branding
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="address">Address</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company Information
              </CardTitle>
              <CardDescription>
                Basic company details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Company Name</Label>
                  <Input
                    id="name"
                    value={profile.name}
                    onChange={(e) => updateProfile('name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain</Label>
                  <Input
                    id="domain"
                    value={profile.domain}
                    onChange={(e) => updateProfile('domain', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={profile.phone || ''}
                    onChange={(e) => updateProfile('phone', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={profile.website || ''}
                    onChange={(e) => updateProfile('website', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="taxNumber">Tax Number</Label>
                  <Input
                    id="taxNumber"
                    value={profile.taxNumber || ''}
                    onChange={(e) => updateProfile('taxNumber', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registrationNumber">Registration Number</Label>
                  <Input
                    id="registrationNumber"
                    value={profile.registrationNumber || ''}
                    onChange={(e) => updateProfile('registrationNumber', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Company Description</Label>
                <Textarea
                  id="description"
                  value={profile.companyDescription || ''}
                  onChange={(e) => updateProfile('companyDescription', e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="address" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Business Address
              </CardTitle>
              <CardDescription>
                Physical address for your business
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="addressLine1">Address Line 1</Label>
                <Input
                  id="addressLine1"
                  value={profile.addressLine1 || ''}
                  onChange={(e) => updateProfile('addressLine1', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input
                  id="addressLine2"
                  value={profile.addressLine2 || ''}
                  onChange={(e) => updateProfile('addressLine2', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={profile.city || ''}
                    onChange={(e) => updateProfile('city', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stateProvince">State/Province</Label>
                  <Input
                    id="stateProvince"
                    value={profile.stateProvince || ''}
                    onChange={(e) => updateProfile('stateProvince', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input
                    id="postalCode"
                    value={profile.postalCode || ''}
                    onChange={(e) => updateProfile('postalCode', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={profile.country || ''}
                    onChange={(e) => updateProfile('country', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Company Branding
              </CardTitle>
              <CardDescription>
                Logo and brand colors for your workspace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Company Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                    {logoPreview || profile.logoUrl ? (
                      <img 
                        src={logoPreview || profile.logoUrl} 
                        alt="Company Logo" 
                        className="w-full h-full object-contain rounded-lg"
                      />
                    ) : (
                      <Building2 className="h-8 w-8 text-gray-400" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Logo
                    </Button>
                    <p className="text-xs text-gray-500">
                      PNG, JPG up to 2MB. Recommended: 200x200px
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={profile.primaryColor}
                      onChange={(e) => updateProfile('primaryColor', e.target.value)}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={profile.primaryColor}
                      onChange={(e) => updateProfile('primaryColor', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">Secondary Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="secondaryColor"
                      type="color"
                      value={profile.secondaryColor}
                      onChange={(e) => updateProfile('secondaryColor', e.target.value)}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={profile.secondaryColor}
                      onChange={(e) => updateProfile('secondaryColor', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Company Settings
              </CardTitle>
              <CardDescription>
                Additional company preferences and settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <select
                    id="industry"
                    value={profile.industry || ''}
                    onChange={(e) => updateProfile('industry', e.target.value)}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="">Select Industry</option>
                    <option value="Technology">Technology</option>
                    <option value="Finance">Finance</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Education">Education</option>
                    <option value="Retail">Retail</option>
                    <option value="Manufacturing">Manufacturing</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employeeCount">Employee Count</Label>
                  <select
                    id="employeeCount"
                    value={profile.employeeCount || ''}
                    onChange={(e) => updateProfile('employeeCount', e.target.value)}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="">Select Size</option>
                    <option value="1-10">1-10 employees</option>
                    <option value="11-50">11-50 employees</option>
                    <option value="51-200">51-200 employees</option>
                    <option value="201-500">201-500 employees</option>
                    <option value="500+">500+ employees</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <select
                    id="timezone"
                    value={profile.timezone}
                    onChange={(e) => updateProfile('timezone', e.target.value)}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="UTC">UTC</option>
                    <option value="Africa/Johannesburg">South Africa (SAST)</option>
                    <option value="Europe/London">London (GMT)</option>
                    <option value="America/New_York">New York (EST)</option>
                    <option value="America/Los_Angeles">Los Angeles (PST)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <select
                    id="currency"
                    value={profile.currency}
                    onChange={(e) => updateProfile('currency', e.target.value)}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="ZAR">South African Rand (ZAR)</option>
                    <option value="USD">US Dollar (USD)</option>
                    <option value="EUR">Euro (EUR)</option>
                    <option value="GBP">British Pound (GBP)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
