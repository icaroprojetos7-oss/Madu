# Plano de testes

## Checkout e WhatsApp
- Validar que o checkout não envia preços do navegador ao servidor.
- Registrar pedido com um e vários produtos e confirmar que o banco grava snapshots de preço, SKU, imagem e link.
- Confirmar que produto inativo, ID inválido, quantidade inválida ou estoque indisponível não cria pedido.
- Confirmar que o estoque não muda ao criar pedido pendente.
- Em dispositivo compatível, compartilhar arquivos reais com caption identificado; em fallback, verificar aviso explícito de que o WhatsApp recebeu somente texto.
- Confirmar que falha/cancelamento do compartilhamento não apaga o pedido nem informa envio concluído.

## Painel e estoque
- Confirmar pedido e verificar saldo, responsável e movimentação de saída.
- Tentar confirmação duplicada e confirmar que estoque e histórico não mudam novamente.
- Cancelar pedido pendente e confirmar que saldo não muda.
- Estornar venda com motivo e confirmar movimento inverso; tentar estorno duplicado.
- Validar estoque baixo, falta de saldo e operações concorrentes.
- Editar manualmente estoque pelo cadastro do produto e verificar movimento de entrada/ajuste.
- Conferir filtros, detalhes, acesso rápido ao WhatsApp e layout móvel.

## Execução automatizada
- Frontend e testes unitários: `npm run build` e `npm test`.
- Banco local, quando Docker estiver disponível: `npx supabase test db --local`.
- Revisar migration e policies no staging antes de `npx supabase db push`; implantar `create-order` somente após configurar origins e URL pública.
