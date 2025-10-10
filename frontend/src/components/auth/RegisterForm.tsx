import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Loader2, Zap, Sparkles, Building, CheckCircle2, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const validateStep = (s: 1 | 2 | 3): string | null => {
    const firstName = formData.firstName.trim();
    const lastName = formData.lastName.trim();
    const email = formData.email.trim();
    const companyName = formData.companyName.trim();
    if (s === 1) {
      if (!firstName) return 'First name is required';
      if (!lastName) return 'Last name is required';
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email';
      return null;
    }
    if (s === 2) {
      if (!companyName) return 'Company name is required';
      if (!formData.password || formData.password.length < 6) return 'Password must be at least 6 characters';
      if (formData.password !== formData.confirmPassword) return 'Passwords do not match';
      return null;
    }
    return null;
  };

  const nextStep = () => {
    setError('');
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setStep((prev) => (prev < 3 ? ((prev + 1) as 1 | 2 | 3) : prev));
  };

  const prevStep = () => setStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3) : prev));

  const progressPct = step === 1 ? 33 : step === 2 ? 66 : 100;
  const stepMinHeight = step === 1 ? 220 : step === 2 ? 360 : 200;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate final step
    const err = validateStep(2); // ensure company & password valid before submit
    if (err) { setError(err); return; }

    setIsLoading(true);

    try {
      const result = await register({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        companyName: formData.companyName.trim(),
      }, formData.password);

      if (!result.success) {
        setError(result.error || 'Registration failed. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md md:max-w-lg border-0 shadow-2xl bg-white/95 backdrop-blur">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mb-3 shadow-lg">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-xl md:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
          Start Your Journey
        </CardTitle>
        <CardDescription className="text-gray-600 text-sm md:text-base">
          Create your account and start your free trial today
        </CardDescription>
        <div className="mt-4">
          <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="mt-2 text-xs text-gray-600">Step {step} of 3</div>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit} className="pb-4">
        <CardContent className="space-y-6 px-4 md:px-6">
          {error && (
            <Alert variant="destructive" className="border-red-200 bg-red-50 py-2">
              <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <div className="relative" style={{ minHeight: stepMinHeight }}>
            <div className={cn("transition-all duration-300", step === 1 ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-6 pointer-events-none absolute inset-0")}>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-gray-700 font-medium text-sm">First Name</Label>
                    <Input id="firstName" placeholder="John" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 h-10 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-gray-700 font-medium text-sm">Last Name</Label>
                    <Input id="lastName" placeholder="Doe" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 h-10 text-sm" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700 font-medium text-sm">Email Address</Label>
                  <Input id="email" type="email" placeholder="john@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 h-10 text-sm" />
                </div>
              </div>
            </div>

            <div className={cn("transition-all duration-300 absolute inset-0", step === 2 ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6 pointer-events-none")}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName" className="text-gray-700 font-medium text-sm flex items-center gap-2">
                    <Building className="w-3 h-3 text-blue-600" />
                    Company Name
                  </Label>
                  <Input id="companyName" placeholder="Your Company Name" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} required className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 h-10 text-sm" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-gray-700 font-medium text-sm">Password</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 text-xs">
                          <HelpCircle className="w-3 h-3" /> Rules
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          <div className="text-xs space-y-1">
                            <p>• At least 6 characters</p>
                            <p>• Use a mix of letters and numbers</p>
                            <p>• Avoid common words</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="relative">
                    <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Create a password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 h-10 text-sm pr-10 sm:pr-12" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-gray-400 hover:text-gray-600" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? (<EyeOff className="h-4 w-4" />) : (<Eye className="h-4 w-4" />)}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-gray-700 font-medium text-sm">Confirm Password</Label>
                  <Input id="confirmPassword" type="password" placeholder="Confirm your password" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} required className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 h-10 text-sm" />
                </div>
              </div>
            </div>

            <div className={cn("transition-all duration-300 absolute inset-0", step === 3 ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6 pointer-events-none")}>
              <div className="space-y-4 text-left">
                <p className="text-sm text-gray-700">Review your details before creating your account:</p>
                <ul className="text-sm text-gray-800 space-y-1">
                  <li><span className="font-medium">Name:</span> {formData.firstName} {formData.lastName}</li>
                  <li><span className="font-medium">Email:</span> {formData.email}</li>
                  <li><span className="font-medium">Company:</span> {formData.companyName}</li>
                </ul>
                <p className="text-xs text-gray-500">By continuing, you agree to our Terms of Service and Privacy Policy.</p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="flex gap-3 w-full">
            {step > 1 && (
              <Button variant="outline" className="flex-1" type="button" onClick={prevStep}>Back</Button>
            )}
            {step < 3 && (
              <Button className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white" type="button" onClick={nextStep}>Next</Button>
            )}
            {step === 3 && (
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? 'Creating Account...' : 'Complete Registration'}
              </Button>
            )}
          </div>

          <div className="flex items-center justify-center gap-3">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-xs text-gray-500">or</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          <p className="text-center text-xs text-gray-600">
            Already have an account?{' '}
            <button
              type="button"
              className="font-semibold text-blue-600 hover:text-blue-500 transition-colors duration-200"
              onClick={onSwitchToLogin}
            >
              Sign in here
            </button>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
};