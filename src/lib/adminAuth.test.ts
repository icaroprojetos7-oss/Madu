import { describe, expect, it } from 'vitest';
import {
  getAdminLoginErrorMessage,
  hasAdminAccess,
  hasPanelAccess,
  parseAdminRole,
  resolveAdminPermission,
} from './adminAuth';

describe('admin authorization', () => {
  it('accepts only an admin role from app metadata', () => {
    expect(hasAdminAccess({ role: 'admin' })).toBe(true);
    expect(hasAdminAccess({ role: 'customer' })).toBe(false);
    expect(hasAdminAccess({ roles: ['admin'] })).toBe(false);
    expect(hasAdminAccess(null)).toBe(false);
    expect(hasAdminAccess(undefined)).toBe(false);
  });

  it('recognizes database-backed admin and operator roles', () => {
    expect(parseAdminRole('admin')).toBe('admin');
    expect(parseAdminRole('operator')).toBe('operator');
    expect(parseAdminRole('customer')).toBeNull();
    expect(hasPanelAccess('admin')).toBe(true);
    expect(hasPanelAccess('operator')).toBe(true);
    expect(hasPanelAccess(null)).toBe(false);
  });

  describe('admin login error messages', () => {
    it('explains invalid credentials without exposing backend-only details', () => {
      expect(getAdminLoginErrorMessage('Invalid login credentials')).toContain(
        'Confira o e-mail exato cadastrado no Supabase',
      );
      expect(getAdminLoginErrorMessage('Email not confirmed')).toBe(
        'Não foi possível entrar: Email not confirmed',
      );
    });

    it('resolves an active permission for the authenticated user case-insensitively', () => {
      expect(resolveAdminPermission({
        user_id: 'user-1',
        email: 'Owner@Example.com',
        role: 'operator',
        is_active: true,
        status: 'active',
      }, { id: 'user-1', email: 'owner@example.COM' })).toBe('operator');
    });

    it.each([
      { user_id: 'another-user', email: 'owner@example.com', role: 'admin', is_active: true, status: 'active' },
      { user_id: 'user-1', email: 'other@example.com', role: 'admin', is_active: true, status: 'active' },
      { user_id: 'user-1', email: 'owner@example.com', role: 'admin', is_active: false, status: 'active' },
      { user_id: 'user-1', email: 'owner@example.com', role: 'admin', is_active: true, status: 'inactive' },
      { user_id: 'user-1', email: 'owner@example.com', role: 'customer', is_active: true, status: 'active' },
    ])('denies a permission with invalid identity, activation, status, or role', (permission) => {
      expect(resolveAdminPermission(permission, { id: 'user-1', email: 'owner@example.com' })).toBeNull();
    });
  });
});
