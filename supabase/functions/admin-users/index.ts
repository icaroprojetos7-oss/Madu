import {
  createClient,
  type SupabaseClient,
} from 'npm:@supabase/supabase-js@2.118.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2.118.0/cors';

type StoreRole = 'admin' | 'operator';

type Database = {
  public: {
    Tables: {
      admin_user_permissions: {
        Row: {
          user_id: string;
          email: string | null;
          role: StoreRole;
          is_active: boolean;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email?: string | null;
          role: StoreRole;
          is_active?: boolean;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          email?: string | null;
          role?: StoreRole;
          is_active?: boolean;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {
      admin_set_user_role: {
        Args: {
          p_actor_user_id: string;
          p_user_id: string;
          p_role: StoreRole | null;
        };
        Returns: undefined;
      };
    };
    Enums: {};
    CompositeTypes: {};
  };
};

type AdminClient = SupabaseClient<Database>;

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };

function jsonResponse(body: unknown, status: number, origin: string | null) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...jsonHeaders,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Origin': origin ?? 'null',
      Vary: 'Origin',
    },
  });
}

function readAllowedOrigins() {
  return (Deno.env.get('ADMIN_APP_ORIGINS') ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function findUserByEmail(adminClient: AdminClient, email: string) {
  const perPage = 1000;
  for (let page = 1;; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      throw new Error(`Não foi possível procurar a conta: ${error.message}`);
    }

    const found = data.users.find((user) =>
      user.email?.trim().toLowerCase() === email.trim().toLowerCase()
    );
    if (found) return found;
    if (data.users.length < perPage) return null;
  }
}

async function loadManagedUsers(adminClient: AdminClient) {
  const { data: permissions, error } = await adminClient
    .from('admin_user_permissions')
    .select('user_id, role')
    .eq('is_active', true)
    .eq('status', 'active')
    .order('created_at', { ascending: true });
  if (error) {
    throw new Error(
      `Não foi possível carregar as permissões: ${error.message}`,
    );
  }

  return Promise.all((permissions ?? []).map(async (permission) => {
    const { data, error: userError } = await adminClient.auth.admin.getUserById(
      permission.user_id,
    );
    if (userError || !data.user) {
      throw new Error(
        `Não foi possível carregar uma conta autorizada: ${
          userError?.message ?? 'usuário não encontrado.'
        }`,
      );
    }
    return userSummary(data.user, permission.role);
  }));
}

function userSummary(
  user: {
    id: string;
    email?: string;
    created_at: string;
    last_sign_in_at?: string | null;
  },
  role: StoreRole,
) {
  return {
    id: user.id,
    email: user.email ?? '',
    role,
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
  };
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (origin && !readAllowedOrigins().includes(origin)) {
    return jsonResponse({ error: 'Origem não autorizada.' }, 403, null);
  }
  if (request.method === 'OPTIONS') return jsonResponse(null, 204, origin);
  if (request.method !== 'GET' && request.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido.' }, 405, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Configuração Supabase ausente para admin-users.');
    return jsonResponse(
      { error: 'A função não está configurada no servidor.' },
      500,
      origin,
    );
  }

  const authorization = request.headers.get('Authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return jsonResponse({ error: 'Autenticação obrigatória.' }, 401, origin);
  }

  const userClient = createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser(
    token,
  );
  if (authError || !authData.user) {
    return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401, origin);
  }

  const { data: callerPermission, error: permissionError } = await adminClient
    .from('admin_user_permissions')
    .select('user_id, email, role, is_active, status')
    .eq('user_id', authData.user.id)
    .eq('is_active', true)
    .eq('status', 'active')
    .maybeSingle();

  if (permissionError) {
    console.error(
      'Não foi possível verificar o perfil do solicitante.',
      permissionError,
    );
    return jsonResponse(
      { error: 'Não foi possível verificar as permissões no banco.' },
      500,
      origin,
    );
  }
  const callerEmail = authData.user.email?.trim().toLowerCase();
  const permissionEmail = callerPermission?.email?.trim().toLowerCase();
  if (
    callerPermission?.user_id !== authData.user.id ||
    !callerEmail ||
    permissionEmail !== callerEmail ||
    callerPermission.is_active !== true ||
    callerPermission.status !== 'active' ||
    callerPermission.role !== 'admin'
  ) {
    return jsonResponse(
      { error: 'Somente administradores podem gerenciar usuários.' },
      403,
      origin,
    );
  }

  try {
    if (request.method === 'GET') {
      return jsonResponse(
        { users: await loadManagedUsers(adminClient) },
        200,
        origin,
      );
    }

    let payload: {
      action?: string;
      email?: string;
      role?: unknown;
      userId?: string;
    } = {};
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: 'Corpo JSON inválido.' }, 400, origin);
    }

    if (payload.action === 'list') {
      return jsonResponse(
        { users: await loadManagedUsers(adminClient) },
        200,
        origin,
      );
    }

    if (payload.action === 'grant') {
      const email = payload.email?.trim().toLowerCase();
      const role = payload.role;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return jsonResponse(
          { error: 'Informe um endereço de e-mail válido.' },
          400,
          origin,
        );
      }
      if (role !== 'admin' && role !== 'operator') {
        return jsonResponse(
          { error: 'Selecione um perfil válido.' },
          400,
          origin,
        );
      }

      let account = await findUserByEmail(adminClient, email);
      let invited = false;
      if (!account) {
        const { data, error } = await adminClient.auth.admin.inviteUserByEmail(
          email,
        );
        if (error || !data.user) {
          return jsonResponse(
            {
              error: `Não foi possível enviar o convite: ${
                error?.message ?? 'usuário não retornado.'
              }`,
            },
            400,
            origin,
          );
        }
        account = data.user;
        invited = true;
      }

      const { error: roleError } = await adminClient.rpc(
        'admin_set_user_role',
        {
          p_actor_user_id: authData.user.id,
          p_user_id: account.id,
          p_role: role,
        },
      );
      if (roleError) {
        console.error(
          'A conta foi localizada, mas a permissão não foi gravada.',
          roleError,
        );
        return jsonResponse(
          {
            error: invited
              ? `O convite foi enviado, mas a permissão não foi gravada: ${roleError.message}`
              : `Não foi possível conceder a permissão: ${roleError.message}`,
          },
          409,
          origin,
        );
      }

      return jsonResponse(
        { user: userSummary(account, role), invited },
        200,
        origin,
      );
    }

    if (payload.action === 'set-role') {
      const userId = payload.userId;
      const role = payload.role;
      if (
        !userId ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          userId,
        )
      ) {
        return jsonResponse(
          { error: 'Identificador de usuário inválido.' },
          400,
          origin,
        );
      }
      if (role !== null && role !== 'admin' && role !== 'operator') {
        return jsonResponse(
          { error: 'Selecione um perfil válido ou revogue o acesso.' },
          400,
          origin,
        );
      }

      const { data, error } = await adminClient.auth.admin.getUserById(userId);
      if (error || !data.user) {
        return jsonResponse({ error: 'Usuário não encontrado.' }, 404, origin);
      }

      const { error: roleError } = await adminClient.rpc(
        'admin_set_user_role',
        {
          p_actor_user_id: authData.user.id,
          p_user_id: userId,
          p_role: role,
        },
      );
      if (roleError) {
        return jsonResponse(
          {
            error: `Não foi possível atualizar o acesso: ${roleError.message}`,
          },
          409,
          origin,
        );
      }
      return jsonResponse(
        {
          user: role ? userSummary(data.user, role) : null,
          revoked: role === null,
        },
        200,
        origin,
      );
    }

    return jsonResponse({ error: 'Ação não reconhecida.' }, 400, origin);
  } catch (error) {
    console.error('Falha ao executar admin-users.', error);
    return jsonResponse(
      {
        error: error instanceof Error
          ? error.message
          : 'Erro inesperado ao gerenciar usuários.',
      },
      500,
      origin,
    );
  }
});
