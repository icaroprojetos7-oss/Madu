import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { resolveAdminPermission, type AdminRole } from '../lib/adminAuth';

type AdminAuthContextValue = {
  user: User | null;
  role: AdminRole | null;
  loading: boolean;
  roleLoading: boolean;
  roleError: string;
  configured: boolean;
  refreshRole: () => Promise<void>;
  refreshSession: () => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<{ error: string | null; role: AdminRole | null }>;
  signOut: () => Promise<string | null>;
  sendPasswordReset: (email: string) => Promise<string | null>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

type PermissionCheckResult = { role: AdminRole | null; error: string | null };

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [roleError, setRoleError] = useState('');
  const roleRequestId = useRef(0);
  const roleRequest = useRef<{ userId: string; promise: Promise<PermissionCheckResult> } | null>(null);

  const refreshRoleForUser = useCallback((targetUser: User, force = false): Promise<PermissionCheckResult> => {
    if (!force && roleRequest.current?.userId === targetUser.id) {
      return roleRequest.current.promise;
    }

    const requestId = ++roleRequestId.current;
    setRoleLoading(true);
    setRoleError('');

    const request = (async (): Promise<PermissionCheckResult> => {
      try {
        if (!supabase) {
          return { role: null, error: 'Supabase não configurado.' };
        }

        const { data, error } = await supabase
          .from('admin_user_permissions')
          .select('user_id, email, role, is_active, status')
          .eq('user_id', targetUser.id)
          .eq('is_active', true)
          .eq('status', 'active')
          .maybeSingle();

        if (requestId !== roleRequestId.current) return { role: null, error: null };
        if (error) {
          const message = `Não foi possível verificar as permissões: ${error.message}`;
          setRole(null);
          setRoleError(message);
          return { role: null, error: message };
        }

        const currentRole = resolveAdminPermission(data, targetUser);
        setRole(currentRole);
        return { role: currentRole, error: null };
      } catch (reason) {
        if (requestId !== roleRequestId.current) return { role: null, error: null };
        const message = `Não foi possível verificar as permissões: ${reason instanceof Error ? reason.message : 'erro inesperado.'}`;
        setRole(null);
        setRoleError(message);
        return { role: null, error: message };
      } finally {
        if (requestId === roleRequestId.current) setRoleLoading(false);
      }
    })();

    const trackedRequest = request.finally(() => {
      if (roleRequest.current?.promise === trackedRequest) roleRequest.current = null;
    });
    roleRequest.current = { userId: targetUser.id, promise: trackedRequest };
    return trackedRequest;
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;
    let authEventReceived = false;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventReceived = true;
      roleRequestId.current += 1;
      roleRequest.current = null;
      if (active) {
        setUser(session?.user ?? null);
        setRole(null);
        setRoleError('');
        setRoleLoading(Boolean(session?.user));
        setLoading(false);
      }
      if (session?.user) {
        window.setTimeout(() => {
          if (active) void refreshRoleForUser(session.user);
        }, 0);
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || authEventReceived) return;
      if (error) console.error('Não foi possível restaurar a sessão administrativa.', error);
      setUser(data.session?.user ?? null);
      setRoleLoading(Boolean(data.session?.user));
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [refreshRoleForUser]);

  const refreshRole = useCallback(async () => {
    if (!supabase || !user) {
      roleRequestId.current += 1;
      setRole(null);
      setRoleError('');
      setRoleLoading(false);
      return;
    }

    await refreshRoleForUser(user);
  }, [refreshRoleForUser, user]);

  useEffect(() => {
    void refreshRole();
  }, [refreshRole]);

  const value = useMemo<AdminAuthContextValue>(() => ({
    user,
    role,
    loading,
    roleLoading,
    roleError,
    configured: Boolean(supabase),
    refreshRole,
    refreshSession: async () => {
      if (!supabase) return 'Supabase não configurado.';
      const { error } = await supabase.auth.refreshSession();
      return error?.message ?? null;
    },
    signIn: async (email, password) => {
      if (!supabase) return { error: 'Supabase não configurado.', role: null };
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message, role: null };
      if (!data.user) return { error: 'O Supabase não retornou a conta autenticada.', role: null };

      setUser(data.user);
      setRole(null);
      setRoleError('');
      const authorization = await refreshRoleForUser(data.user);
      return { error: authorization.error, role: authorization.role };
    },
    signOut: async () => {
      if (!supabase) return 'Supabase não configurado.';
      const { error } = await supabase.auth.signOut();
      return error?.message ?? null;
    },
    sendPasswordReset: async (email) => {
      if (!supabase) return 'Supabase não configurado.';
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/admin/login`,
      });
      return error?.message ?? null;
    },
  }), [user, role, loading, roleLoading, roleError, refreshRole, refreshRoleForUser]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth deve ser usado dentro de AdminAuthProvider.');
  return context;
}
