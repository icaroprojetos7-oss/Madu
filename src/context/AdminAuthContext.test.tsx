import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAuthProvider, useAdminAuth } from './AdminAuthContext';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  onAuthStateChange: vi.fn(),
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  refreshSession: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  emitAuth: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: mocks.from,
    auth: {
      onAuthStateChange: mocks.onAuthStateChange,
      getSession: mocks.getSession,
      signInWithPassword: mocks.signInWithPassword,
      refreshSession: mocks.refreshSession,
      signOut: mocks.signOut,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
    },
  },
}));

const authenticatedUser = {
  id: 'auth-user-id',
  email: 'Owner@Example.com',
  app_metadata: {},
};

function Consumer() {
  const { role, roleError, signIn } = useAdminAuth();
  return (
    <>
      <output data-testid="role">{role ?? 'none'}</output>
      <output data-testid="role-error">{roleError}</output>
      <button type="button" onClick={() => mocks.emitAuth()}>Emit sign in</button>
      <button
        type="button"
        onClick={() => void signIn('owner@example.com', 'password').then((result) => {
          document.body.dataset.signInResult = `${result.error ?? 'ok'}:${result.role ?? 'none'}`;
        })}
      >
        Sign in
      </button>
    </>
  );
}

function renderProvider() {
  return render(
    <AdminAuthProvider>
      <Consumer />
    </AdminAuthProvider>,
  );
}

describe('admin authorization context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete document.body.dataset.signInResult;
    const query = {
      select: mocks.select,
      eq: mocks.eq,
      maybeSingle: mocks.maybeSingle,
    };
    mocks.from.mockReturnValue(query);
    mocks.select.mockReturnValue(query);
    mocks.eq.mockReturnValue(query);
    mocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  it('queries the authenticated user id and requires active permission fields', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        user_id: authenticatedUser.id,
        email: 'owner@example.COM',
        role: 'operator',
        is_active: true,
        status: 'active',
      },
      error: null,
    });
    mocks.onAuthStateChange.mockImplementation((callback) => {
      mocks.emitAuth.mockImplementation(() => callback('SIGNED_IN', { user: authenticatedUser }));
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    renderProvider();

    fireEvent.click(screen.getByRole('button', { name: 'Emit sign in' }));

    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('operator'));
    expect(mocks.from).toHaveBeenCalledWith('admin_user_permissions');
    expect(mocks.select).toHaveBeenCalledWith('user_id, email, role, is_active, status');
    expect(mocks.eq).toHaveBeenCalledWith('user_id', authenticatedUser.id);
    expect(mocks.eq).toHaveBeenCalledWith('is_active', true);
    expect(mocks.eq).toHaveBeenCalledWith('status', 'active');
  });

  it('reports query errors separately from an account without permission', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'permission denied' },
    });
    mocks.onAuthStateChange.mockImplementation((callback) => {
      mocks.emitAuth.mockImplementation(() => callback('SIGNED_IN', { user: authenticatedUser }));
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    renderProvider();

    fireEvent.click(screen.getByRole('button', { name: 'Emit sign in' }));

    await waitFor(() => expect(screen.getByTestId('role-error')).toHaveTextContent(
      'Não foi possível verificar as permissões: permission denied',
    ));
    expect(screen.getByTestId('role')).toHaveTextContent('none');
  });

  it('waits for the database authorization result before completing login', async () => {
    let finishPermissionQuery: ((result: {
      data: {
        user_id: string;
        email: string;
        role: string;
        is_active: boolean;
        status: string;
      };
      error: null;
    }) => void) | undefined;
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: authenticatedUser },
      error: null,
    });
    mocks.maybeSingle.mockImplementation(() => new Promise((resolve) => {
      finishPermissionQuery = resolve;
    }));
    renderProvider();

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(mocks.maybeSingle).toHaveBeenCalled());
    expect(document.body.dataset.signInResult).toBeUndefined();
    finishPermissionQuery?.({
      data: {
        user_id: authenticatedUser.id,
        email: 'owner@example.com',
        role: 'admin',
        is_active: true,
        status: 'active',
      },
      error: null,
    });
    await waitFor(() => expect(document.body.dataset.signInResult).toBe('ok:admin'));
  });
});
