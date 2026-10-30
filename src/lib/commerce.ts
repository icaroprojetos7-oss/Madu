export type CartItemInput = {
  id: string;
  name?: string;
  quantity: number;
  unitPrice: number;
  variation?: string;
  sku?: string;
  productUrl?: string;
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
  orderNumber,
}: {
  items: CartItemInput[];
  storeName: string;
  customerName?: string;
  orderNumber?: string;
}) {
  const summary = getCartSummary(items.map((item) => ({ quantity: item.quantity, unitPrice: item.unitPrice })));

  const productLines = items
    .map((item) => {
      return [
        'Produto: ' + (item.name ?? 'Produto'),
        `Código: ${item.sku ?? 'Não informado'}`,
        item.variation ? `Variação: ${item.variation}` : undefined,
        `Quantidade: ${item.quantity}`,
        `Valor unitário: ${formatCurrency(item.unitPrice)}`,
        item.productUrl ? `Link do produto: ${item.productUrl}` : undefined,
      ].filter((line): line is string => Boolean(line)).join('\n');
    })
    .join('\n\n');

  return [
    `🛍️ PEDIDO ${storeName}${orderNumber ? ` #${orderNumber}` : ''}`,
    productLines,
    customerName ? `Cliente: ${customerName}` : undefined,
    `Total: ${formatCurrency(summary.subtotal)}`,
    'Olá! Gostaria de confirmar a disponibilidade e finalizar meu pedido.',
  ].filter((line): line is string => Boolean(line)).join('\n\n');
}

export function buildWhatsAppUrl(number: string, message: string): string {
  const cleanNumber = number.replace(/\D/g, '');
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
}

export async function loadOrderImageFiles(
  items: Array<{ imageUrl: string | null; name: string; sku: string | null }>,
): Promise<File[]> {
  const maximumImageSize = 10 * 1024 * 1024;
  const maximumShareSize = 25 * 1024 * 1024;
  const files: File[] = [];
  let totalSize = 0;

  for (const [index, item] of items.entries()) {
    if (!item.imageUrl) throw new Error(`A foto de "${item.name}" não está disponível.`);

    const response = await fetch(item.imageUrl, {
      mode: 'cors',
      credentials: 'omit',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Não foi possível carregar a foto de "${item.name}".`);

    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) {
      throw new Error(`O arquivo de "${item.name}" não é uma imagem compartilhável.`);
    }
    if (blob.size > maximumImageSize) {
      throw new Error(`A foto de "${item.name}" excede o limite de compartilhamento.`);
    }
    totalSize += blob.size;
    if (totalSize > maximumShareSize) {
      throw new Error('As fotos selecionadas excedem o limite de compartilhamento de 25 MB.');
    }

    const extension = blob.type === 'image/png'
      ? 'png'
      : blob.type === 'image/webp'
        ? 'webp'
        : blob.type === 'image/jpeg'
          ? 'jpg'
          : 'img';
    const label = (item.sku || item.name)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || `produto-${index + 1}`;
    files.push(new File([blob], `${String(index + 1).padStart(2, '0')}-${label}.${extension}`, {
      type: blob.type,
    }));
  }

  return files;
}
