# Publicação

## Pré-requisitos
- Conta no provedor de hospedagem da aplicação.
- Projeto Supabase configurado com as migrations revisadas.
- Domínio final da aplicação autorizado na Edge Function `admin-users`.

## Fluxo sugerido
1. Publicar o repositório no GitHub.
2. Conectar a pasta do projeto ao provedor de hospedagem.
3. Definir `npm run build` como comando de build.
4. Publicar a pasta `dist`.
5. Configurar `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (ou `VITE_SUPABASE_ANON_KEY`, compatibilidade). `VITE_WHATSAPP_NUMBER` é opcional e serve somente como fallback se a linha de configuração ainda não existir.
6. Aplicar migrations e implantar `admin-users` seguindo [ADMIN_SETUP.md](./ADMIN_SETUP.md). Definir `ADMIN_APP_ORIGINS` como a lista separada por vírgulas dos origins autorizados, sem caminhos.
7. Em Supabase Storage, confirme que o limite global de upload é pelo menos 10 MB. O bucket `product-images` configura esse limite por objeto e aceita JPG, PNG e WebP.

## Limites e comportamento
- O tamanho máximo configurado pelo app e pelo bucket é 10 MB por imagem. A configuração global e as cotas efetivas dependem do plano do projeto.
- O checkout é click-to-chat. O sistema não processa pagamentos nem registra pedidos.
- Não faça deploy da aplicação, migrations ou Edge Functions sem revisar e autorizar cada operação.
