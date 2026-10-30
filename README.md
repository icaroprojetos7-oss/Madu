# Madu Acessórios

Aplicação de loja virtual premium, mobile-first e integrada ao WhatsApp para a marca Madu Acessórios.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- React Router
- Lucide React
- Supabase-ready architecture

## Scripts

```bash
npm install
npm run dev
npm run build
npm test
```

## Visão geral
Este projeto entrega uma base funcional para loja pública e painel administrativo, com identidade visual em rosa pastel e foco em celular.

## Estrutura principal
- `src/App.tsx` — rotas e telas da loja e do painel
- `src/components/Navigation/` — navegação administrativa responsiva
- `src/context/` — estado compartilhado do carrinho
- `src/data/` — catálogo local e categorias
- `src/lib/` — comércio, Supabase e testes de regras
- `src/test/` — configuração de testes
- `public/assets/brand/` — logos e favicons da marca
- `docs/` — documentação e referências visuais do projeto

Os arquivos de identidade visual ficam organizados em `public/assets/brand/`. A loja usa `madu-logo-transparent.png`; o favicon e as variações SVG/WEBP permanecem no mesmo diretório.

## Integração com Supabase

Para desenvolvimento local:

1. Instale o Docker (a Supabase recomenda pelo menos 7 GB de RAM para o stack local completo) e execute `npx supabase start`.
2. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_ANON_KEY` com a chave pública `ANON_KEY`. Para mostrar somente essa chave, use `npx supabase status -o env | grep '^ANON_KEY='`; não compartilhe a saída completa do status, que também contém credenciais locais privilegiadas.
3. Execute `npm run dev`. A API local fica em `http://127.0.0.1:54321`; o Supabase Studio local, quando iniciado, fica em `http://127.0.0.1:54323`.
4. Execute `npx supabase stop` quando terminar. O stack local não se vincula nem altera um projeto hospedado.

O schema, as categorias iniciais, índices, grants e policies RLS são aplicados em ordem pelas migrations de `supabase/migrations/`; `supabase/schema.sql` permanece como referência para configuração manual. Para usar um projeto hospedado, substitua `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` pela URL e chave pública do projeto. Nunca coloque uma chave `service_role` ou secreta no frontend.

O painel grava produtos somente quando o Supabase confirma a operação. O catálogo de demonstração é usado apenas no modo de desenvolvimento sem Supabase; em produção, uma configuração ausente ou falha de leitura não exibe produtos fictícios. A vitrine consulta somente produtos ativos, enquanto o painel autorizado pode gerenciar produtos ativos e ocultos.

Imagens JPG, PNG e WebP de até 10 MB são enviadas ao bucket público `product-images`; a URL pública fica em `products.image`. Administradores e operadores autenticados podem enviar imagens; somente administradores podem excluir objetos. A substituição não apaga imagens antigas, e uploads órfãos não são removidos automaticamente. O limite do bucket é 10 MB; confirme também que o limite global de upload do projeto Supabase permite esse tamanho.

O telefone comercial é normalizado e persistido em `store_settings.whatsapp_number`, na linha `id = 'main'`; vitrine, rodapé e mensagem do carrinho usam esse valor. Sem telefone configurado ou catálogo validado, a finalização por WhatsApp fica indisponível em vez de usar um número de exemplo. O carrinho atualiza preço, nome, imagem e estoque do catálogo e bloqueia itens indisponíveis ou acima do estoque atual.

O acesso é baseado em `admin_user_permissions`: administradores podem gerenciar usuários e configurações; operadores podem gerenciar produtos; ambos têm acesso ao catálogo autorizado. A Edge Function `admin-users` usa a chave privilegiada exclusivamente no servidor e a migration impede remover o último administrador. Migrações e Edge Functions não são aplicadas automaticamente; siga `docs/ADMIN_SETUP.md` para configuração e implantação explícitas.

Categorias administrativas, clientes, pedidos e financeiro continuam sem integração funcional. O checkout abre o WhatsApp, mas não grava pedidos nem confirma pagamentos.

## Observações
- O fluxo de checkout é orientado ao WhatsApp sem cobrança online.
- O projeto já está preparado para sincronizar o catálogo com Supabase, mantendo fallback local sem quebrar a loja.
- A interface foi inspirada na referência visual e na organização do Vistta, sem copiar lógica de negócio.
