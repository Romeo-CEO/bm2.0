import React from 'react';
import { ManageSubscription } from '@/components/billing/ManageSubscription';

const ManageSubscriptionPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <ManageSubscription />
      </div>
    </div>
  );
};

export default ManageSubscriptionPage;
