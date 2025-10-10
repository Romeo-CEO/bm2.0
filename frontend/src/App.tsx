import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { DataProvider } from '@/contexts/DataContext';
import { LandingPage } from '@/pages/LandingPage';
import PublicBrowse from '@/pages/PublicBrowse';
import { MainApp } from '@/pages/MainApp';
import NotFound from './pages/NotFound';
import { BootstrapGate } from '@/components/layout/BootstrapGate';
import SubscribePage from '@/pages/SubscribePage';
import ManageSubscriptionPage from '@/pages/ManageSubscriptionPage';
import PaymentReturn from '@/pages/PaymentReturn';
import PaymentCancel from '@/pages/PaymentCancel';


const queryClient = new QueryClient();

const AppRouter = () => {
  const { isAuthenticated } = useAuth();

  const base = (import.meta as any).env?.BASE_URL === '/' ? undefined : (import.meta as any).env?.BASE_URL;
  return (
    <BrowserRouter basename={base as any}>
      <Routes>
        <Route path="/" element={isAuthenticated ? <MainApp /> : <LandingPage />} />
        <Route path="/browse" element={<PublicBrowse />} />
        <Route path="/subscribe" element={<SubscribePage />} />
        <Route path="/manage-subscription" element={<ManageSubscriptionPage />} />
        <Route path="/payment/return" element={<PaymentReturn />} />
        <Route path="/payment/cancel" element={<PaymentCancel />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <BootstrapGate>
          <DataProvider>
            <Toaster />
            <AppRouter />
          </DataProvider>
        </BootstrapGate>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
