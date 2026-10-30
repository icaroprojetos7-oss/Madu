import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildWhatsAppMessage, formatCurrency, getCartSummary, loadOrderImageFiles } from './commerce';

afterEach(() => {
  vi.unstubAllGlobals();
});

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
        productUrl: 'https://madu.example/produto/brinco',
      },
    ];

    const message = buildWhatsAppMessage({
      items,
      customerName: 'Maria',
      storeName: 'MADU ACESSÓRIOS',
      orderNumber: 'MADU-20261030-000001',
    });

    expect(message).toContain('🛍️ PEDIDO MADU ACESSÓRIOS #MADU-20261030-000001');
    expect(message).toContain('Produto: Brinco Árgola Dourado');
    expect(message).toContain('Código: BRI-001');
    expect(message).toContain('Variação: Dourado');
    expect(message).toContain('Quantidade: 2');
    expect(message).toContain('Link do produto: https://madu.example/produto/brinco');
    expect(message).toContain('Valor unitário: R$ 9,90');
    expect(message).toContain('Total: R$ 19,80');
  });

  it('calculates totals for cart items', () => {
    const summary = getCartSummary([
      { id: 'p1', quantity: 2, unitPrice: 990 },
      { id: 'p2', quantity: 1, unitPrice: 1490 },
    ]);

    expect(summary.totalUnits).toBe(3);
    expect(summary.subtotal).toBe(3470);
  });

  it('prepares actual product image files with identifiable filenames', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(new Blob(['image'], { type: 'image/webp' }), {
        status: 200,
        headers: { 'Content-Type': 'image/webp' },
      }),
    ));

    const files = await loadOrderImageFiles([
      { imageUrl: 'https://madu.example/product.webp', name: 'Bolsa Feminina', sku: 'MADU001' },
    ]);

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('01-MADU001.webp');
    expect(files[0].type).toBe('image/webp');
  });

  it('does not silently treat an unavailable product image as shared', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));

    await expect(loadOrderImageFiles([
      { imageUrl: 'https://madu.example/missing.webp', name: 'Bolsa Feminina', sku: 'MADU001' },
    ])).rejects.toThrow('Não foi possível carregar a foto de "Bolsa Feminina".');
  });
});
