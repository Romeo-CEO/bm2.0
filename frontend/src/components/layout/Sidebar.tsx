import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Home,
  Wrench,
  FileText,
  Calculator,
  Settings,
  Users,
  BarChart3,
  X,
  Building2
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  onClose, 
  activeTab, 
  onTabChange 
}) => {
  const { user } = useAuth();

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'business-tools', label: 'Business Tools', icon: Wrench },
    { id: 'templates', label: 'Business Templates', icon: FileText },
  ];

  const companyItems = [
    { id: 'company-profile', label: 'Company Profile', icon: Building2 },
    { id: 'company-users', label: 'Manage Users', icon: Users },
  ];

  const adminItems = [
    { id: 'admin-users', label: 'Users', icon: Users },
    { id: 'admin-apps', label: 'Applications', icon: Wrench },
    { id: 'admin-templates', label: 'Templates', icon: FileText },
    { id: 'admin-settings', label: 'Settings', icon: Settings },
    { id: 'admin-analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden" 
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={cn(
        "fixed left-0 top-0 z-50 h-full w-64 transform bg-gradient-to-b from-white to-gray-50/50 shadow-xl transition-transform duration-300 ease-in-out md:relative md:translate-x-0 border-r border-gray-200",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6 bg-white/80 backdrop-blur">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
            SaaS Platform
          </h1>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden hover:bg-gray-100"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <nav className="flex-1 space-y-2 p-4">
          {navigationItems.map((item) => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? "default" : "ghost"}
              className={cn(
                "w-full justify-start transition-all duration-200",
                activeTab === item.id 
                  ? "bg-blue-600 text-white shadow-md hover:bg-blue-700" 
                  : "hover:bg-gray-100 hover:text-gray-900"
              )}
              onClick={() => {
                onTabChange(item.id);
                onClose();
              }}
            >
              <item.icon className={cn("mr-3 h-4 w-4", activeTab === item.id ? "text-white" : "text-gray-500")} />
              <span className="font-medium">{item.label}</span>
            </Button>
          ))}

          {user?.role === 'user' && user?.companyId && (
            <>
              <div className="mt-8 mb-3">
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-100 py-1 rounded-md">
                  Company
                </h3>
              </div>
              {companyItems.map((item) => (
                <Button
                  key={item.id}
                  variant={activeTab === item.id ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start transition-all duration-200",
                    activeTab === item.id
                      ? "bg-blue-600 text-white shadow-md hover:bg-blue-700"
                      : "hover:bg-gray-100 hover:text-gray-900"
                  )}
                  onClick={() => {
                    onTabChange(item.id);
                    onClose();
                  }}
                >
                  <item.icon className={cn("mr-3 h-4 w-4", activeTab === item.id ? "text-white" : "text-gray-500")} />
                  <span className="font-medium">{item.label}</span>
                </Button>
              ))}
            </>
          )}

          {user?.role === 'admin' && (
            <>
              <div className="mt-8 mb-3">
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-100 py-1 rounded-md">
                  Admin
                </h3>
              </div>
              {adminItems.map((item) => (
                <Button
                  key={item.id}
                  variant={activeTab === item.id ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start transition-all duration-200",
                    activeTab === item.id 
                      ? "bg-blue-600 text-white shadow-md hover:bg-blue-700" 
                      : "hover:bg-gray-100 hover:text-gray-900"
                  )}
                  onClick={() => {
                    onTabChange(item.id);
                    onClose();
                  }}
                >
                  <item.icon className={cn("mr-3 h-4 w-4", activeTab === item.id ? "text-white" : "text-gray-500")} />
                  <span className="font-medium">{item.label}</span>
                </Button>
              ))}
            </>
          )}
        </nav>
      </div>
    </>
  );
};