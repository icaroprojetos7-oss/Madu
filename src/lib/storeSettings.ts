import { supabase } from './supabase';

export function normalizeWhatsAppNumber(value: string): string | null {
  const input = value.trim();
  if (!input || !/^[+\d\s().-]+$/.test(input)) return null;

  let digits = input.replace(/\D/g, '');
  if (input.startsWith('00')) digits = digits.slice(2);
  else if (
    !input.startsWith('+')
    && !digits.startsWith('55')
    && (digits.length === 10 || digits.length === 11)
  ) {
    digits = `55${digits}`;
  }

  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export async function getWhatsAppNumber(): Promise<string> {
  const environmentNumber = normalizeWhatsAppNumber(import.meta.env.VITE_WHATSAPP_NUMBER ?? '') ?? '';
  if (!supabase) return environmentNumber;

  const { data, error } = await supabase
    .from('store_settings')
    .select('whatsapp_number')
    .eq('id', 'main')
    .maybeSingle();

  if (error) {
    throw new Error(`Não foi possível carregar o WhatsApp da loja: ${error.message}`);
  }
  if (!data) return environmentNumber;

  const storedValue = typeof data.whatsapp_number === 'string' ? data.whatsapp_number : '';
  if (!storedValue) return '';

  const normalized = normalizeWhatsAppNumber(storedValue);
  if (!normalized) throw new Error('O número de WhatsApp salvo está em formato inválido.');
  return normalized;
}

export async function saveWhatsAppNumber(value: string): Promise<string> {
  const normalized = normalizeWhatsAppNumber(value);
  if (!normalized) {
    throw new Error('Informe um número de WhatsApp válido com código do país.');
  }
  if (!supabase) throw new Error('Supabase não configurado. O número não foi salvo.');

  const { data, error } = await supabase
    .from('store_settings')
    .upsert({
      id: 'main',
      whatsapp_number: normalized,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select('whatsapp_number')
    .single();

  if (error) throw new Error(`Não foi possível salvar o WhatsApp da loja: ${error.message}`);
  const confirmedNumber = typeof data?.whatsapp_number === 'string'
    ? normalizeWhatsAppNumber(data.whatsapp_number)
    : null;
  if (confirmedNumber !== normalized) {
    throw new Error('O Supabase não confirmou o número de WhatsApp salvo.');
  }
  return confirmedNumber;
}
