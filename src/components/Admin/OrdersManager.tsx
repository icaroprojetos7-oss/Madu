import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, RotateCcw, X } from 'lucide-react';
import {
  cancelStoreOrder,
  completeStoreOrder,
  confirmStoreOrder,
  getOrdersFromSupabase,
  reverseStoreOrder,
  type OrderStatus,
  type StoreOrder,
} from '../../lib/orders';
import { formatCurrency } from '../../lib/commerce';

type OrderFilter = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';

const filters: Array<{ id: OrderFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'pending', label: 'Pendentes' },
  { id: 'confirmed', label: 'Confirmados' },
  { id: 'completed', label: 'Concluídos' },
  { id: 'cancelled', label: 'Cancelados' },
];

function filterOrder(order: StoreOrder, filter: OrderFilter) {
  if (filter === 'all') return true;
  if (filter === 'pending') return order.status === 'received' || order.status === 'awaiting_confirmation';
  if (filter === 'confirmed') return ['confirmed', 'preparing', 'shipped'].includes(order.status);
  if (filter === 'completed') return order.status === 'delivered';
  return order.status === 'cancelled' || order.status === 'reversed';
}

function orderStatusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    received: 'Aguardando confirmação',
    awaiting_confirmation: 'Aguardando confirmação',
    confirmed: 'Confirmado',
    preparing: 'Em preparação',
    shipped: 'Enviado',
    delivered: 'Concluído',
    cancelled: 'Cancelado',
    reversed: 'Estornado',
  };
  return labels[status];
}

function orderStatusTone(status: OrderStatus) {
  if (status === 'received' || status === 'awaiting_confirmation') return 'bg-amber-50 text-amber-800';
  if (status === 'cancelled' || status === 'reversed') return 'bg-rose-50 text-rose-800';
  if (status === 'delivered') return 'bg-emerald-50 text-emerald-800';
  return 'bg-[#f8e9ef] text-[#76506a]';
}

function orderDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits : null;
}

export function OrdersManager() {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [filter, setFilter] = useState<OrderFilter>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reversalOrderId, setReversalOrderId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  const refreshOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOrders(await getOrdersFromSupabase());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os pedidos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshOrders();
  }, [refreshOrders]);

  const visibleOrders = useMemo(
    () => orders.filter((order) => filterOrder(order, filter)),
    [filter, orders],
  );

  async function runAction(order: StoreOrder, action: 'confirm' | 'cancel' | 'complete' | 'reverse') {
    if (busyOrderId) return;
    setBusyOrderId(order.id);
    setError('');
    setNotice('');
    try {
      if (action === 'confirm') await confirmStoreOrder(order.id);
      if (action === 'cancel') await cancelStoreOrder(order.id);
      if (action === 'complete') await completeStoreOrder(order.id);
      if (action === 'reverse') await reverseStoreOrder(order.id, reversalReason.trim());
      setReversalOrderId(null);
      setReversalReason('');
      setNotice(`Pedido ${order.order_number} atualizado.`);
      await refreshOrders();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o pedido.');
    } finally {
      setBusyOrderId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2" aria-label="Filtrar pedidos">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={`min-h-11 rounded-full px-4 text-sm font-medium transition ${
              filter === item.id
                ? 'bg-[#8B5E7C] text-white'
                : 'border border-[#efd7e7] bg-white text-[#76506a]'
            }`}
          >
            {item.label}
            <span className="ml-2 opacity-75">{orders.filter((order) => filterOrder(order, item.id)).length}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => void refreshOrders()}
          disabled={loading}
          className="min-h-11 rounded-full border border-[#efd7e7] bg-white px-4 text-sm text-[#76506a] disabled:opacity-50"
        >
          Atualizar
        </button>
      </div>

      {error && <p role="alert" className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
      {notice && <p role="status" className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
      {loading ? (
        <p role="status" className="rounded-3xl border border-[#f1dfe9] bg-white p-6 text-sm text-[#5d4454]">
          Carregando pedidos...
        </p>
      ) : visibleOrders.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-[#d7b0c0] bg-white p-8 text-center text-sm text-[#5d4454]">
          Nenhum pedido encontrado neste filtro.
        </p>
      ) : (
        <ul className="space-y-3">
          {visibleOrders.map((order) => {
            const isPending = order.status === 'received' || order.status === 'awaiting_confirmation';
            const isConfirmed = ['confirmed', 'preparing', 'shipped'].includes(order.status);
            const phone = order.customer_phone ? normalizePhone(order.customer_phone) : null;
            const isBusy = busyOrderId === order.id;
            const expanded = expandedOrderId === order.id;
            return (
              <li key={order.id} className="overflow-hidden rounded-3xl border border-[#f1dfe9] bg-white shadow-sm">
                <article className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex -space-x-3">
                        {order.order_items.slice(0, 3).map((item) => (
                          <img
                            key={item.id}
                            src={item.image_url || '/assets/brand/madu-favicon.png'}
                            alt=""
                            className="h-14 w-14 rounded-2xl border-2 border-white bg-[#f8e9ef] object-cover"
                          />
                        ))}
                      </div>
                      <div className="min-w-0">
                        <p className="break-all text-sm font-semibold text-[#2d1d25]">#{order.order_number}</p>
                        <p className="mt-1 text-xs text-[#76506a]">{orderDate(order.created_at)}</p>
                        {order.customer_name && <p className="mt-1 truncate text-sm text-[#5d4454]">{order.customer_name}</p>}
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${orderStatusTone(order.status)}`}>
                      {orderStatusLabel(order.status)}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-[#5d4454]">
                      {order.order_items.reduce((total, item) => total + item.quantity, 0)} unidade(s)
                      <span className="mx-2 text-[#d7b0c0]">•</span>
                      <strong className="text-base text-[#2d1d25]">{formatCurrency(order.total_cents)}</strong>
                    </div>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setExpandedOrderId(expanded ? null : order.id)}
                      className="min-h-11 rounded-full border border-[#efd7e7] px-4 text-sm font-medium text-[#76506a]"
                    >
                      {expanded ? 'Ocultar detalhes' : 'Ver detalhes'}
                    </button>
                  </div>

                  {expanded && (
                    <div className="mt-4 space-y-3 border-t border-[#f1dfe9] pt-4">
                      {order.order_items.map((item) => (
                        <div key={item.id} className="flex items-center gap-3">
                          <img
                            src={item.image_url || '/assets/brand/madu-favicon.png'}
                            alt=""
                            className="h-14 w-14 shrink-0 rounded-xl bg-[#f8e9ef] object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[#2d1d25]">{item.product_name}</p>
                            <p className="text-xs text-[#76506a]">
                              Código: {item.sku || '—'}
                              {item.variation ? ` · ${item.variation}` : ''}
                              {' · '}Qtd. {item.quantity}
                            </p>
                            {item.product_url && (
                              <a href={item.product_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-[#8B5E7C]">
                                Ver produto <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                          <p className="shrink-0 text-sm font-semibold text-[#2d1d25]">{formatCurrency(item.line_total_cents)}</p>
                        </div>
                      ))}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f1dfe9] pt-3 text-sm">
                        <span className="text-[#5d4454]">Total do pedido</span>
                        <strong>{formatCurrency(order.total_cents)}</strong>
                      </div>
                      {order.reversal_reason && (
                        <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">
                          Motivo do estorno: {order.reversal_reason}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[#f1dfe9] pt-4">
                    {phone ? (
                      <a
                        href={`https://wa.me/${phone}?text=${encodeURIComponent(`Olá! Sobre o pedido ${order.order_number}.`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#efd7e7] px-4 text-sm font-medium text-[#76506a]"
                      >
                        WhatsApp <ExternalLink size={15} />
                      </a>
                    ) : (
                      <span className="inline-flex min-h-11 items-center rounded-full px-2 text-xs text-[#76506a]">
                        Telefone do cliente não informado
                      </span>
                    )}
                    {isPending && (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void runAction(order, 'confirm')}
                          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#8B5E7C] px-4 text-sm font-medium text-white disabled:opacity-50"
                        >
                          <Check size={16} />
                          {isBusy ? 'Processando...' : 'Confirmar venda e dar baixa no estoque'}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            if (window.confirm(`Cancelar o pedido ${order.order_number}? O estoque não será alterado.`)) {
                              void runAction(order, 'cancel');
                            }
                          }}
                          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-rose-200 px-4 text-sm text-rose-800 disabled:opacity-50"
                        >
                          <X size={15} /> Cancelar
                        </button>
                      </>
                    )}
                    {isConfirmed && (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void runAction(order, 'complete')}
                          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#8B5E7C] px-4 text-sm font-medium text-white disabled:opacity-50"
                        >
                          <Check size={16} /> Concluir pedido
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setReversalOrderId(order.id);
                            setReversalReason('');
                          }}
                          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-rose-200 px-4 text-sm text-rose-800 disabled:opacity-50"
                        >
                          <RotateCcw size={15} /> Estornar e devolver ao estoque
                        </button>
                      </>
                    )}
                  </div>

                  {reversalOrderId === order.id && (
                    <form
                      className="mt-4 rounded-2xl bg-rose-50 p-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void runAction(order, 'reverse');
                      }}
                    >
                      <label htmlFor={`reversal-reason-${order.id}`} className="text-sm font-medium text-rose-950">
                        Motivo do estorno
                      </label>
                      <textarea
                        id={`reversal-reason-${order.id}`}
                        value={reversalReason}
                        onChange={(event) => setReversalReason(event.target.value)}
                        maxLength={500}
                        required
                        rows={2}
                        className="mt-2 w-full rounded-xl border border-rose-200 bg-white p-3 text-sm text-[#2d1d25]"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="submit"
                          disabled={isBusy || !reversalReason.trim()}
                          className="min-h-11 rounded-full bg-rose-800 px-4 text-sm font-medium text-white disabled:opacity-50"
                        >
                          {isBusy ? 'Estornando...' : 'Confirmar estorno'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setReversalOrderId(null)}
                          className="min-h-11 rounded-full border border-rose-200 px-4 text-sm text-rose-900"
                        >
                          Voltar
                        </button>
                      </div>
                    </form>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
