-- Configuracion de horarios y reglas de reservas para Biblioteca ULV App.
-- No toca Koha y no depende de service role.

create table if not exists public.library_opening_hours (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint library_opening_hours_unique_day unique (library_id, day_of_week),
  constraint library_opening_hours_valid_times check (
    is_closed
    or (opens_at is not null and closes_at is not null and closes_at > opens_at)
  )
);

create table if not exists public.space_reservation_rules (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.library_spaces(id) on delete cascade,
  min_duration_minutes integer not null default 30 check (min_duration_minutes > 0),
  max_duration_minutes integer not null default 120 check (max_duration_minutes >= min_duration_minutes),
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes > 0),
  min_notice_minutes integer not null default 30 check (min_notice_minutes >= 0),
  max_days_ahead integer not null default 30 check (max_days_ahead >= 0),
  requires_approval boolean not null default true,
  max_reservations_per_user_day integer not null default 2 check (max_reservations_per_user_day > 0),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint space_reservation_rules_unique_space unique (space_id)
);

alter table public.library_opening_hours enable row level security;
alter table public.space_reservation_rules enable row level security;

drop policy if exists "reservation settings staff can read opening hours" on public.library_opening_hours;
drop policy if exists "reservation settings staff can write opening hours" on public.library_opening_hours;
drop policy if exists "reservation users can read opening hours" on public.library_opening_hours;
drop policy if exists "reservation settings staff can read rules" on public.space_reservation_rules;
drop policy if exists "reservation settings staff can write rules" on public.space_reservation_rules;
drop policy if exists "reservation users can read rules" on public.space_reservation_rules;

create policy "reservation users can read opening hours"
on public.library_opening_hours
for select
to authenticated
using (true);

create policy "reservation settings staff can write opening hours"
on public.library_opening_hours
for all
to authenticated
using (
  exists (
    select 1
    from public.app_users
    where app_users.id = auth.uid()
      and app_users.role in ('librarian', 'admin', 'superadmin')
      and app_users.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.app_users
    where app_users.id = auth.uid()
      and app_users.role in ('librarian', 'admin', 'superadmin')
      and app_users.status = 'active'
  )
);

create policy "reservation users can read rules"
on public.space_reservation_rules
for select
to authenticated
using (true);

create policy "reservation settings staff can write rules"
on public.space_reservation_rules
for all
to authenticated
using (
  exists (
    select 1
    from public.app_users
    where app_users.id = auth.uid()
      and app_users.role in ('librarian', 'admin', 'superadmin')
      and app_users.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.app_users
    where app_users.id = auth.uid()
      and app_users.role in ('librarian', 'admin', 'superadmin')
      and app_users.status = 'active'
  )
);

create or replace function public.create_space_reservation(
  p_space_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_purpose text default null,
  p_attendees_count integer default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_library_id uuid;
  v_day_of_week integer;
  v_opening record;
  v_min_duration_minutes integer := 30;
  v_max_duration_minutes integer := 120;
  v_slot_interval_minutes integer := 30;
  v_min_notice_minutes integer := 30;
  v_max_days_ahead integer := 30;
  v_requires_approval boolean := true;
  v_max_reservations_per_user_day integer := 2;
  v_duration_minutes integer;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_reservation_count integer;
  v_status text;
  v_reservation_id uuid;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión para reservar espacios.';
  end if;

  if p_end_at <= p_start_at then
    raise exception 'La hora de fin debe ser posterior a la hora de inicio.';
  end if;

  select library_id
  into v_library_id
  from public.library_spaces
  where id = p_space_id
    and is_reservable = true
    and status = 'active';

  if v_library_id is null then
    raise exception 'El espacio no está disponible para reservas.';
  end if;

  v_day_of_week := extract(dow from p_start_at)::integer;
  v_duration_minutes := floor(extract(epoch from (p_end_at - p_start_at)) / 60)::integer;
  v_day_start := date_trunc('day', p_start_at);
  v_day_end := v_day_start + interval '1 day';

  select *
  into v_opening
  from public.library_opening_hours
  where library_id = v_library_id
    and day_of_week = v_day_of_week;

  if v_opening.id is null then
    if p_start_at::time < time '07:00' or p_end_at::time > time '20:00' then
      raise exception 'La reserva está fuera del horario de atención.';
    end if;
  else
    if v_opening.is_closed then
      raise exception 'La biblioteca está cerrada en la fecha seleccionada.';
    end if;

    if v_opening.opens_at is null or v_opening.closes_at is null then
      raise exception 'La biblioteca está cerrada en la fecha seleccionada.';
    end if;

    if p_start_at::time < v_opening.opens_at or p_end_at::time > v_opening.closes_at then
      raise exception 'La reserva está fuera del horario de atención.';
    end if;
  end if;

  select
    min_duration_minutes,
    max_duration_minutes,
    slot_interval_minutes,
    min_notice_minutes,
    max_days_ahead,
    requires_approval,
    max_reservations_per_user_day
  into
    v_min_duration_minutes,
    v_max_duration_minutes,
    v_slot_interval_minutes,
    v_min_notice_minutes,
    v_max_days_ahead,
    v_requires_approval,
    v_max_reservations_per_user_day
  from public.space_reservation_rules
  where space_id = p_space_id
    and is_active = true;

  v_min_duration_minutes := coalesce(v_min_duration_minutes, 30);
  v_max_duration_minutes := coalesce(v_max_duration_minutes, 120);
  v_slot_interval_minutes := coalesce(v_slot_interval_minutes, 30);
  v_min_notice_minutes := coalesce(v_min_notice_minutes, 30);
  v_max_days_ahead := coalesce(v_max_days_ahead, 30);
  v_requires_approval := coalesce(v_requires_approval, true);
  v_max_reservations_per_user_day := coalesce(v_max_reservations_per_user_day, 2);

  if v_duration_minutes < v_min_duration_minutes then
    raise exception 'La duración mínima es de % minutos.', v_min_duration_minutes;
  end if;

  if v_duration_minutes > v_max_duration_minutes then
    raise exception 'La duración máxima es de % minutos.', v_max_duration_minutes;
  end if;

  if p_start_at < now() + make_interval(mins => v_min_notice_minutes) then
    raise exception 'Debes reservar con al menos % minutos de anticipación.', v_min_notice_minutes;
  end if;

  if p_start_at > now() + make_interval(days => v_max_days_ahead) then
    raise exception 'No puedes reservar con más de % días de anticipación.', v_max_days_ahead;
  end if;

  select count(*)
  into v_reservation_count
  from public.space_reservations
  where user_id = v_user_id
    and start_at >= v_day_start
    and start_at < v_day_end
    and status in ('pending', 'approved');

  if v_reservation_count >= v_max_reservations_per_user_day then
    raise exception 'Ya alcanzaste el máximo de reservas permitidas para ese día.';
  end if;

  if exists (
    select 1
    from public.space_reservations
    where space_id = p_space_id
      and status in ('pending', 'approved')
      and start_at < p_end_at
      and end_at > p_start_at
  ) then
    raise exception 'El espacio ya está reservado en ese horario.';
  end if;

  v_status := case when v_requires_approval then 'pending' else 'approved' end;

  insert into public.space_reservations (
    user_id,
    library_id,
    space_id,
    start_at,
    end_at,
    purpose,
    attendees_count,
    notes,
    status
  ) values (
    v_user_id,
    v_library_id,
    p_space_id,
    p_start_at,
    p_end_at,
    p_purpose,
    p_attendees_count,
    p_notes,
    v_status
  )
  returning id into v_reservation_id;

  return v_reservation_id;
end;
$$;

grant execute on function public.create_space_reservation(uuid, timestamptz, timestamptz, text, integer, text) to authenticated;
