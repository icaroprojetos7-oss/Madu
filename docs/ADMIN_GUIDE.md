# Guia administrativo

## Pedidos
1. Acesse **Painel → Pedidos** e revise o número, fotos, itens, valores, data e status.
2. Use **WhatsApp** para abrir a conversa do cliente quando ele informou um telefone.
3. Use **Confirmar venda e dar baixa no estoque** somente depois de confirmar a venda. O banco valida o saldo atual e registra a saída numa transação; pedidos pendentes não alteram estoque.
4. Pedidos pendentes podem ser cancelados sem alterar o saldo. Para pedidos confirmados, **Estornar e devolver ao estoque** exige motivo e só pode ser realizado uma vez.
5. **Concluir pedido** altera o status para concluído sem registrar pagamento.

## Estoque
- O painel apresenta o saldo atual e até 100 movimentações recentes.
- O cadastro/edição de produtos registra automaticamente entradas iniciais e ajustes manuais de saldo.
- Cada movimento apresenta produto, código, saldo anterior/final, quantidade, pedido relacionado, responsável e data.
- O estoque nunca pode ficar negativo. O banco bloqueia confirmações simultâneas e duplicadas.

## Checkout do cliente e WhatsApp
- O pedido é persistido antes de abrir o fluxo de compartilhamento; preços são recalculados a partir do catálogo do banco.
- Em dispositivos compatíveis, **Compartilhar fotos e pedido** abre o compartilhamento nativo com os arquivos de imagem originais e a mensagem identificada. O cliente precisa escolher o WhatsApp e confirmar o envio.
- Em navegadores sem compartilhamento de imagens, o fallback abre o WhatsApp somente com texto e avisa que nenhuma foto foi anexada.
- O sistema não afirma que a mensagem ou as fotos foram enviadas. Não há integração com WhatsApp Business Cloud API nem processamento de pagamento.

## Configurações
- Configure o número comercial em **Painel → Configurações** com código do país.
- Mantenha a função `create-order` implantada e os domínios permitidos configurados no Supabase.

## Segurança
- Apenas administradores ativos podem acessar o painel e confirmar, cancelar, concluir ou estornar pedidos.
- Não exponha `SUPABASE_SERVICE_ROLE_KEY` no navegador nem em variáveis `VITE_*`.
- O checkout não confia em preços, imagens ou links enviados pelo navegador.
