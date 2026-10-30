import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { LoaderCircle, ShieldCheck, UserRound, UserRoundX } from 'lucide-react';
import { changeUserRole, grantUserRole, listManagedUsers } from '../../lib/adminUsers';
import type { ManagedUser } from '../../lib/adminUsers';
import type { AdminRole } from '../../lib/adminAuth';
import { useAdminAuth } from '../../context/AdminAuthContext';

export function UserManagement() {
  const { user: currentUser, refreshRole, refreshSession } = useAdminAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('operator');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refreshUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setUsers(await listManagedUsers());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUsers();
  }, [refreshUsers]);

  async function handleGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const result = await grantUserRole(email.trim(), role);
      setEmail('');
      setMessage(result.invited
        ? `Convite enviado e acesso de ${role === 'admin' ? 'administrador' : 'operador'} concedido.`
        : `Acesso de ${role === 'admin' ? 'administrador' : 'operador'} concedido para ${result.user.email}.`);
      await refreshUsers();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado ao conceder acesso.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(member: ManagedUser, newRole: AdminRole | null) {
    if (member.id === currentUser?.id && !window.confirm('Você está alterando seu próprio acesso. Continuar?')) {
      return;
    }
    const action = newRole ? `alterar o acesso de ${member.email} para ${newRole}` : `revogar o acesso de ${member.email}`;
    if (!window.confirm(`Confirmar ${action}?`)) return;

    setSaving(true);
    setMessage('');
    setError('');
    try {
      await changeUserRole(member.id, newRole);
      setMessage(newRole ? 'Permissão atualizada.' : 'Acesso revogado.');
      if (member.id === currentUser?.id) {
        const sessionError = await refreshSession();
        await refreshRole();
        if (newRole === 'admin') await refreshUsers();
        if (sessionError) {
          setError(`A permissão foi atualizada, mas não foi possível renovar a sessão: ${sessionError}`);
        }
      } else {
        await refreshUsers();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado ao atualizar a permissão.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[1.75rem] border border-[#f1dfe9] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-[#f8e9ef] p-3 text-[#8B5E7C]"><ShieldCheck size={20} /></div>
          <div>
            <h2 className="text-xl font-semibold text-[#2d1d25]">Conceder acesso</h2>
            <p className="mt-1 text-sm text-[#5d4454]">O e-mail receberá um convite do Supabase se ainda não tiver uma conta.</p>
          </div>
        </div>
        <form onSubmit={(event) => void handleGrant(event)} className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <label className="block text-sm text-[#5d4454]">
            E-mail da conta
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-2xl border border-[#efd7e7] bg-[#fffafc] px-3 text-[#2d1d25] outline-none focus:border-[#8B5E7C]"
            />
          </label>
          <label className="block text-sm text-[#5d4454]">
            Perfil
            <select
              value={role}
              onChange={(event) => setRole(event.target.value === 'admin' ? 'admin' : 'operator')}
              className="mt-1 min-h-11 w-full rounded-2xl border border-[#efd7e7] bg-[#fffafc] px-3 text-[#2d1d25] outline-none focus:border-[#8B5E7C]"
            >
              <option value="operator">Operador</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <button type="submit" disabled={saving} className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#8B5E7C] px-5 text-sm font-medium text-white disabled:opacity-60">
            {saving && <LoaderCircle size={16} className="animate-spin" />}
            Conceder acesso
          </button>
        </form>
      </div>

      <div className="rounded-[1.75rem] border border-[#f1dfe9] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-semibold text-[#2d1d25]">Usuários autorizados</h2>
        <p className="mt-1 text-sm text-[#5d4454]">A permissão é verificada no banco a cada sessão e nas policies RLS.</p>
        {message && <p role="status" className="mt-4 rounded-2xl bg-[#f8e9ef] p-3 text-sm text-[#5d4454]">{message}</p>}
        {error && <p role="alert" className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}

        {loading ? (
          <p role="status" className="mt-5 text-sm text-[#5d4454]">Carregando usuários...</p>
        ) : users.length > 0 ? (
          <ul className="mt-5 divide-y divide-[#f1dfe9]">
            {users.map((member) => (
              <li key={member.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="rounded-full bg-[#f8e9ef] p-2 text-[#8B5E7C]"><UserRound size={18} /></div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#2d1d25]">{member.email}</p>
                    <p className="mt-1 text-xs text-[#76506a]">{member.role === 'admin' ? 'Administrador' : 'Operador'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <select
                    aria-label={`Perfil de ${member.email}`}
                    value={member.role}
                    disabled={saving}
                    onChange={(event) => void handleRoleChange(member, event.target.value === 'admin' ? 'admin' : 'operator')}
                    className="min-h-10 rounded-full border border-[#efd7e7] bg-[#fffafc] px-3 text-xs text-[#5d4454]"
                  >
                    <option value="operator">Operador</option>
                    <option value="admin">Administrador</option>
                  </select>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleRoleChange(member, null)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#efd7e7] px-3 text-xs text-[#76506a] disabled:opacity-50"
                  >
                    <UserRoundX size={15} />
                    Revogar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 rounded-2xl bg-[#fffafc] p-4 text-sm text-[#5d4454]">Nenhum usuário autorizado foi encontrado.</p>
        )}
        <p className="mt-4 text-xs leading-5 text-[#76506a]">
          O sistema impede remover ou rebaixar o último administrador. Revogar o acesso não exclui a conta Auth.
        </p>
      </div>
    </section>
  );
}
