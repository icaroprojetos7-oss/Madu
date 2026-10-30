# Configuração do Supabase e do painel MADU

## Auditoria somente de leitura do projeto configurado

Na auditoria de 29/10/2026, `public.products` e o bucket público `product-images` existiam. A tabela `public.store_settings` e a tabela `public.admin_user_permissions` ainda não existiam. O bucket aceitava JPG/PNG/WebP e limitava cada arquivo a 5 MB. As policies atuais de produtos e Storage confiavam em `app_metadata.role` e devem ser substituídas pela migration antes de usar os novos fluxos. Nenhum dado foi alterado pela auditoria.

## Aplicação explícita das migrations

1. Confirme o Project ref e faça backup do projeto antes de qualquer alteração.
2. No terminal, vincule o CLI ao projeto correto:

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   ```

3. Revise os arquivos em `supabase/migrations/` e, quando estiver pronto, aplique-os explicitamente:

   ```bash
   npx supabase db push
   ```

   As migrations criam `store_settings` e `admin_user_permissions`, preservam as contas que já têm a claim administrativa, sincronizam o e-mail Auth em minúsculas, definem `is_active`/`status` para permissões existentes, atualizam as policies, aplicam `products.is_active` e elevam o limite do bucket para 10 MB. A migration mais recente concede `admin` a `iIcarohenrrique99@gmail.com`, desde que a conta Auth já exista; se não existir, a migration falha com uma mensagem explícita. As migrations não apagam registros nem removem imagens antigas.

4. Em staging, revise as policies resultantes e execute `npx supabase db advisors --linked --type security` antes de liberar o painel.
5. Verifique no painel Supabase que o limite global de upload do projeto permite pelo menos 10 MB. O limite do bucket, isoladamente, não supera um limite global menor.
6. Habilite o provedor de e-mail e mantenha o cadastro público desabilitado se a loja não aceitar registros abertos.

Se a conta `iIcarohenrrique99@gmail.com` ainda não existir em Auth, crie-a antes de aplicar as migrations. A migration de permissões a promove a administradora inicial. Para outro bootstrap excepcional, use o SQL Editor confiável do Supabase e substitua pelo e-mail verificado:

```sql
do $$
declare
  target_user_id uuid;
begin
  select id into target_user_id
  from auth.users
  where email = 'admin@seudominio.com';

  if target_user_id is null then
    raise exception 'Conta Auth não encontrada';
  end if;

  insert into public.admin_user_permissions (user_id, email, role, is_active, status)
  select id, lower(email), 'admin', true, 'active'
  from auth.users
  where id = target_user_id
  on conflict (user_id) do update
    set email = excluded.email,
        role = 'admin',
        is_active = true,
        status = 'active',
        updated_at = now();

  update auth.users
  set raw_app_meta_data =
    (coalesce(raw_app_meta_data, '{}'::jsonb) - 'role')
    || jsonb_build_object('role', 'admin')
  where id = target_user_id;
end
$$;
```

O SQL Editor é uma superfície administrativa confiável; não exponha essas instruções ou credenciais de serviço no cliente. Encerre e renove a sessão para que Auth reflita a claim atualizada. Depois, use **Usuários e permissões** no painel para convidar operadores ou outros administradores. O banco bloqueia a remoção/rebaixamento concorrente do último administrador. A revogação atualiza a fonte de autorização no banco imediatamente; sessões abertas podem precisar de atualização para refletir a mudança na interface.

Se a API informar que `public.store_settings` ou alguma coluna não existe no cache, confirme no SQL Editor que a tabela usa `id`, `store_name`, `whatsapp_number`, `instagram_url` e `updated_at`, com o registro principal `id = 'main'`. A migration de settings usa esse formato, aplica policies de leitura pública e escrita somente por administradores ativos e envia `NOTIFY pgrst, 'reload schema'`. Publique também a versão atualizada do frontend para substituir versões antigas que consultavam o formato anterior de configurações.

## Edge Function de usuários

A gestão de usuários usa `supabase/functions/admin-users/index.ts`. A função valida a sessão Auth, confirma o perfil atual na tabela e usa a Admin Auth API exclusivamente no servidor. Nunca configure `service_role` ou chaves secretas com prefixo `VITE_`.

Depois de aplicar a migration, configure o origin exato da aplicação e implante a função somente quando estiver pronto:

```bash
npx supabase secrets set ADMIN_APP_ORIGINS="https://sua-loja.example"
npx supabase functions deploy admin-users
```

Para desenvolvimento local, permita também `http://localhost:5173`. Origins são separados por vírgula e não incluem caminho. Em produção, configure o domínio real; a função não aceita origins arbitrários.

## WhatsApp comercial

Em **Administração → Configurações**, informe o número comercial com código do país e salve. O número fica em `public.store_settings.whatsapp_number` na linha `id = 'main'`; vitrine, rodapé e carrinho leem essa mesma configuração. O `VITE_WHATSAPP_NUMBER` é apenas um fallback opcional se a linha ainda não existir. Não há número fictício padrão; sem valor confirmado, os links de contato/checkout não são gerados.

## Produtos e Storage

- A vitrine consulta somente produtos com `is_active = true`; administradores e operadores autenticados podem consultar todos e gerenciar o catálogo.
- Administradores e operadores podem enviar ou atualizar imagens. Exclusão de objetos continua restrita a administradores; o app não apaga arquivos na substituição.
- O bucket público `product-images` permite que qualquer visitante baixe uma imagem ao conhecer sua URL. Listagem e exclusão continuam protegidas.
- O formulário aceita JPG, PNG e WebP até 10 MB. A imagem é enviada pelo único cliente Supabase do app e sua URL pública só é persistida no produto depois da confirmação do banco.
- Um upload concluído antes de uma falha ao salvar o produto pode deixar um objeto órfão. Ele não é removido automaticamente; revise o uso do arquivo antes de qualquer limpeza manual.

## RLS e limites funcionais

A autorização usa `admin_user_permissions`, não apenas claims que podem permanecer em um token antigo. Policies antigas conhecidas de produtos e Storage são removidas/substituídas pela migration. Antes de aplicar manualmente sobre um projeto com policies customizadas, revise `pg_policies`: policies permissivas são combinadas por `OR`; uma policy legada pode continuar concedendo acesso. Não desative RLS.

Se o login autenticar mas mostrar que a conta não tem autorização, execute esta consulta no SQL Editor do projeto correto, substituindo o e-mail pelo usado no login:

```sql
select
  users.id as auth_user_id,
  users.email as auth_email,
  permissions.user_id as permission_user_id,
  permissions.email as permission_email,
  permissions.role,
  permissions.is_active,
  permissions.status
from auth.users as users
left join public.admin_user_permissions as permissions
  on permissions.user_id = users.id
where lower(users.email) = lower('email-usado-no-login@example.com');
```

Confirme que `permission_user_id` corresponde ao `auth_user_id`, que `permission_email` corresponde ao e-mail Auth sem diferença de maiúsculas/minúsculas, que `role` é `admin` ou `operator`, `is_active` é `true` e `status` é `active`. Se a linha não existir ou estiver inativa, um administrador existente deve conceder/reativar o perfil pelo painel. Se ainda não houver nenhum administrador autorizado, use o procedimento de bootstrap explícito acima para uma única conta verificada. Após corrigir a permissão no banco, encerre a sessão e entre novamente. Não habilite acesso automaticamente para todos os usuários Auth.

Categorias administrativas, clientes, pedidos e financeiro ainda não têm integração funcional no app. O checkout envia um resumo real do carrinho ao WhatsApp, mas não grava um pedido, reserva estoque nem processa/confirmar pagamento.

## Setup local e execução

O fluxo local exige Docker e pode ser iniciado com `npx supabase start`; ele é independente do projeto hospedado. Em ambientes de desenvolvimento sem Supabase, a vitrine pode exibir produtos locais de demonstração. Em produção, a ausência ou falha do backend não apresenta esse catálogo de demonstração.

Migrations e Edge Functions não são aplicadas automaticamente. Revise e autorize separadamente cada operação remota.
