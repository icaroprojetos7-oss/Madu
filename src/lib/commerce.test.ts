import { describe, expect, it } from 'vitest';
import { buildWhatsAppMessage, formatCurrency, getCartSummary } from './commerce';

describe('commerce helpers', () => {
  it('formats prices in Brazilian currency', () => {
    expect(formatCurrency(1990)).toBe('R$ 19,90');
    expect(formatCurrency(999)).toBe('R$ 9,99');
  });

  it('builds WhatsApp order message with product details', () => {
    const items = [
      {
        id: 'p1',
        name: 'Brinco Árgola Dourado',
        quantity: 2,
        unitPrice: 990,
        variation: 'Dourado',
        sku: 'BRI-001',
      },
    ];

    const message = buildWhatsAppMessage({
      items,
      customerName: 'Maria',
      notes: 'Entrega no bairro central.',
      storeName: 'MADU ACESSÓRIOS',
    });

    expect(message).toContain('Olá! Vim pelo site da MADU ACESSÓRIOS');
    expect(message).toContain('Produto: Brinco Árgola Dourado');
    expect(message).toContain('Variação: Dourado');
    expect(message).toContain('Quantidade total de unidades: 2');
    expect(message).toContain('Frete: a combinar pelo WhatsApp.');
  });

  it('calculates totals for cart items', () => {
    const summary = getCartSummary([
      { id: 'p1', quantity: 2, unitPrice: 990 },
      { id: 'p2', quantity: 1, unitPrice: 1490 },
    ]);

    expect(summary.totalUnits).toBe(3);
    expect(summary.subtotal).toBe(3470);
  });
});
