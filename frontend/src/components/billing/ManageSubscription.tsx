import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { apiPayFastCheckout, apiCancelSubscription } from '@/lib/api';
import { AlertCircle, Calendar, CreditCard, TrendingUp, TrendingDown, ArrowLeft, Home } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNavigate } from 'react-router-dom';

export const ManageSubscription: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const getSubscriptionStatus = () => {
    if (!user) return null;
    const expiryDate = user.subscriptionExpiry instanceof Date
      ? user.subscriptionExpiry
      : new Date(user.subscriptionExpiry);
    const isActive = expiryDate > new Date();
    const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return { isActive, daysLeft, expiryDate };
  };

  const subscriptionStatus = getSubscriptionStatus();

  const handleUpgrade = async (newTier: 'diy' | 'diy_accountant', cadence: 'monthly' | 'yearly') => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiPayFastCheckout({ tier: newTier, cadence });
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Checkout failed');
      }
      // Build and auto-submit form
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = res.data.action;
      Object.entries(res.data.fields).forEach(([k, v]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = k;
        input.value = String(v);
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (e: any) {
      console.error('PayFast checkout error:', e);
      alert(`Unable to start checkout: ${e?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

const handleCancel = async () => {
  try {
    const res = await apiCancelSubscription({ reason: 'User requested cancellation via ManageSubscription UI' });
    if (!res.success) throw new Error(res.error || 'Cancellation failed');
    const effective = res.data?.effectiveAt ? new Date(res.data.effectiveAt).toLocaleDateString() : 'current period end';
    alert(`Your subscription has been cancelled and will remain active until ${effective}.`);
    setShowCancelConfirm(false);
  } catch (e: any) {
    alert(e?.message || 'Cancellation failed');
  }
};

  if (!user || !subscriptionStatus) {
    return <div>Loading...</div>;
  }

  const currentTier = user.subscriptionTier;
  const isActive = subscriptionStatus.isActive;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="p-0 h-auto font-normal text-gray-600 hover:text-gray-900"
        >
          <Home className="h-4 w-4 mr-1" />
          Dashboard
        </Button>
        <span>/</span>
        <span className="text-gray-900 font-medium">Manage Subscription</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Manage Subscription</h1>
          <p className="text-gray-600 mt-1">
            View and modify your current subscription plan
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      <Card className="border-0 shadow-md bg-white/80 backdrop-blur hover:shadow-lg transition-all duration-300">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900">Current Subscription</CardTitle>
          <CardDescription className="text-gray-600">
            Your current plan details and status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Subscription Status */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-0 shadow-sm bg-gray-50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-700">Plan Type</CardTitle>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {currentTier === 'diy' ? 'DIY' :
                   currentTier === 'diy_accountant' ? 'DIY + Accountant' : 'Trial'}
                </div>
                <Badge variant={isActive ? 'default' : 'destructive'} className="mt-1">
                  {isActive ? 'Active' : 'Expired'}
                </Badge>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-gray-50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-700">Days Remaining</CardTitle>
                <div className="p-2 bg-green-100 rounded-lg">
                  <Calendar className="h-4 w-4 text-green-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{subscriptionStatus.daysLeft}</div>
                <p className="text-xs text-gray-600 mt-1">
                  Until renewal required
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-gray-50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-700">Expiry Date</CardTitle>
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Calendar className="h-4 w-4 text-orange-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-gray-900">
                  {subscriptionStatus.expiryDate.toLocaleDateString()}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Subscription expires
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-gray-50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-700">Status</CardTitle>
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {isActive ? 'Active' : 'Expired'}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Subscription status
                </p>
              </CardContent>
            </Card>
          </div>

        </CardContent>
      </Card>

      {/* Upgrade Options */}
      {currentTier === 'diy' && (
        <Card className="border-0 shadow-md bg-white/80 backdrop-blur hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Upgrade Options
            </CardTitle>
            <CardDescription className="text-gray-600">
              Unlock additional features with a higher tier plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Card className="border border-green-200 bg-green-50/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900">DIY + Accountant</h4>
                    <p className="text-sm text-gray-600 mt-1">Access to all business tools plus advanced accountant features</p>
                  </div>
                  <div className="text-right">
                    <div className="space-x-2">
                      <Button
                        size="sm"
                        onClick={() => handleUpgrade('diy_accountant', 'monthly')}
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        R349/month
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpgrade('diy_accountant', 'yearly')}
                        disabled={loading}
                        className="border-green-600 text-green-600 hover:bg-green-50"
                      >
                        R3490/year
                      </Button>
                    </div>
                    <p className="text-xs text-green-600 mt-1">Save 17% with yearly billing</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      )}

      {/* Downgrade Options */}
      {currentTier === 'diy_accountant' && (
        <Card className="border-0 shadow-md bg-white/80 backdrop-blur hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-orange-600" />
              Downgrade Options
            </CardTitle>
            <CardDescription className="text-gray-600">
              Switch to a lower tier plan if you need fewer features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Card className="border border-orange-200 bg-orange-50/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900">DIY Plan</h4>
                    <p className="text-sm text-gray-600 mt-1">Essential business tools without advanced accountant features</p>
                  </div>
                  <div className="text-right">
                    <div className="space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpgrade('diy', 'monthly')}
                        disabled={loading}
                        className="border-orange-600 text-orange-600 hover:bg-orange-50"
                      >
                        R149/month
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpgrade('diy', 'yearly')}
                        disabled={loading}
                        className="border-orange-600 text-orange-600 hover:bg-orange-50"
                      >
                        R1490/year
                      </Button>
                    </div>
                    <p className="text-xs text-orange-600 mt-1">Change takes effect at next billing cycle</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      )}

      {/* Renewal Options */}
      <Card className="border-0 shadow-md bg-white/80 backdrop-blur hover:shadow-lg transition-all duration-300">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            Renew Current Plan
          </CardTitle>
          <CardDescription className="text-gray-600">
            Extend your current subscription with the same features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Card className="border border-blue-200 bg-blue-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">
                    {currentTier === 'diy' ? 'DIY Plan' : 'DIY + Accountant Plan'}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">Continue with your current subscription plan</p>
                </div>
                <div className="text-right">
                  <div className="space-x-2">
                    <Button
                      size="sm"
                      onClick={() => handleUpgrade(currentTier as 'diy' | 'diy_accountant', 'monthly')}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {currentTier === 'diy' ? 'R149' : 'R349'}/month
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpgrade(currentTier as 'diy' | 'diy_accountant', 'yearly')}
                      disabled={loading}
                      className="border-blue-600 text-blue-600 hover:bg-blue-50"
                    >
                      {currentTier === 'diy' ? 'R1490' : 'R3490'}/year
                    </Button>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">Save 17% with yearly billing</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Cancel Subscription */}
      <Card className="border-0 shadow-md bg-white/80 backdrop-blur hover:shadow-lg transition-all duration-300">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            Cancel Subscription
          </CardTitle>
          <CardDescription className="text-gray-600">
            Cancel your subscription if you no longer need our services
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showCancelConfirm ? (
            <div className="flex items-center justify-between p-4 border border-red-200 bg-red-50/50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">Cancel your subscription</h4>
                <p className="text-sm text-gray-600 mt-1">You'll retain access until your current billing period ends</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCancelConfirm(true)}
                className="border-red-600 text-red-600 hover:bg-red-50"
              >
                Cancel Subscription
              </Button>
            </div>
          ) : (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium">Are you sure you want to cancel?</h4>
                    <p className="text-sm mt-1">You'll lose access to all premium features at the end of your current billing period ({subscriptionStatus.expiryDate.toLocaleDateString()}).</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" onClick={handleCancel}>
                      Yes, Cancel Subscription
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowCancelConfirm(false)}>
                      Keep My Subscription
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
