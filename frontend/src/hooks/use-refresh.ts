import { useState } from 'react';
import { toast } from '@/components/ui/sonner';

export interface ApiListResult<T> {
  success: boolean;
  data?: T[];
  error?: string;
}

export function useRefreshList<T>(
  fetcher: () => Promise<ApiListResult<T>>,
  setList: (items: T[]) => void,
  label = 'Items'
) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetcher();
      if (res.success && res.data) {
        setList(res.data);
        toast.success(`${label} refreshed`);
      } else {
        throw new Error(res.error || `Failed to refresh ${label.toLowerCase()}`);
      }
    } catch (e: any) {
      toast.error(e?.message || `Failed to refresh ${label.toLowerCase()}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  return { isRefreshing, refresh };
}
