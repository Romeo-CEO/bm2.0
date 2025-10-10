import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { apiPayFastCheckout } from '@/lib/api';

export const Subscribe: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const [tier, setTier] = React.useState<'diy' | 'diy_accountant'>('diy');
  const [cadence, setCadence] = React.useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = React.useState(false);
  const getPrice = React.useCallback((t: 'diy'|'diy_accountant', c: 'monthly'|'yearly') => {
    const map = { diy: { monthly: 149, yearly: 1490 }, diy_accountant: { monthly: 349, yearly: 3490 } } as const;
    return map[t][c];
  }, []);
  const price = getPrice(tier, cadence);

  const handleCheckout = async () => {
    if (!user) {
      alert('Please sign in to subscribe.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiPayFastCheckout({ tier, cadence });
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

  return (
    <div className="space-y-5">
      <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur ring-1 ring-gray-100">
        <CardHeader className="pb-4">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mb-2 shadow-lg">
            <span className="text-white text-lg">⭐</span>
          </div>
          <CardTitle className="text-center text-lg md:text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Choose your plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-4 md:px-6">
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={tier === 'diy' ? 'default' : 'outline'}
              onClick={() => setTier('diy')}
              className={tier === 'diy' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : ''}
            >
              DIY
            </Button>
            <Button
              variant={tier === 'diy_accountant' ? 'default' : 'outline'}
              onClick={() => setTier('diy_accountant')}
              className={tier === 'diy_accountant' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : ''}
            >
              DIY + Accountant
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">Billing</div>
            <div className="flex gap-2">
              <Button variant={cadence==='monthly'?'default':'outline'} onClick={()=>setCadence('monthly')} className={cadence==='monthly' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : ''}>Monthly</Button>
              <Button variant={cadence==='yearly'?'default':'outline'} onClick={()=>setCadence('yearly')} className={cadence==='yearly' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : ''}>Yearly</Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">Amount</div>
            <div className="font-semibold">R{price.toFixed(2)}</div>
          </div>

          <Button
            className="w-full h-10 text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            onClick={handleCheckout}
            disabled={loading}
          >
            {loading ? 'Redirecting...' : 'Subscribe via PayFast'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

