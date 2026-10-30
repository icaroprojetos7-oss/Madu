import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2.118.0/cors';

type OrderItemInput = {
  product_id: string;
  quantity: number;
  variation?: string | null;
};

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function allowedOrigins() {
  return (Deno.env.get('ORDER_APP_ORIGINS') ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function jsonResponse(body: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...jsonHeaders,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
    },
  });
}

function readOrderItems(value: unknown): OrderItemInput[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) return null;

  const items: OrderItemInput[] = [];
  for (const rawItem of value) {
    if (!rawItem || typeof rawItem !== 'object') return null;
    const item = rawItem as Record<string, unknown>;
    if (
      typeof item.product_id !== 'string' ||
      !uuidPattern.test(item.product_id) ||
      typeof item.quantity !== 'number' ||
      !Number.isSafeInteger(item.quantity) ||
      Number(item.quantity) < 1 ||
      Number(item.quantity) > 2147483647 ||
      (item.variation !== undefined &&
        item.variation !== null &&
        (typeof item.variation !== 'string' || item.variation.length > 100))
    ) {
      return null;
    }

    items.push({
      product_id: item.product_id,
      quantity: Number(item.quantity),
      variation: typeof item.variation === 'string' ? item.variation.trim() || null : null,
    });
  }
  return items;
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  const origins = allowedOrigins();
  if (!origin || !origins.includes(origin)) {
    return jsonResponse({ error: 'Origem não autorizada.' }, 403, origin ?? 'null');
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Origin': origin,
        Vary: 'Origin',
      },
    });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido.' }, 405, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Configuração da função create-order incompleta.');
    return jsonResponse({ error: 'Não foi possível registrar o pedido agora.' }, 500, origin);
  }

  let payload: Record<string, unknown>;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonResponse({ error: 'Dados do pedido inválidos.' }, 400, origin);
    }
    payload = body as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Dados do pedido inválidos.' }, 400, origin);
  }

  const items = readOrderItems(payload.items);
  const customerName = typeof payload.customer_name === 'string' ? payload.customer_name.trim() : '';
  const customerPhone = typeof payload.customer_phone === 'string' ? payload.customer_phone.trim() : '';
  if (
    !items ||
    customerName.length > 120 ||
    customerPhone.length > 40
  ) {
    return jsonResponse({ error: 'Revise os itens e os dados do pedido.' }, 400, origin);
  }

  const productBaseUrl = Deno.env.get('STORE_PUBLIC_URL')?.trim() || origin;
  try {
    const parsedBaseUrl = new URL(productBaseUrl);
    if (parsedBaseUrl.protocol !== 'https:' && parsedBaseUrl.protocol !== 'http:') {
      throw new Error('URL scheme is invalid');
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await adminClient.rpc('create_customer_order', {
      p_items: items,
      p_customer_name: customerName || null,
      p_customer_phone: customerPhone || null,
      p_product_base_url: parsedBaseUrl.origin,
    });

    if (error) {
      console.error('Falha ao registrar pedido.', error);
      return jsonResponse(
        { error: 'Não foi possível registrar o pedido. Verifique a disponibilidade dos produtos.' },
        422,
        origin,
      );
    }
    if (!data || typeof data !== 'object') {
      console.error('A função create_customer_order não retornou o pedido registrado.');
      return jsonResponse({ error: 'O banco não confirmou o pedido.' }, 500, origin);
    }

    return jsonResponse({ order: data }, 201, origin);
  } catch (error) {
    console.error('Falha ao executar a função create-order.', error);
    return jsonResponse({ error: 'Não foi possível registrar o pedido agora.' }, 500, origin);
  }
});
