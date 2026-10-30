import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getWhatsAppNumber, saveWhatsAppNumber } from '../lib/storeSettings';

type StoreSettingsContextValue = {
  whatsappNumber: string;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  saveWhatsappNumber: (value: string) => Promise<void>;
};

const StoreSettingsContext = createContext<StoreSettingsContextValue | null>(null);

export function StoreSettingsProvider({ children }: { children: ReactNode }) {
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setWhatsappNumber(await getWhatsAppNumber());
    } catch (reason) {
      setWhatsappNumber('');
      setError(reason instanceof Error ? reason.message : 'Erro inesperado ao carregar as configurações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (value: string) => {
    setError('');
    const savedNumber = await saveWhatsAppNumber(value);
    setWhatsappNumber(savedNumber);
  }, []);

  const value = useMemo(() => ({
    whatsappNumber,
    loading,
    error,
    refresh,
    saveWhatsappNumber: save,
  }), [whatsappNumber, loading, error, refresh, save]);

  return <StoreSettingsContext.Provider value={value}>{children}</StoreSettingsContext.Provider>;
}

export function useStoreSettings() {
  const context = useContext(StoreSettingsContext);
  if (!context) throw new Error('useStoreSettings deve ser usado dentro de StoreSettingsProvider.');
  return context;
}
