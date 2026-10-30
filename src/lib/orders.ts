import { supabase } from './supabase';

export type OrderStatus =
  | 'received'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'preparing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'reversed';

export type OrderItemSnapshot = {
  id: string;
  product_id: string | null;
  product_name: string;
  sku: string | null;
  variation: string | null;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  image_url: string | null;
  product_url: string | null;
};

export type StoreOrder = {
  id: string;
  order_number: string;
  status: OrderStatus;
  customer_name: string | null;
  customer_phone: string | null;
  subtotal_cents: number;
  total_cents: number;
  created_at: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  reversed_by: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
  order_items: OrderItemSnapshot[];
};

export type InventoryMovement = {
  id: string;
  product_id: string;
  admin_user_id: string;
  admin_email: string | null;
  movement_type: 'entry' | 'exit' | 'sale' | 'refund' | 'adjustment';
  quantity: number;
  stock_before: number | null;
  stock_after: number | null;
  product_name: string | null;
  sku: string | null;
  product_image: string | null;
  order_id: string | null;
  notes: string | null;
  created_at: string;
  product: { name: string; image: string; sku: string | null } | null;
  order: { order_number: string } | null;
};

export type NewOrderInput = {
  items: Array<{ product_id: string; quantity: number; variation?: string }>;
  customer_name?: string;
  customer_phone?: string;
};

const orderStatuses: OrderStatus[] = [
  'received',
  'awaiting_confirmation',
  'confirmed',
  'preparing',
  'shipped',
  'delivered',
  'cancelled',
  'reversed',
];
const movementTypes: InventoryMovement['movement_type'][] = [
  'entry',
  'exit',
  'sale',
  'refund',
  'adjustment',
];

function isOrderStatus(value: string): value is OrderStatus {
  return orderStatuses.some((status) => status === value);
}

function isMovementType(value: string): value is InventoryMovement['movement_type'] {
  return movementTypes.some((movement) => movement === value);
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase não está configurado.');
  return supabase;
}

function normalizeOrder(value: unknown): StoreOrder {
  if (!value || typeof value !== 'object') {
    throw new Error('O banco retornou um pedido inválido.');
  }
  const record = value as Record<string, unknown>;
  const rawItems = record.order_items;
  if (
    typeof record.id !== 'string' ||
    typeof record.order_number !== 'string' ||
    typeof record.status !== 'string' ||
    !isOrderStatus(record.status) ||
    typeof record.created_at !== 'string' ||
    !Array.isArray(rawItems)
  ) {
    throw new Error('O banco retornou dados incompletos para o pedido.');
  }
  return {
    id: record.id,
    order_number: record.order_number,
    status: record.status,
    customer_name: typeof record.customer_name === 'string' ? record.customer_name : null,
    customer_phone: typeof record.customer_phone === 'string' ? record.customer_phone : null,
    subtotal_cents: Number(record.subtotal_cents),
    total_cents: Number(record.total_cents),
    created_at: String(record.created_at),
    confirmed_by: typeof record.confirmed_by === 'string' ? record.confirmed_by : null,
    confirmed_at: typeof record.confirmed_at === 'string' ? record.confirmed_at : null,
    reversed_by: typeof record.reversed_by === 'string' ? record.reversed_by : null,
    reversed_at: typeof record.reversed_at === 'string' ? record.reversed_at : null,
    reversal_reason: typeof record.reversal_reason === 'string' ? record.reversal_reason : null,
    order_items: Array.isArray(rawItems)
      ? rawItems.map((item) => {
          if (!item || typeof item !== 'object') {
            throw new Error('O banco retornou um item inválido no pedido.');
          }
          const row = item as Record<string, unknown>;
          if (
            typeof row.id !== 'string' ||
            typeof row.product_name !== 'string' ||
            typeof row.quantity !== 'number' ||
            typeof row.unit_price_cents !== 'number' ||
            typeof row.line_total_cents !== 'number'
          ) {
            throw new Error('O banco retornou dados incompletos para um item do pedido.');
          }
          return {
            id: row.id,
            product_id: typeof row.product_id === 'string' ? row.product_id : null,
            product_name: row.product_name,
            sku: typeof row.sku === 'string' ? row.sku : null,
            variation: typeof row.variation === 'string' ? row.variation : null,
            quantity: row.quantity,
            unit_price_cents: row.unit_price_cents,
            line_total_cents: row.line_total_cents,
            image_url: typeof row.image_url === 'string' ? row.image_url : null,
            product_url: typeof row.product_url === 'string' ? row.product_url : null,
          };
        })
      : [],
  };
}

export async function createCustomerOrder(input: NewOrderInput): Promise<StoreOrder> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('create-order', {
    body: {
      items: input.items,
      customer_name: input.customer_name?.trim() || null,
      customer_phone: input.customer_phone?.trim() || null,
    },
  });
  if (error) {
    const responseMessage = typeof data?.error === 'string' ? data.error : error.message;
    throw new Error(`Não foi possível registrar o pedido: ${responseMessage}`);
  }
  return normalizeOrder(data?.order);
}

export async function getOrdersFromSupabase(): Promise<StoreOrder[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Não foi possível carregar os pedidos: ${error.message}`);
  return (data ?? []).map(normalizeOrder);
}

export async function getOrderDashboardSummary(): Promise<{ pending: number; confirmed: number }> {
  const client = requireSupabase();
  const [pending, confirmed] = await Promise.all([
    client
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['received', 'awaiting_confirmation']),
    client
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['confirmed', 'preparing', 'shipped', 'delivered']),
  ]);
  if (pending.error || confirmed.error) {
    throw new Error(
      `Não foi possível carregar os indicadores de pedidos: ${
        pending.error?.message ?? confirmed.error?.message
      }`,
    );
  }
  return { pending: pending.count ?? 0, confirmed: confirmed.count ?? 0 };
}

export async function getInventoryMovementsFromSupabase(): Promise<InventoryMovement[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('inventory_movements')
    .select('*, product:products(name, image, sku), order:orders(order_number)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(`Não foi possível carregar o histórico de estoque: ${error.message}`);
  return (data ?? []).map((value) => {
    if (!value || typeof value !== 'object') {
      throw new Error('O banco retornou uma movimentação de estoque inválida.');
    }
    const row = value as Record<string, unknown>;
    if (
      typeof row.id !== 'string' ||
      typeof row.product_id !== 'string' ||
      typeof row.admin_user_id !== 'string' ||
      typeof row.movement_type !== 'string' ||
      !isMovementType(row.movement_type) ||
      typeof row.quantity !== 'number' ||
      typeof row.created_at !== 'string'
    ) {
      throw new Error('O banco retornou dados incompletos para uma movimentação.');
    }

    const productRow = row.product && typeof row.product === 'object'
      ? row.product as Record<string, unknown>
      : null;
    const orderRow = row.order && typeof row.order === 'object'
      ? row.order as Record<string, unknown>
      : null;
    return {
      id: row.id,
      product_id: row.product_id,
      admin_user_id: row.admin_user_id,
      admin_email: typeof row.admin_email === 'string' ? row.admin_email : null,
      movement_type: row.movement_type,
      quantity: row.quantity,
      stock_before: typeof row.stock_before === 'number' ? row.stock_before : null,
      stock_after: typeof row.stock_after === 'number' ? row.stock_after : null,
      product_name: typeof row.product_name === 'string' ? row.product_name : null,
      sku: typeof row.sku === 'string' ? row.sku : null,
      product_image: typeof row.product_image === 'string' ? row.product_image : null,
      order_id: typeof row.order_id === 'string' ? row.order_id : null,
      notes: typeof row.notes === 'string' ? row.notes : null,
      created_at: row.created_at,
      product: productRow && typeof productRow.name === 'string'
        ? {
            name: productRow.name,
            image: typeof productRow.image === 'string' ? productRow.image : '',
            sku: typeof productRow.sku === 'string' ? productRow.sku : null,
          }
        : null,
      order: orderRow && typeof orderRow.order_number === 'string'
        ? { order_number: orderRow.order_number }
        : null,
    };
  });
}

async function runOrderAction(
  action: 'confirm_store_order' | 'cancel_store_order' | 'reverse_store_order' | 'complete_store_order',
  orderId: string,
  reason?: string,
) {
  const client = requireSupabase();
  const args = action === 'reverse_store_order'
    ? { p_order_id: orderId, p_reason: reason ?? '' }
    : { p_order_id: orderId };
  const { error } = await client.rpc(action, args);
  if (error) throw new Error(error.message);
}

export const confirmStoreOrder = (orderId: string) =>
  runOrderAction('confirm_store_order', orderId);

export const cancelStoreOrder = (orderId: string) =>
  runOrderAction('cancel_store_order', orderId);

export const reverseStoreOrder = (orderId: string, reason: string) =>
  runOrderAction('reverse_store_order', orderId, reason);

export const completeStoreOrder = (orderId: string) =>
  runOrderAction('complete_store_order', orderId);
