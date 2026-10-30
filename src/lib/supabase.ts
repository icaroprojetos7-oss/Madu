import { createClient } from '@supabase/supabase-js';
import { products as fallbackProducts, type Product } from '../data/mockProducts';
import { validateProductImageFile } from './products';

export const PRODUCT_IMAGES_BUCKET = 'product-images';
const viteUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || import.meta.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const viteKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
)?.trim();
const supabaseUrl = viteUrl && viteUrl !== 'https://example.supabase.co' ? viteUrl : '';
const supabaseKey = viteKey && viteKey !== 'replace-with-public-publishable-key' ? viteKey : '';

export const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

export function getSupabaseStatus() {
  if (!supabase) {
    return {
      enabled: false,
      message:
        'Supabase não configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY) antes do build ou do deploy.',
    };
  }

  return {
    enabled: true,
    message: 'Supabase conectado e pronto para sincronizar produtos.',
  };
}

function normalizeProduct(record: Record<string, unknown>): Product {
  return {
    id: String(record.id ?? record.slug ?? crypto.randomUUID()),
    slug: String(record.slug ?? String(record.name ?? 'produto').toLowerCase().replace(/\s+/g, '-')),
    name: String(record.name ?? 'Produto sem nome'),
    description: String(record.description ?? 'Descrição indisponível.'),
    category: String(record.category ?? 'Geral'),
    price_cents: Number(record.price_cents ?? 0),
    sale_price_cents:
      record.sale_price_cents !== undefined && record.sale_price_cents !== null
        ? Number(record.sale_price_cents)
        : undefined,
    sku: record.sku ? String(record.sku) : undefined,
    image: typeof record.image === 'string' ? record.image : '',
    featured: Boolean(record.featured),
    is_active: record.is_active !== false,
    stock: Number(record.stock ?? 0),
    variations: Array.isArray(record.variations)
      ? record.variations.map((variation) => String(variation))
      : [],
  };
}

function productPayload(product: Product) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    category: product.category,
    price_cents: product.price_cents,
    sale_price_cents: product.sale_price_cents ?? null,
    sku: product.sku ?? null,
    image: product.image,
    featured: product.featured ?? false,
    is_active: product.is_active ?? true,
    stock: product.stock,
    variations: product.variations ?? [],
  };
}

async function findDuplicateSku(product: Product, excludeProductId?: string): Promise<string | null> {
  if (!supabase || !product.sku) return null;

  let query = supabase.from('products').select('id').eq('sku', product.sku);
  if (excludeProductId) query = query.neq('id', excludeProductId);
  const { data: existingProduct, error } = await query.maybeSingle();

  if (error) return `Não foi possível validar o SKU: ${error.message}`;
  if (existingProduct) return `O SKU ${product.sku} já está cadastrado.`;
  return null;
}

export async function uploadProductImage(
  file: File,
  productId: string,
): Promise<{ ok: true; publicUrl: string } | { ok: false; reason: string }> {
  if (!supabase) {
    return { ok: false, reason: 'Credenciais do Supabase ausentes.' };
  }

  const validationError = validateProductImageFile(file);
  if (validationError) return { ok: false, reason: validationError };

  const extensionByMimeType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  const path = `${productId}/${crypto.randomUUID()}.${extensionByMimeType[file.type]}`;
  const bucket = supabase.storage.from(PRODUCT_IMAGES_BUCKET);
  const { error } = await bucket.upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  });

  if (error) return { ok: false, reason: `Não foi possível enviar a imagem: ${error.message}` };

  const { data } = bucket.getPublicUrl(path);
  if (!data.publicUrl) {
    return { ok: false, reason: 'O Supabase não retornou a URL pública da imagem.' };
  }
  return { ok: true, publicUrl: data.publicUrl };
}

export async function getProductsFromSupabase(includeInactive = false): Promise<Product[]> {
  if (!supabase) {
    return import.meta.env.DEV
      ? fallbackProducts.filter((product) => includeInactive || product.is_active !== false)
      : [];
  }

  let query = supabase.from('products').select('*');
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Não foi possível carregar os produtos: ${error.message}`);
  }

  return (data ?? []).map((record) => normalizeProduct(record as Record<string, unknown>));
}

export async function saveProductToSupabase(
  product: Product,
): Promise<{ ok: true; product: Product } | { ok: false; reason: string }> {
  if (!supabase) {
    return {
      ok: false,
      reason: 'Credenciais do Supabase ausentes.',
    };
  }

  const skuError = await findDuplicateSku(product);
  if (skuError) {
    return { ok: false, reason: skuError };
  }

  const { data, error } = await supabase
    .from('products')
    .insert(productPayload(product))
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { ok: false, reason: 'Já existe um produto com esse SKU ou identificador.' };
    }
    return {
      ok: false,
      reason: error.message,
    };
  }

  if (!data) {
    return { ok: false, reason: 'O Supabase não confirmou o produto cadastrado.' };
  }

  return { ok: true, product: normalizeProduct(data as Record<string, unknown>) };
}

export async function updateProductInSupabase(
  product: Product,
  stockUpdate?: { preserveCurrentStock: true } | { expectedStock: number },
): Promise<{ ok: true; product: Product } | { ok: false; reason: string }> {
  if (!supabase) {
    return { ok: false, reason: 'Credenciais do Supabase ausentes.' };
  }

  const skuError = await findDuplicateSku(product, product.id);
  if (skuError) return { ok: false, reason: skuError };

  const payload = productPayload(product);
  if (stockUpdate && 'preserveCurrentStock' in stockUpdate) {
    delete payload.stock;
  }

  let query = supabase
    .from('products')
    .update(payload)
    .eq('id', product.id);
  if (stockUpdate && 'expectedStock' in stockUpdate) {
    query = query.eq('stock', stockUpdate.expectedStock);
  }
  const { data, error } = await query.select('*').single();

  if (error) {
    if (error.code === '23505') {
      return { ok: false, reason: 'Já existe um produto com esse SKU ou identificador.' };
    }
    if (error.code === 'PGRST116' && stockUpdate && 'expectedStock' in stockUpdate) {
      return {
        ok: false,
        reason: 'O estoque mudou desde que o produto foi aberto. Recarregue o catálogo e revise a quantidade antes de salvar.',
      };
    }
    return { ok: false, reason: error.message };
  }
  if (!data) {
    return { ok: false, reason: 'O Supabase não confirmou a atualização do produto.' };
  }
  return { ok: true, product: normalizeProduct(data as Record<string, unknown>) };
}

export async function deleteProductFromSupabase(
  productId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!supabase) {
    return { ok: false, reason: 'Credenciais do Supabase ausentes.' };
  }

  const { data, error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, reason: error.message };
  if (data?.id !== productId) {
    return { ok: false, reason: 'O Supabase não confirmou a remoção do produto.' };
  }
  return { ok: true };
}
