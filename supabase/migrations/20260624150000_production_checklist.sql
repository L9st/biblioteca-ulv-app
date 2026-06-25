-- Checklist visual de estado de produccion para Biblioteca ULV App.
-- No toca Koha y no usa secretos en cliente.

create table if not exists public.production_checklist_items (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  section text not null,
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'in_review', 'passed', 'failed', 'not_applicable')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  sort_order integer not null default 0,
  notes text,
  updated_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists production_checklist_items_section_idx on public.production_checklist_items(section, sort_order);
create index if not exists production_checklist_items_status_idx on public.production_checklist_items(status);
create index if not exists production_checklist_items_priority_idx on public.production_checklist_items(priority);

alter table public.production_checklist_items enable row level security;

drop policy if exists "production checklist admins can read" on public.production_checklist_items;
drop policy if exists "production checklist admins can update" on public.production_checklist_items;
drop policy if exists "production checklist superadmins can delete" on public.production_checklist_items;

create policy "production checklist admins can read"
on public.production_checklist_items
for select
to authenticated
using (
  exists (
    select 1 from public.app_users
    where app_users.id = auth.uid()
      and app_users.role in ('admin', 'superadmin')
      and app_users.status = 'active'
  )
);

create policy "production checklist admins can update"
on public.production_checklist_items
for update
to authenticated
using (
  exists (
    select 1 from public.app_users
    where app_users.id = auth.uid()
      and app_users.role in ('admin', 'superadmin')
      and app_users.status = 'active'
  )
)
with check (
  exists (
    select 1 from public.app_users
    where app_users.id = auth.uid()
      and app_users.role in ('admin', 'superadmin')
      and app_users.status = 'active'
  )
);

create policy "production checklist superadmins can delete"
on public.production_checklist_items
for delete
to authenticated
using (
  exists (
    select 1 from public.app_users
    where app_users.id = auth.uid()
      and app_users.role = 'superadmin'
      and app_users.status = 'active'
  )
);

insert into public.production_checklist_items (key, section, title, description, priority, sort_order)
values
  ('variables-app-url', 'Variables', 'URL publica configurada', 'NEXT_PUBLIC_APP_URL apunta al dominio final con HTTPS.', 'critical', 10),
  ('variables-supabase', 'Variables', 'Supabase configurado', 'URL y anon key de Supabase estan configuradas.', 'critical', 20),
  ('security-secrets', 'Seguridad', 'Secretos configurados', 'AUTH_SECRET y QR_TOKEN_SECRET estan definidos en produccion.', 'critical', 30),
  ('security-roles', 'Seguridad', 'Roles administrativos revisados', 'Solo personal autorizado tiene rol admin o superadmin.', 'high', 40),
  ('initial-libraries', 'Datos iniciales', 'Bibliotecas activas cargadas', 'Existe al menos una biblioteca activa.', 'critical', 50),
  ('initial-spaces', 'Datos iniciales', 'Espacios cargados', 'Los espacios publicos de biblioteca estan activos.', 'high', 60),
  ('reservations-rules', 'Reservas', 'Reglas de reserva configuradas', 'Horarios y reglas por espacio reservable estan completas.', 'high', 70),
  ('qr-attendance', 'QR y asistencia', 'QR de asistencia probado', 'Entrada/salida por QR funciona sin exponer tokens.', 'high', 80),
  ('pwa-install', 'PWA', 'PWA instalable', 'Manifest, service worker y pagina offline estan disponibles.', 'medium', 90),
  ('notifications-email', 'Notificaciones', 'Correo y notificaciones revisados', 'La cola de correos no tiene errores criticos.', 'medium', 100),
  ('reports-admin', 'Reportes', 'Reportes administrativos validados', 'Los reportes cargan y exportan informacion necesaria.', 'medium', 110),
  ('catalog-opac', 'Catálogo', 'Catálogo Koha enlazado', 'La busqueda abre el OPAC y registra estadisticas.', 'high', 120),
  ('support-module', 'Soporte', 'Soporte operativo', 'Usuarios pueden crear tickets y staff puede responder.', 'medium', 130),
  ('responsive-mobile', 'Responsive', 'Prueba movil completada', 'Pantallas principales funcionan en celular y PWA instalada.', 'high', 140)
on conflict (key) do nothing;
