# Decisões técnicas

## Decisão 1
O catálogo local é apenas uma demonstração de desenvolvimento sem Supabase. Produção não apresenta produtos fictícios quando o backend não está configurado.

## Decisão 2
A geração do WhatsApp usa o telefone persistido da loja e os itens, quantidades e preços atuais do catálogo. Sem telefone ou estoque validado, o checkout não cria um link de exemplo.

## Decisão 3
A identidade visual foi adaptada ao guia da marca com paleta em rosa apagado e foco em mobile-first.

## Decisão 4
A arquitetura foi estruturada para evoluir para Supabase sem acoplar regras de negócio aos componentes.

## Decisão 5
O painel administrativo usa navegação lateral responsiva inspirada na hierarquia visual do Vistta, mas aponta somente para rotas existentes da MADU. Indicadores e agrupamentos exibidos no dashboard são derivados do catálogo carregado; áreas sem dados integrados, como pedidos e faturamento, não são preenchidas com números de demonstração.

## Decisão 6
Os assets de marca são mantidos em `public/assets/brand`, e referências visuais do storefront em `docs/reference`. O cabeçalho da loja usa a logo transparente oficial em PNG; favicon e demais formatos de logo ficam organizados junto dela.

## Decisão 7
A navegação da área administrativa é separada da navegação do cliente. A sidebar é filtrada por perfil: operadores acessam produtos; administradores acessam o painel completo. A proteção real é feita por Auth e RLS, não apenas por interface ou rota.

## Decisão 8
O cadastro de produtos valida os dados e grava com `insert`/`update` em `products`. Imagens JPG/PNG/WebP até 10 MB vão para `product-images`; a URL pública é persistida em `image`. Cada upload usa caminho único e não remove a imagem anterior automaticamente.

## Decisão 9
O acesso usa Supabase Auth e a tabela `admin_user_permissions` como fonte de autorização atual, refletida também em `app_metadata` para compatibilidade. RLS e a Edge Function consultam a permissão persistida; a chave de serviço fica exclusivamente no servidor. A alteração de perfil usa lock transacional para manter ao menos um administrador.

## Decisão 10
O repositório inclui o Supabase CLI como dependência de desenvolvimento com versão fixa e mantém `supabase/config.toml` versionado para configuração local. Inicializar o CLI não vincula nem altera um projeto hospedado; migrations e `schema.sql` existentes são preservados.

## Decisão 11
O setup local aplica primeiro o schema completo e depois a migration de policies de produtos. A ordem permite criar o banco do zero, mantém o `schema.sql` como referência e alinha os redirecionamentos do Supabase Auth ao servidor Vite em `localhost:5173`.

## Decisão 12
O bucket público `product-images` permite leitura pública dos produtos, upload/atualização por administradores e operadores e exclusão somente por administradores. O bucket e o app limitam imagens a 10 MB. A configuração global do projeto ainda deve permitir o tamanho escolhido.

## Decisão 13
A migration de permissões também cria `store_settings`, persiste o WhatsApp e controla `products.is_active`. A vitrine lê apenas produtos ativos; o carrinho reconsulta os dados atuais antes de habilitar o WhatsApp. Pedidos e pagamentos não são simulados nem gravados.

## Decisão 14
A Edge Function de usuários fixa a versão do `supabase-js` e reutiliza os cabeçalhos CORS oficiais do SDK, mantendo a lista de origins configurada no servidor. A conta administrativa inicial, quando necessária, é promovida exclusivamente pelo SQL Editor confiável.

## Decisão 15
A autorização administrativa identifica primeiro a conta pela chave Auth `user_id`, confirma o e-mail sem diferenciar maiúsculas/minúsculas e exige `is_active = true`, `status = 'active'` e função `admin` ou `operator`. Falhas da consulta são exibidas separadamente de ausência de permissão. Apenas administradores gerenciam usuários/configurações; a sessão é renovada após alterações do próprio perfil.

## Decisão 16
A migration de permissões promove a conta MADU `iIcarohenrrique99@gmail.com` a administradora inicial apenas quando ela existe em Auth; caso contrário, interrompe explicitamente a aplicação. As migrations notificam o PostgREST para recarregar o cache após criar/alterar o schema.

## Decisão 17
As configurações da loja usam a linha `id = 'main'` e colunas próprias (`store_name`, `whatsapp_number`, `instagram_url`, `updated_at`), não pares genéricos `key/value`. O WhatsApp é lido e gravado nessa linha; a gravação só confirma sucesso após o Supabase retornar o telefone persistido. Policies RLS permitem leitura pública da configuração principal e escrita somente a administradores ativos.
