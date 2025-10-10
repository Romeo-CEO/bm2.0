import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const PaymentReturn: React.FC = () => {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [checking, setChecking] = useState(true);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    // Poll payment status if m_payment_id present, otherwise just refresh
    const mid = new URLSearchParams(window.location.search).get('m_payment_id');
    let pollTimer: any;
    let fallbackTimer: any;
    (async () => {
      if (mid) {
        const { apiGetPaymentStatus, apiPayFastVerify } = await import('@/lib/api');
        const start = Date.now();
        const poll = async () => {
          const res = await apiGetPaymentStatus(mid);
          if (res.success && res.data) {
            if (res.data.status === 'PAID') {
              await refresh();
              setPaid(true);
              setChecking(false);
              return;
            }
          }
          if (Date.now() - start < 60000) {
            // If not PAID by ~5s, try server-side verify fallback in sandbox
            if (Date.now() - start > 5000) {
              try { await apiPayFastVerify(mid); } catch {}
            }
            pollTimer = setTimeout(poll, 1500);
          } else {
            await refresh();
            setChecking(false);
          }
        };
        // Fallback redirect so the user never has to click a button
        fallbackTimer = setTimeout(async () => {
          if (checking) {
            try { await apiPayFastVerify(mid); } catch {}
            await refresh();
            navigate('/', { replace: true });
          }
        }, 8000);
        await poll();
      } else {
        await refresh();
        // Brief delay before redirecting
        setTimeout(() => navigate('/', { replace: true }), 1200);
        setChecking(false);
      }
    })();
    return () => {
      if (pollTimer) clearTimeout(pollTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [refresh, navigate, checking]);

  useEffect(() => {
    if (paid && !checking) {
      const t = setTimeout(() => {
        navigate('/', { replace: true });
        window.location.hash = 'business-tools';
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [paid, checking, navigate]);

  return (
    <div className="max-w-xl mx-auto p-6 text-center">
      <h1 className="text-2xl font-bold mb-2">Payment Processing</h1>
      <p className="text-gray-600 mb-6">
        {checking
          ? 'Verifying your payment and updating your subscription... You will be redirected automatically.'
          : 'Subscription updated. Redirecting...'}
      </p>
      <Button variant="outline" onClick={() => navigate('/')}>Continue now</Button>
    </div>
  );
};

export default PaymentReturn;

