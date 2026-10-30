# Arquitetura

## Visão geral
A aplicação separa a experiência do cliente, regras de comércio, painel administrativo e persistência segura no Supabase.

## Camadas
- `src/App.tsx`: rotas, storefront, carrinho e dashboard.
- `src/components/Admin`: pedidos e histórico de estoque.
- `src/components/Navigation/MaduSidebar.tsx`: navegação do painel.
- `src/context`: estado do carrinho persistente no navegador.
- `src/data`: catálogo local e categorias.
- `src/lib`: regras de comércio, persistência de pedidos e integração Supabase.
- `supabase/functions/create-order`: entrada pública validada para pedidos de clientes; usa a chave de serviço somente no servidor.
- `supabase/migrations`: snapshot confiável de preços, operações transacionais de estoque e autorização administrativa.
- `src/test`: configuração compartilhada dos testes.
- `public/assets/brand`: logos e favicons servidos como assets estáticos.
- `docs/reference`: referências visuais do projeto.

## Regras de desenvolvimento
- O navegador envia somente IDs de produto, quantidades e dados opcionais do cliente. O banco confirma preços atuais e cria o pedido antes do compartilhamento.
- A criação do pedido não reserva nem baixa estoque. Apenas operações administrativas transacionais confirmam venda, cancelam pedido ou estornam estoque.
- Alterações manuais de saldo feitas pelo cadastro de produtos geram histórico no banco.
- O compartilhamento de arquivos usa Web Share API quando o dispositivo aceita imagens; `wa.me` é tratado como fallback de texto, nunca como envio de foto.
- Mobile-first como prioridade de layout e lógica.
