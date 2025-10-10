import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Loader2, Zap, Shield, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister }) => {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Basic client validation
    const emailTrimmed = formData.email.trim();
    if (!emailTrimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(emailTrimmed, formData.password);
      
      if (!result.success) {
        setError(result.error || 'Login failed. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md md:max-w-lg border-0 shadow-2xl bg-white/90 backdrop-blur max-h-[90vh] overflow-y-auto">
      <CardHeader className="text-center pb-4 sticky top-0 bg-white/90 backdrop-blur z-10">
        <div className="mx-auto w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mb-3 shadow-lg">
          <Zap className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-xl md:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
          Welcome Back
        </CardTitle>
        <CardDescription className="text-gray-600 text-sm md:text-base">
          Sign in to your account to continue
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 px-4 md:px-6">
          {error && (
            <Alert variant="destructive" className="border-red-200 bg-red-50 py-2 sticky top-0 z-10">
              <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-700 font-medium text-sm">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 h-10 text-sm"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password" className="text-gray-700 font-medium text-sm">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 h-10 text-sm pr-10 sm:pr-12"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-gray-400 hover:text-gray-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-3 rounded-lg border border-blue-100">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-3 h-3 text-blue-600" />
              <span className="text-xs font-medium text-blue-800">Demo Accounts</span>
            </div>
            <div className="text-xs text-blue-700 space-y-0.5">
              <p><span className="font-medium">Admin:</span> admin@example.com / password</p>
              <p><span className="font-medium">User:</span> user@example.com / password</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button 
            type="submit" 
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 h-10 text-sm font-semibold" 
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Signing In...' : 'Sign In'}
          </Button>
          
          <div className="flex items-center justify-center gap-3">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-xs text-gray-500">or</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>
          
          <p className="text-center text-xs text-gray-600">
            Don't have an account?{' '}
            <button
              type="button"
              className="font-semibold text-blue-600 hover:text-blue-500 transition-colors duration-200"
              onClick={onSwitchToRegister}
            >
              Create one now
            </button>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
};