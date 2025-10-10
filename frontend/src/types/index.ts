export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user';
  companyId?: string; // Optional for admin users
  subscriptionTier: 'trial' | 'diy' | 'diy_accountant';
  subscriptionExpiry: Date;
  isActive: boolean;
}

export interface Company {
  id: string;
  name: string;
  domain: string;
  ownerId: string;
  createdAt: Date;
  isActive: boolean;
}

export interface WebApplication {
  id: string;
  name: string;
  description: string;
  urlExtension: string; // e.g., 'crm', 'inventory' - will be used as /app/crm
  baseUrl?: string; // Optional - for external applications
  icon: string;
  category: string;
  requiredTier: 'diy' | 'diy_accountant';
  isActive: boolean;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  type: 'excel' | 'word' | 'powerpoint' | 'pdf';
  category: string;
  fileUrl: string;
  thumbnail: string;
  isActive: boolean;
}

export interface Calculator {
  id: string;
  name: string;
  description: string;
  category: 'financial' | 'business';
  component: string;
  icon: string;
  isActive: boolean;
}

export interface Subscription {
  id: string;
  userId: string;
  tier: 'trial' | 'diy' | 'diy_accountant';
  status: 'active' | 'cancelled' | 'expired';
  startDate: Date;
  endDate: Date;
  paymentMethod: string;
  amount: number;
}

export interface Application {
  id: string;
  name: string;
  description: string;
  category: string;
  type: 'application' | 'template';
  url?: string;
  downloadUrl?: string;
  fileName?: string;
  fileSize?: string;
  subscriptionTiers: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}