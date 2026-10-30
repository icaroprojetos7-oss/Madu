export type CartItemInput = {
  id: string;
  name?: string;
  quantity: number;
  unitPrice: number;
  variation?: string;
  sku?: string;
};

export function formatCurrency(value: number): string {
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value / 100);

  return formatted.replace(/\u00A0/g, ' ');
}

export function getCartSummary(items: Array<{ id?: string; quantity: number; unitPrice: number }>) {
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  return {
    totalUnits,
    subtotal,
  };
}

export function buildWhatsAppMessage({
  items,
  storeName,
  customerName,
  notes,
}: {
  items: CartItemInput[];
  storeName: string;
  customerName?: string;
  notes?: string;
}) {
  const summary = getCartSummary(items.map((item) => ({ quantity: item.quantity, unitPrice: item.unitPrice })));

  const productLines = items
    .map((item) => {
      const itemSubtotal = item.quantity * item.unitPrice;
      return [
        'Produto: ' + (item.name ?? 'Produto'),
        item.variation ? `Variação: ${item.variation}` : 'Variação: não informado',
        `Quantidade: ${item.quantity}`,
        `Preço unitário: ${formatCurrency(item.unitPrice)}`,
        `Subtotal do item: ${formatCurrency(itemSubtotal)}`,
        '',
      ].join('\n');
    })
    .join('\n');

  const customerLine = customerName ? `Nome do cliente: ${customerName}\n` : '';
  const notesLine = notes ? `Observações: ${notes}\n` : 'Observações: nenhuma\n';

  return [
    'Olá! Vim pelo site da ' + storeName + ' e gostaria de fazer um pedido.',
    '',
    '*RESUMO DO MEU PEDIDO*',
    '',
    productLines,
    `*Quantidade total de unidades: ${summary.totalUnits}*`,
    '',
    `*Subtotal dos produtos: ${formatCurrency(summary.subtotal)}*`,
    '',
    'Frete: a combinar pelo WhatsApp.',
    'Pagamento: a combinar com a loja.',
    '',
    customerLine,
    notesLine,
    'Gostaria de confirmar a disponibilidade dos produtos e combinar a entrega e o pagamento.',
    '',
    'Obrigada!',
  ].join('\n');
}

export function buildWhatsAppUrl(number: string, message: string): string {
  const cleanNumber = number.replace(/\D/g, '');
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
}
