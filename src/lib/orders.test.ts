import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    from: mocks.from,
    rpc: mocks.rpc,
  },
}));

import {
  cancelStoreOrder,
  createCustomerOrder,
  getOrdersFromSupabase,
} from './orders';

const savedOrder = {
  id: '00000000-0000-4000-8000-000000000001',
  order_number: 'MADU-20261030-000001',
  status: 'awaiting_confirmation',
  customer_name: 'Maria',
  customer_phone: null,
  subtotal_cents: 15900,
  total_cents: 15900,
  created_at: '2026-10-30T12:00:00.000Z',
  confirmed_by: null,
  confirmed_at: null,
  reversed_by: null,
  reversed_at: null,
  reversal_reason: null,
  order_items: [{
    id: '00000000-0000-4000-8000-000000000002',
    product_id: '00000000-0000-4000-8000-000000000003',
    product_name: 'Bolsa Feminina',
    sku: 'MADU001',
    variation: null,
    quantity: 1,
    unit_price_cents: 15900,
    line_total_cents: 15900,
    image_url: 'https://madu.example/bolsa.webp',
    product_url: 'https://madu.example/produto/bolsa',
  }],
};

describe('order persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query = {
      select: mocks.select,
      order: mocks.order,
      limit: mocks.limit,
    };
    mocks.from.mockReturnValue(query);
    mocks.select.mockReturnValue(query);
    mocks.order.mockReturnValue(query);
    mocks.limit.mockReturnValue(query);
  });

  it('sends only product identities, quantities, and optional customer details to the server', async () => {
    mocks.invoke.mockResolvedValue({ data: { order: savedOrder }, error: null });

    await expect(createCustomerOrder({
      items: [{
        product_id: '00000000-0000-4000-8000-000000000003',
        quantity: 1,
        variation: 'Preta',
      }],
      customer_name: ' Maria ',
      customer_phone: '',
    })).resolves.toMatchObject({
      order_number: 'MADU-20261030-000001',
      status: 'awaiting_confirmation',
      order_items: [{ unit_price_cents: 15900, image_url: 'https://madu.example/bolsa.webp' }],
    });

    expect(mocks.invoke).toHaveBeenCalledWith('create-order', {
      body: {
        items: [{
          product_id: '00000000-0000-4000-8000-000000000003',
          quantity: 1,
          variation: 'Preta',
        }],
        customer_name: 'Maria',
        customer_phone: null,
      },
    });
  });

  it('reports server failures instead of treating an unpersisted order as successful', async () => {
    mocks.invoke.mockResolvedValue({
      data: { error: 'Produto indisponível.' },
      error: { message: 'Edge Function returned a non-2xx status code' },
    });

    await expect(createCustomerOrder({
      items: [{ product_id: '00000000-0000-4000-8000-000000000003', quantity: 1 }],
    })).rejects.toThrow('Produto indisponível.');
  });

  it('loads persisted orders with their item snapshots', async () => {
    mocks.order.mockResolvedValue({ data: [savedOrder], error: null });

    await expect(getOrdersFromSupabase()).resolves.toMatchObject([
      { order_number: 'MADU-20261030-000001', order_items: [{ product_name: 'Bolsa Feminina' }] },
    ]);
    expect(mocks.from).toHaveBeenCalledWith('orders');
    expect(mocks.select).toHaveBeenCalledWith('*, order_items(*)');
  });

  it('surfaces an unconfirmed admin action', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'Order has already been processed' } });

    await expect(cancelStoreOrder(savedOrder.id)).rejects.toThrow('Order has already been processed');
  });
});
