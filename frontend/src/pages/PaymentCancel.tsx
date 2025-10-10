import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const PaymentCancel: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="max-w-xl mx-auto p-6 text-center">
      <h1 className="text-2xl font-bold mb-2">Payment Cancelled</h1>
      <p className="text-gray-600 mb-6">
        Your payment was cancelled. You can try again or return to your dashboard.
      </p>
      <div className="flex gap-2 justify-center">
        <Button onClick={() => navigate('/subscribe')}>Retry</Button>
        <Button variant="outline" onClick={() => navigate('/')}>Back to Dashboard</Button>
      </div>
    </div>
  );
};

export default PaymentCancel;

