# Publicação

## Pré-requisitos
- Firebase CLI autenticado no projeto `maduacessorios-b8d44` (ou no projeto explicitamente escolhido).
- Projeto Supabase configurado com as migrations revisadas.
- Domínio final da aplicação autorizado na Edge Function `admin-users`.

## Fluxo sugerido
1. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (ou `VITE_SUPABASE_ANON_KEY`) no ambiente de build. `VITE_WHATSAPP_NUMBER` é opcional e serve somente como fallback se a linha de configuração ainda não existir.
2. Gere o build com `npm run build`; o Firebase Hosting publica os arquivos estáticos em `dist`.
3. Publique com `npx firebase-tools deploy --only hosting`. O projeto padrão está em `.firebaserc`; revise o projeto ativo antes de usar `--project`.
4. Configure o domínio publicado em Supabase Auth e na lista `ADMIN_APP_ORIGINS` da Edge Function `admin-users`.
5. Aplique migrations e implante `admin-users` seguindo [ADMIN_SETUP.md](./ADMIN_SETUP.md).
6. Em Supabase Storage, confirme que o limite global de upload é pelo menos 10 MB. O bucket `product-images` configura esse limite por objeto e aceita JPG, PNG e WebP.

## Limites e comportamento
- O tamanho máximo configurado pelo app e pelo bucket é 10 MB por imagem. A configuração global e as cotas efetivas dependem do plano do projeto.
- O checkout é click-to-chat. O sistema não processa pagamentos nem registra pedidos.
- Não faça deploy da aplicação, migrations ou Edge Functions sem revisar e autorizar cada operação.
