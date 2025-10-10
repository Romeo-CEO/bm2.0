import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  User, 
  Settings, 
  CreditCard, 
  Building, 
  LogOut,
  Menu
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  onMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  const { user, logout } = useAuth();

  const getSubscriptionBadge = () => {
    if (!user) return null;
    
    // Admin users show Administrator badge
    if (user.role === 'admin') {
      return <Badge variant="default">Administrator</Badge>;
    }
    
    const badgeVariant = {
      trial: 'secondary',
      diy: 'default',
      diy_accountant: 'default'
    }[user.subscriptionTier] as 'secondary' | 'default';

    const badgeText = {
      trial: 'Trial',
      diy: 'DIY',
      diy_accountant: 'DIY + Accountant'
    }[user.subscriptionTier];

    return <Badge variant={badgeVariant}>{badgeText}</Badge>;
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
      <div className="flex h-16 items-center px-6">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden hover:bg-gray-100"
          onClick={onMenuToggle}
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        <div className="flex-1" />
        
        {user && (
          <div className="flex items-center gap-4">
            {getSubscriptionBadge()}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-gray-100 transition-colors">
                  <Avatar className="h-10 w-10 ring-2 ring-gray-100">
                    <AvatarImage src="" alt={user.firstName} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold">
                      {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Building className="mr-2 h-4 w-4" />
                  <span>Company</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span>Subscription</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </header>
  );
};