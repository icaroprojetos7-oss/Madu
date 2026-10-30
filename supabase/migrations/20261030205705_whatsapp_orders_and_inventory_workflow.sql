create sequence if not exists public.order_number_seq;

alter table public.orders
  add column if not exists order_number text,
  add column if not exists confirmed_by uuid references auth.users (id) on delete set null,
  add column if not exists confirmed_at timestamptz,
  add column if not exists reversed_by uuid references auth.users (id) on delete set null,
  add column if not exists reversed_at timestamptz,
  add column if not exists reversal_reason text;

update public.orders
set order_number = 'MADU-LEGACY-' || upper(replace(id::text, '-', ''))
where order_number is null;

alter table public.orders
  alter column order_number set default (
    'MADU-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' ||
    lpad(nextval('public.order_number_seq')::text, 6, '0')
  ),
  alter column order_number set not null;

create unique index if not exists orders_order_number_unique
  on public.orders (order_number);
create index if not exists orders_status_created_at_idx
  on public.orders (status, created_at desc);
revoke all on sequence public.order_number_seq from public, anon, authenticated;
grant usage, select on sequence public.order_number_seq to service_role;

alter table public.orders
  drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in (
    'received',
    'awaiting_confirmation',
    'confirmed',
    'preparing',
    'shipped',
    'delivered',
    'cancelled',
    'reversed'
  ));

alter table public.order_items
  add column if not exists image_url text,
  add column if not exists product_url text;

alter table public.order_items
  drop constraint if exists order_items_product_id_fkey;
alter table public.order_items
  add constraint order_items_product_id_fkey
  foreign key (product_id) references public.products (id) on delete restrict;

alter table public.inventory_movements
  add column if not exists order_id uuid references public.orders (id) on delete set null,
  add column if not exists stock_before integer,
  add column if not exists stock_after integer,
  add column if not exists admin_email text,
  add column if not exists product_name text,
  add column if not exists sku text,
  add column if not exists product_image text;

alter table public.inventory_movements
  drop constraint if exists inventory_movements_movement_type_check;
alter table public.inventory_movements
  add constraint inventory_movements_movement_type_check
  check (movement_type in ('entry', 'exit', 'sale', 'refund', 'adjustment'));

create index if not exists inventory_movements_order_id_idx
  on public.inventory_movements (order_id, created_at desc)
  where order_id is not null;

revoke all on public.orders, public.order_items, public.inventory_movements
  from anon, authenticated;
grant select on public.orders, public.order_items, public.inventory_movements
  to authenticated;
grant select, insert on public.orders, public.order_items to service_role;
grant select on public.products to service_role;

drop policy if exists "madu_admin_manage_orders" on public.orders;
drop policy if exists "madu_customer_read_own_orders" on public.orders;
drop policy if exists "madu_admin_read_orders" on public.orders;
create policy "madu_admin_read_orders"
  on public.orders for select to authenticated
  using ((select private.is_store_admin()));

drop policy if exists "madu_admin_manage_order_items" on public.order_items;
drop policy if exists "madu_customer_read_own_order_items" on public.order_items;
drop policy if exists "madu_admin_read_order_items" on public.order_items;
create policy "madu_admin_read_order_items"
  on public.order_items for select to authenticated
  using ((select private.is_store_admin()));

drop policy if exists "madu_admin_manage_inventory_movements" on public.inventory_movements;
drop policy if exists "madu_admin_read_inventory_movements" on public.inventory_movements;
create policy "madu_admin_read_inventory_movements"
  on public.inventory_movements for select to authenticated
  using ((select private.is_store_admin()));

create or replace function private.record_product_stock_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_email text;
  operation text := current_setting('madu.inventory_operation', true);
  previous_stock integer := 0;
  movement text := 'entry';
begin
  if actor_id is null or not (select private.is_store_admin()) then
    raise exception 'Administrator permission required to change stock'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if new.stock is not distinct from old.stock then
      return new;
    end if;
    if operation in ('sale', 'refund') then
      return new;
    end if;
    previous_stock := old.stock;
    movement := case when new.stock > old.stock then 'entry' else 'adjustment' end;
  elsif new.stock = 0 then
    return new;
  end if;

  select permissions.email into actor_email
  from public.admin_user_permissions as permissions
  where permissions.user_id = actor_id;

  insert into public.inventory_movements (
    product_id,
    admin_user_id,
    admin_email,
    movement_type,
    quantity,
    stock_before,
    stock_after,
    product_name,
    sku,
    product_image,
    notes
  )
  values (
    new.id,
    actor_id,
    actor_email,
    movement,
    abs(new.stock - previous_stock),
    previous_stock,
    new.stock,
    new.name,
    new.sku,
    new.image,
    case
      when tg_op = 'INSERT' then 'Estoque inicial do produto'
      when new.stock > previous_stock then 'Entrada manual pelo cadastro de produtos'
      else 'Ajuste manual pelo cadastro de produtos'
    end
  );

  return new;
end;
$$;

revoke all on function private.record_product_stock_change() from public, anon, authenticated;

drop trigger if exists madu_record_product_stock_change on public.products;
create trigger madu_record_product_stock_change
  after insert or update of stock on public.products
  for each row execute function private.record_product_stock_change();

create or replace function public.create_customer_order(
  p_items jsonb,
  p_customer_name text,
  p_customer_phone text,
  p_product_base_url text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  item_product record;
  item_quantity integer;
  item_variation text;
  subtotal bigint := 0;
  created_order public.orders%rowtype;
  saved_items jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Order items must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Order must contain between 1 and 50 items'
      using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(item) <> 'object'
      or coalesce(item ->> 'product_id', '') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(item ->> 'quantity', '') !~ '^[0-9]+$'
      or length(item ->> 'quantity') > 10 then
      raise exception 'Invalid order item' using errcode = '22023';
    end if;
    if (item ->> 'quantity')::numeric not between 1 and 2147483647 then
      raise exception 'Invalid product quantity' using errcode = '22023';
    end if;
  end loop;

  if nullif(btrim(p_product_base_url), '') is null
    or length(p_customer_name) > 120
    or length(p_customer_phone) > 40 then
    raise exception 'Invalid order details' using errcode = '22023';
  end if;

  for item_product in
    select
      (entry.value ->> 'product_id')::uuid as product_id,
      sum((entry.value ->> 'quantity')::bigint) as quantity
    from jsonb_array_elements(p_items) as entry(value)
    group by (entry.value ->> 'product_id')::uuid
    order by (entry.value ->> 'product_id')::uuid
  loop
    if item_product.quantity <= 0 or item_product.quantity > 2147483647 then
      raise exception 'Invalid product quantity' using errcode = '22023';
    end if;

    perform 1
    from public.products as product
    where product.id = item_product.product_id
      and product.is_active = true
      and product.stock >= item_product.quantity
    for update;

    if not found then
      raise exception 'A product is unavailable or has insufficient stock'
        using errcode = '23514';
    end if;
  end loop;

  for item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(item) <> 'object'
      or coalesce(item ->> 'product_id', '') = ''
      or coalesce(item ->> 'quantity', '') !~ '^[0-9]+$' then
      raise exception 'Invalid order item' using errcode = '22023';
    end if;

    item_quantity := (item ->> 'quantity')::integer;
    item_variation := nullif(btrim(item ->> 'variation'), '');

    select
      product.id,
      product.name,
      product.sku,
      product.slug,
      product.image,
      coalesce(product.sale_price_cents, product.price_cents) as unit_price_cents,
      product.variations
    into item_product
    from public.products as product
    where product.id = (item ->> 'product_id')::uuid
      and product.is_active = true;

    if not found then
      raise exception 'A product is unavailable' using errcode = '23514';
    end if;

    if item_variation is not null
      and not (item_product.variations @> array[item_variation]) then
      raise exception 'A product variation is unavailable' using errcode = '23514';
    end if;

    subtotal := subtotal + item_product.unit_price_cents::bigint * item_quantity;
    if subtotal > 2147483647 then
      raise exception 'Order total exceeds the supported limit' using errcode = '22003';
    end if;
  end loop;

  insert into public.orders (
    customer_name,
    customer_phone,
    status,
    subtotal_cents,
    total_cents
  )
  values (
    nullif(btrim(p_customer_name), ''),
    nullif(btrim(p_customer_phone), ''),
    'awaiting_confirmation',
    subtotal::integer,
    subtotal::integer
  )
  returning * into created_order;

  for item in select value from jsonb_array_elements(p_items)
  loop
    item_quantity := (item ->> 'quantity')::integer;
    item_variation := nullif(btrim(item ->> 'variation'), '');

    select
      product.id,
      product.name,
      product.sku,
      product.slug,
      product.image,
      coalesce(product.sale_price_cents, product.price_cents) as unit_price_cents
    into item_product
    from public.products as product
    where product.id = (item ->> 'product_id')::uuid
      and product.is_active = true;

    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      sku,
      variation,
      quantity,
      unit_price_cents,
      line_total_cents,
      image_url,
      product_url
    )
    values (
      created_order.id,
      item_product.id,
      item_product.name,
      item_product.sku,
      item_variation,
      item_quantity,
      item_product.unit_price_cents,
      (item_product.unit_price_cents::bigint * item_quantity)::integer,
      item_product.image,
      rtrim(p_product_base_url, '/') || '/produto/' || item_product.slug
    );
  end loop;

  select jsonb_agg(
    jsonb_build_object(
      'id', item_row.id,
      'product_id', item_row.product_id,
      'product_name', item_row.product_name,
      'sku', item_row.sku,
      'variation', item_row.variation,
      'quantity', item_row.quantity,
      'unit_price_cents', item_row.unit_price_cents,
      'line_total_cents', item_row.line_total_cents,
      'image_url', item_row.image_url,
      'product_url', item_row.product_url
    )
    order by item_row.created_at, item_row.id
  )
  into saved_items
  from public.order_items as item_row
  where item_row.order_id = created_order.id;

  return jsonb_build_object(
    'id', created_order.id,
    'order_number', created_order.order_number,
    'status', created_order.status,
    'created_at', created_order.created_at,
    'subtotal_cents', created_order.subtotal_cents,
    'total_cents', created_order.total_cents,
    'customer_name', created_order.customer_name,
    'customer_phone', created_order.customer_phone,
    'order_items', saved_items
  );
end;
$$;

revoke all on function public.create_customer_order(jsonb, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_customer_order(jsonb, text, text, text)
  to service_role;

create or replace function private.confirm_store_order(p_order_id uuid, p_admin_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_status text;
  order_item record;
  current_stock integer;
  product_active boolean;
  actor_email text;
begin
  if p_admin_id is null
    or p_admin_id is distinct from (select auth.uid())
    or not (select private.is_store_admin()) then
    raise exception 'Administrator permission required' using errcode = '42501';
  end if;

  select orders.status into order_status
  from public.orders as orders
  where orders.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if order_status not in ('received', 'awaiting_confirmation') then
    raise exception 'Order has already been processed' using errcode = '23514';
  end if;

  select permissions.email into actor_email
  from public.admin_user_permissions as permissions
  where permissions.user_id = p_admin_id;

  for order_item in
    select items.id, items.product_id, items.quantity,
      items.product_name, items.sku, items.image_url
    from public.order_items as items
    where items.order_id = p_order_id
    order by items.product_id, items.id
  loop
    if order_item.product_id is null then
      raise exception 'A product in this order no longer exists'
        using errcode = '23514';
    end if;

    select product.stock, product.is_active
    into current_stock, product_active
    from public.products as product
    where product.id = order_item.product_id
    for update;

    if not found or not product_active or current_stock < order_item.quantity then
      raise exception 'Insufficient stock to confirm this order'
        using errcode = '23514';
    end if;

    perform set_config('madu.inventory_operation', 'sale', true);
    update public.products
    set stock = current_stock - order_item.quantity
    where id = order_item.product_id;

    insert into public.inventory_movements (
      product_id, admin_user_id, admin_email, movement_type, quantity,
      stock_before, stock_after, product_name, sku, product_image, order_id, notes
    )
    values (
      order_item.product_id, p_admin_id, actor_email, 'sale',
      order_item.quantity, current_stock, current_stock - order_item.quantity,
      order_item.product_name, order_item.sku, order_item.image_url,
      p_order_id, 'Saída por confirmação de venda'
    );
  end loop;

  update public.orders
  set status = 'confirmed',
      confirmed_by = p_admin_id,
      confirmed_at = now(),
      updated_at = now()
  where id = p_order_id;
end;
$$;

create or replace function private.cancel_store_order(p_order_id uuid, p_admin_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_status text;
begin
  if p_admin_id is null
    or p_admin_id is distinct from (select auth.uid())
    or not (select private.is_store_admin()) then
    raise exception 'Administrator permission required' using errcode = '42501';
  end if;

  select orders.status into order_status
  from public.orders as orders
  where orders.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if order_status not in ('received', 'awaiting_confirmation') then
    raise exception 'Only pending orders can be cancelled'
      using errcode = '23514';
  end if;

  update public.orders
  set status = 'cancelled', updated_at = now()
  where id = p_order_id;
end;
$$;

create or replace function private.reverse_store_order(
  p_order_id uuid,
  p_admin_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_status text;
  order_item record;
  current_stock integer;
  actor_email text;
begin
  if p_admin_id is null
    or p_admin_id is distinct from (select auth.uid())
    or not (select private.is_store_admin()) then
    raise exception 'Administrator permission required' using errcode = '42501';
  end if;
  if nullif(btrim(p_reason), '') is null or length(p_reason) > 500 then
    raise exception 'A reversal reason of up to 500 characters is required'
      using errcode = '22023';
  end if;

  select orders.status into order_status
  from public.orders as orders
  where orders.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if order_status not in ('confirmed', 'preparing', 'shipped', 'delivered') then
    raise exception 'Order is not eligible for reversal' using errcode = '23514';
  end if;

  select permissions.email into actor_email
  from public.admin_user_permissions as permissions
  where permissions.user_id = p_admin_id;

  for order_item in
    select items.id, items.product_id, items.quantity,
      items.product_name, items.sku, items.image_url
    from public.order_items as items
    where items.order_id = p_order_id
    order by items.product_id, items.id
  loop
    if order_item.product_id is null then
      raise exception 'A product in this order no longer exists'
        using errcode = '23514';
    end if;

    select product.stock into current_stock
    from public.products as product
    where product.id = order_item.product_id
    for update;

    if not found or current_stock > 2147483647 - order_item.quantity then
      raise exception 'Unable to restore the full order quantity'
        using errcode = '23514';
    end if;

    perform set_config('madu.inventory_operation', 'refund', true);
    update public.products
    set stock = current_stock + order_item.quantity
    where id = order_item.product_id;

    insert into public.inventory_movements (
      product_id, admin_user_id, admin_email, movement_type, quantity,
      stock_before, stock_after, product_name, sku, product_image, order_id, notes
    )
    values (
      order_item.product_id, p_admin_id, actor_email, 'refund',
      order_item.quantity, current_stock, current_stock + order_item.quantity,
      order_item.product_name, order_item.sku, order_item.image_url,
      p_order_id, btrim(p_reason)
    );
  end loop;

  update public.orders
  set status = 'reversed',
      reversed_by = p_admin_id,
      reversed_at = now(),
      reversal_reason = btrim(p_reason),
      updated_at = now()
  where id = p_order_id;
end;
$$;

create or replace function private.complete_store_order(p_order_id uuid, p_admin_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_status text;
begin
  if p_admin_id is null
    or p_admin_id is distinct from (select auth.uid())
    or not (select private.is_store_admin()) then
    raise exception 'Administrator permission required' using errcode = '42501';
  end if;

  select orders.status into order_status
  from public.orders as orders
  where orders.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if order_status not in ('confirmed', 'preparing', 'shipped') then
    raise exception 'Order cannot be marked as completed' using errcode = '23514';
  end if;

  update public.orders
  set status = 'delivered', updated_at = now()
  where id = p_order_id;
end;
$$;

revoke all on function private.confirm_store_order(uuid, uuid) from public, anon, authenticated;
revoke all on function private.cancel_store_order(uuid, uuid) from public, anon, authenticated;
revoke all on function private.reverse_store_order(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.complete_store_order(uuid, uuid) from public, anon, authenticated;
grant execute on function private.confirm_store_order(uuid, uuid) to authenticated;
grant execute on function private.cancel_store_order(uuid, uuid) to authenticated;
grant execute on function private.reverse_store_order(uuid, uuid, text) to authenticated;
grant execute on function private.complete_store_order(uuid, uuid) to authenticated;

create or replace function public.confirm_store_order(p_order_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.confirm_store_order(p_order_id, (select auth.uid()));
$$;

create or replace function public.cancel_store_order(p_order_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.cancel_store_order(p_order_id, (select auth.uid()));
$$;

create or replace function public.reverse_store_order(p_order_id uuid, p_reason text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.reverse_store_order(p_order_id, (select auth.uid()), p_reason);
$$;

create or replace function public.complete_store_order(p_order_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.complete_store_order(p_order_id, (select auth.uid()));
$$;

revoke all on function public.confirm_store_order(uuid) from public, anon, authenticated;
revoke all on function public.cancel_store_order(uuid) from public, anon, authenticated;
revoke all on function public.reverse_store_order(uuid, text) from public, anon, authenticated;
revoke all on function public.complete_store_order(uuid) from public, anon, authenticated;
grant execute on function public.confirm_store_order(uuid) to authenticated;
grant execute on function public.cancel_store_order(uuid) to authenticated;
grant execute on function public.reverse_store_order(uuid, text) to authenticated;
grant execute on function public.complete_store_order(uuid) to authenticated;

notify pgrst, 'reload schema';