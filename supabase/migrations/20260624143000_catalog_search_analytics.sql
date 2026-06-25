-- Estadisticas de uso del catalogo desde Biblioteca ULV App.
-- No toca Koha y no guarda IP, user agent ni datos sensibles.

create table if not exists public.catalog_search_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete set null,
  query text not null,
  normalized_query text not null,
  search_type text not null default 'keyword' check (search_type in ('keyword', 'title', 'author', 'subject', 'isbn')),
  koha_url text not null,
  source text not null default 'catalog' check (source in ('catalog', 'dashboard', 'saved_resource', 'history')),
  created_at timestamptz not null default now()
);

alter table public.catalog_search_events add column if not exists normalized_query text;
alter table public.catalog_search_events add column if not exists source text not null default 'catalog';
alter table public.catalog_search_events add column if not exists koha_url text not null default '';

update public.catalog_search_events
set normalized_query = regexp_replace(
  translate(lower(trim(query)), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'),
  '\s+',
  ' ',
  'g'
)
where normalized_query is null or trim(normalized_query) = '';

alter table public.catalog_search_events alter column normalized_query set not null;

create index if not exists catalog_search_events_created_at_idx on public.catalog_search_events(created_at desc);
create index if not exists catalog_search_events_normalized_query_idx on public.catalog_search_events(normalized_query);
create index if not exists catalog_search_events_search_type_idx on public.catalog_search_events(search_type);
create index if not exists catalog_search_events_user_id_idx on public.catalog_search_events(user_id);

create table if not exists public.catalog_saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  title text not null,
  author text,
  isbn text,
  year text,
  koha_url text not null,
  notes text,
  status text not null default 'saved' check (status in ('saved', 'want_to_read', 'reading', 'read', 'favorite')),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.catalog_search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete cascade,
  query text not null,
  search_type text not null default 'keyword' check (search_type in ('keyword', 'title', 'author', 'subject', 'isbn')),
  koha_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists catalog_saved_items_user_url_idx on public.catalog_saved_items(user_id, koha_url);
create index if not exists catalog_saved_items_status_idx on public.catalog_saved_items(status);
create index if not exists catalog_saved_items_created_at_idx on public.catalog_saved_items(created_at desc);
create index if not exists catalog_search_history_user_id_idx on public.catalog_search_history(user_id, created_at desc);

alter table public.catalog_search_events enable row level security;
alter table public.catalog_saved_items enable row level security;
alter table public.catalog_search_history enable row level security;

drop policy if exists "catalog stats admins can read search events" on public.catalog_search_events;
drop policy if exists "catalog stats admins can read saved items" on public.catalog_saved_items;
drop policy if exists "catalog users can manage saved items" on public.catalog_saved_items;
drop policy if exists "catalog users can manage search history" on public.catalog_search_history;

create policy "catalog users can manage saved items"
on public.catalog_saved_items
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "catalog users can manage search history"
on public.catalog_search_history
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "catalog stats admins can read search events"
on public.catalog_search_events
for select
to authenticated
using (
  exists (
    select 1
    from public.app_users
    where app_users.id = auth.uid()
      and app_users.role in ('admin', 'superadmin')
      and app_users.status = 'active'
  )
);

create policy "catalog stats admins can read saved items"
on public.catalog_saved_items
for select
to authenticated
using (
  exists (
    select 1
    from public.app_users
    where app_users.id = auth.uid()
      and app_users.role in ('admin', 'superadmin')
      and app_users.status = 'active'
  )
);

create or replace function public.normalize_catalog_search_query(p_value text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    translate(lower(trim(coalesce(p_value, ''))), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'),
    '\s+',
    ' ',
    'g'
  )
$$;

create or replace function public.register_catalog_search_event(
  p_query text,
  p_search_type text,
  p_koha_url text,
  p_source text default 'catalog'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text := public.normalize_catalog_search_query(p_query);
  v_search_type text := case when p_search_type in ('keyword', 'title', 'author', 'subject', 'isbn') then p_search_type else 'keyword' end;
  v_source text := case when p_source in ('catalog', 'dashboard', 'saved_resource', 'history') then p_source else 'catalog' end;
  v_event_id uuid;
begin
  if v_query = '' or trim(coalesce(p_koha_url, '')) = '' then
    return null;
  end if;

  insert into public.catalog_search_events (user_id, query, normalized_query, search_type, koha_url, source)
  values (auth.uid(), v_query, v_query, v_search_type, trim(p_koha_url), v_source)
  returning id into v_event_id;

  return v_event_id;
end;
$$;

grant execute on function public.register_catalog_search_event(text, text, text, text) to anon, authenticated;
