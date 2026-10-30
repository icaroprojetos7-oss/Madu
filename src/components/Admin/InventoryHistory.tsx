import { useCallback, useEffect, useState } from 'react';
import { getInventoryMovementsFromSupabase, type InventoryMovement } from '../../lib/orders';

const movementLabels: Record<InventoryMovement['movement_type'], string> = {
  entry: 'Entrada',
  exit: 'Saída',
  sale: 'Saída por venda',
  refund: 'Estorno',
  adjustment: 'Ajuste manual',
};

export function InventoryHistory() {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setMovements(await getInventoryMovementsFromSupabase());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o histórico.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="mt-6 rounded-3xl border border-[#f1dfe9] bg-white p-3 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#2d1d25]">Movimentações recentes</h2>
          <p className="mt-1 text-xs text-[#76506a]">Até 100 registros, do mais recente ao mais antigo.</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="min-h-11 rounded-full border border-[#efd7e7] px-4 text-sm text-[#76506a] disabled:opacity-50"
        >
          Atualizar
        </button>
      </div>

      {error && <p role="alert" className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
      {loading ? (
        <p role="status" className="py-5 text-sm text-[#5d4454]">Carregando movimentações...</p>
      ) : movements.length === 0 ? (
        <p className="py-5 text-sm text-[#5d4454]">Nenhuma movimentação registrada.</p>
      ) : (
        <ul className="divide-y divide-[#f1dfe9]">
          {movements.map((movement) => (
            <li key={movement.id} className="flex min-w-0 items-start gap-3 py-3">
              <img
                src={movement.product_image || movement.product?.image || '/assets/brand/madu-favicon.png'}
                alt=""
                className="h-12 w-12 shrink-0 rounded-xl bg-[#f8e9ef] object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="break-words text-sm font-medium text-[#2d1d25]">
                    {movement.product_name ?? movement.product?.name ?? 'Produto removido'}
                  </p>
                  <span className="rounded-full bg-[#f8e9ef] px-2.5 py-1 text-xs font-medium text-[#76506a]">
                    {movementLabels[movement.movement_type]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#76506a]">
                  Código: {movement.sku ?? movement.product?.sku ?? '—'}
                  {' · '}Saldo {movement.stock_before ?? '—'} → {movement.stock_after ?? '—'}
                  {' · '}Movimentado: {movement.quantity}
                </p>
                <p className="mt-1 break-words text-xs text-[#76506a]">
                  {movement.order?.order_number ? `Pedido ${movement.order.order_number} · ` : ''}
                  {movement.admin_email || `Responsável ${movement.admin_user_id.slice(0, 8)}`}
                  {' · '}
                  {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(movement.created_at))}
                </p>
                {movement.notes && <p className="mt-1 break-words text-xs text-[#5d4454]">{movement.notes}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
