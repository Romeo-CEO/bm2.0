import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { apiMockActivateSubscription, apiMockCancelSubscription, apiMockExpireSubscription, apiGetPayFastSettings, apiSavePayFastSettings } from '@/lib/api';
import { CreditCard, Settings, Bell, Shield, Wrench, FileText, Users, BarChart3 } from 'lucide-react';

export const AdminSettings: React.FC = () => {
  const [payFastSettings, setPayFastSettings] = useState({
    merchantId: '',
    merchantKey: '',
    passPhrase: '',
    sandboxMode: true,
    returnUrl: '',
    cancelUrl: '',
    notifyUrl: '',
    hasPassPhrase: false,
    clearPassPhrase: false,
  } as any);
  React.useEffect(() => {
    (async () => {
      const res = await apiGetPayFastSettings();
      if (res.success && res.data) {
        setPayFastSettings({
          merchantId: res.data.merchantId || '',
          merchantKey: '', // never prefill secrets
          passPhrase: '',  // never prefill secrets
          sandboxMode: Boolean(res.data.sandbox),
          returnUrl: res.data.returnUrl || '',
          cancelUrl: res.data.cancelUrl || '',
          notifyUrl: res.data.notifyUrl || '',
          hasPassPhrase: Boolean(res.data.hasPassPhrase),
          clearPassPhrase: false,
        } as any);
      }
    })();
  }, []);


  const handlePayFastSave = async () => {
    const payload: any = {
      merchantId: payFastSettings.merchantId,
      sandbox: payFastSettings.sandboxMode,
      returnUrl: payFastSettings.returnUrl,
      cancelUrl: payFastSettings.cancelUrl,
      notifyUrl: payFastSettings.notifyUrl,
    };
    // Only send secrets if entered (non-empty)
    if (payFastSettings.merchantKey) payload.merchantKey = payFastSettings.merchantKey;
    // To clear passphrase: if user ticks clearPassPhrase and leaves passPhrase empty, send empty string
    if (payFastSettings.clearPassPhrase) {
      payload.passPhrase = '';
    } else if (payFastSettings.passPhrase) {
      payload.passPhrase = payFastSettings.passPhrase;
    }

    const res = await apiSavePayFastSettings(payload);
    if (res.success) {
      // Optionally show toast
      console.log('PayFast settings saved');
      // Clear secrets in local state after save
      setPayFastSettings((s) => ({ ...s, merchantKey: '', passPhrase: '' }));
    } else {
      console.error('Failed to save PayFast settings', res.error);
    }
  };

  // Mock subscription testing state/actions
  const [testUserId, setTestUserId] = useState('');
  const [testTier, setTestTier] = useState<'diy'|'diy_accountant'>('diy');
  const [testDays, setTestDays] = useState(30);

  const mockActivate = async () => {
    const res = await apiMockActivateSubscription({ userId: testUserId, tier: testTier, days: testDays });
    console.log('Mock activate:', res);
  };
  const mockExpire = async () => {
    const res = await apiMockExpireSubscription({ userId: testUserId });
    console.log('Mock expire:', res);
  };
  const mockCancel = async () => {
    const res = await apiMockCancelSubscription({ userId: testUserId });
    console.log('Mock cancel:', res);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-muted-foreground">
          Configure platform settings and integrations
        </p>
      </div>
      {/* Quick Management Links */}
      <Card>
        <CardHeader>
          <CardTitle>Administration</CardTitle>
          <CardDescription>Jump to management sections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button variant="outline" className="justify-start" onClick={() => { window.location.hash = 'admin-apps'; }}>
              <Wrench className="h-4 w-4 mr-2" /> Application Management
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => { window.location.hash = 'admin-templates'; }}>
              <FileText className="h-4 w-4 mr-2" /> Template Management
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => { window.location.hash = 'admin-users'; }}>
              <Users className="h-4 w-4 mr-2" /> User Management
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => { window.location.hash = 'admin-analytics'; }}>
              <BarChart3 className="h-4 w-4 mr-2" /> Analytics
            </Button>
          </div>
        </CardContent>
      </Card>


      <Tabs defaultValue="payments" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>PayFast Payment Gateway</CardTitle>
              <CardDescription>
                Configure PayFast integration for subscription payments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="merchantId">Merchant ID *</Label>
                  <Input
                    id="merchantId"
                    value={payFastSettings.merchantId}
                    onChange={(e) => setPayFastSettings({
                      ...payFastSettings,
                      merchantId: e.target.value
                    })}
                    placeholder="Enter Merchant ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="merchantKey">Merchant Key *</Label>
                  <Input
                    id="merchantKey"
                    value={payFastSettings.merchantKey}
                    onChange={(e) => setPayFastSettings({
                      ...payFastSettings,
                      merchantKey: e.target.value
                    })}
                    placeholder="Enter Merchant Key"
                    type="password"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="passPhrase">Pass Phrase</Label>
                <Input
                  id="passPhrase"
                  value={payFastSettings.passPhrase}
                  onChange={(e) => setPayFastSettings({
                    ...payFastSettings,
                    passPhrase: e.target.value
                  })}
                  placeholder="Enter Pass Phrase (Optional)"
                  type="password"
                />

              {/* Clear passphrase toggle */}
              <div className="flex items-center space-x-2">
                <Switch id="clearPass" checked={payFastSettings.clearPassPhrase} onCheckedChange={(v)=>setPayFastSettings({...payFastSettings, clearPassPhrase: Boolean(v)})} />
                <Label htmlFor="clearPass">Clear stored passphrase (switch to no-passphrase)</Label>
              </div>

              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="returnUrl">Return URL</Label>
                  <Input id="returnUrl" value={payFastSettings.returnUrl} onChange={(e)=>setPayFastSettings({...payFastSettings, returnUrl: e.target.value})} placeholder="https://yourapp/return" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cancelUrl">Cancel URL</Label>
                  <Input id="cancelUrl" value={payFastSettings.cancelUrl} onChange={(e)=>setPayFastSettings({...payFastSettings, cancelUrl: e.target.value})} placeholder="https://yourapp/cancel" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notifyUrl">Notify URL</Label>
                  <Input id="notifyUrl" value={payFastSettings.notifyUrl} onChange={(e)=>setPayFastSettings({...payFastSettings, notifyUrl: e.target.value})} placeholder="https://api.yourapp/payments/payfast/notify" />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="sandboxMode"
                  checked={payFastSettings.sandboxMode}
                  onCheckedChange={(checked) => setPayFastSettings({
                    ...payFastSettings,
                    sandboxMode: checked
                  })}
                />
                <Label htmlFor="sandboxMode">Sandbox Mode (Testing)</Label>
              </div>

              <Separator />

              <Button onClick={handlePayFastSave}>
                Save PayFast Settings
              </Button>
            </CardContent>

              {/* Mock Subscription Testing Panel (for QA without live gateway) */}
              <div className="rounded-lg border p-4">
                <div className="mb-2 font-medium">Mock Subscription Testing</div>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <Label htmlFor="testUserId">User ID</Label>
                    <Input id="testUserId" value={testUserId} onChange={(e) => setTestUserId(e.target.value)} placeholder="user_..." />
                  </div>
                  <div>
                    <Label htmlFor="testTier">Tier</Label>
                    <select id="testTier" className="w-full border rounded h-9 px-2" value={testTier} onChange={(e) => setTestTier(e.target.value as any)}>
                      <option value="diy">DIY</option>
                      <option value="diy_accountant">DIY + Accountant</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="testDays">Days</Label>
                    <Input id="testDays" type="number" value={testDays} onChange={(e) => setTestDays(parseInt(e.target.value || '0', 10))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="default" onClick={mockActivate}>Activate</Button>
                  <Button type="button" variant="outline" onClick={mockExpire}>Expire</Button>
                  <Button type="button" variant="destructive" onClick={mockCancel}>Cancel/Downgrade</Button>
                </div>
              </div>

          </Card>
        </TabsContent>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Platform Settings</CardTitle>
              <CardDescription>
                General platform configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="platformName">Platform Name</Label>
                <Input
                  id="platformName"
                  defaultValue="SaaS Platform"
                  placeholder="Enter platform name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supportEmail">Support Email</Label>
                <Input
                  id="supportEmail"
                  defaultValue="support@saasplatform.com"
                  placeholder="Enter support email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyAddress">Company Address</Label>
                <Input
                  id="companyAddress"
                  placeholder="Enter company address"
                />
              </div>
              <Button>Save General Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Configure email and system notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>New User Registration</Label>
                  <p className="text-sm text-muted-foreground">
                    Send email when new users register
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Payment Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send email for successful payments
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>System Maintenance</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify users about maintenance windows
                  </p>
                </div>
                <Switch />
              </div>
              <Button>Save Notification Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Configure security and access controls
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    Require 2FA for admin accounts
                  </p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Session Timeout</Label>
                  <p className="text-sm text-muted-foreground">
                    Auto-logout after inactivity (minutes)
                  </p>
                </div>
                <Input className="w-20" defaultValue="30" />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Failed Login Attempts</Label>
                  <p className="text-sm text-muted-foreground">
                    Lock account after failed attempts
                  </p>
                </div>
                <Input className="w-20" defaultValue="5" />
              </div>
              <Button>Save Security Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};