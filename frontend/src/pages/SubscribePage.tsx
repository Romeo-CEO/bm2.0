import React from 'react';
import { Subscribe } from '@/components/billing/Subscribe';

const SubscribePage: React.FC = () => {
  return (
    <div className="min-h-[90vh] grid place-items-center p-6 md:p-8 bg-gradient-to-b from-white to-gray-50">
      <div className="w-full max-w-md">
        <div className="mx-auto w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mb-3 shadow-lg">
          <span className="text-white text-xl">💳</span>
        </div>
        <h1 className="text-xl md:text-2xl font-bold mb-4 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent text-center">Subscribe</h1>
        <Subscribe />
      </div>
    </div>
  );
};

export default SubscribePage;

