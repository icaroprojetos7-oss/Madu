export type AdminRole = 'admin' | 'operator';

export function parseAdminRole(role: unknown): AdminRole | null {
  return role === 'admin' || role === 'operator' ? role : null;
}

export function hasAdminAccess(appMetadata: Record<string, unknown> | null | undefined) {
  return appMetadata?.role === 'admin';
}

export type AdminPermissionRecord = {
  user_id: unknown;
  email: unknown;
  role: unknown;
  is_active: unknown;
  status: unknown;
};

export function resolveAdminPermission(
  permission: AdminPermissionRecord | null | undefined,
  user: { id: string; email?: string | null },
): AdminRole | null {
  if (
    !permission ||
    permission.user_id !== user.id ||
    permission.is_active !== true ||
    permission.status !== 'active' ||
    typeof permission.email !== 'string' ||
    typeof user.email !== 'string' ||
    permission.email.trim().toLowerCase() !== user.email.trim().toLowerCase()
  ) {
    return null;
  }

  return parseAdminRole(permission.role);
}

export function hasPanelAccess(role: unknown) {
  return parseAdminRole(role) !== null;
}

export function getAdminLoginErrorMessage(error: string) {
  if (error.toLowerCase().includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos. Confira o e-mail exato cadastrado no Supabase, a senha e se está usando o projeto correto. Se necessário, use “Esqueci minha senha”.';
  }

  return `Não foi possível entrar: ${error}`;
}
