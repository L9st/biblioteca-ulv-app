-- Permite que el panel /admin/reservas vea y gestione todas las reservas
-- solo para personal autorizado de la app. No usa service role ni toca Koha.

drop policy if exists "admin roles can read all space reservations" on public.space_reservations;
drop policy if exists "admin roles can update all space reservations" on public.space_reservations;
drop policy if exists "admin roles can read app users for reservations" on public.app_users;

create policy "admin roles can read all space reservations"
on public.space_reservations
for select
to authenticated
using (
  exists (
    select 1
    from public.app_users
    where app_users.id = auth.uid()
      and app_users.role in ('librarian', 'admin', 'superadmin')
      and app_users.status = 'active'
  )
);

create policy "admin roles can update all space reservations"
on public.space_reservations
for update
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

create policy "admin roles can read app users for reservations"
on public.app_users
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.app_users current_user_profile
    where current_user_profile.id = auth.uid()
      and current_user_profile.role in ('librarian', 'admin', 'superadmin')
      and current_user_profile.status = 'active'
  )
);
