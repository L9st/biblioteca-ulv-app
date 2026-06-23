# Security Checklist - Biblioteca ULV App

## 1. Matriz de rutas y permisos

| Ruta | Tipo | Acceso esperado | Datos visibles |
| --- | --- | --- | --- |
| `/` | Pública | Visitantes y usuarios autenticados | Datos públicos, avisos publicados, servicios activos y ayuda publicada |
| `/espacios` | Pública | Visitantes y usuarios autenticados | `library_spaces.status = active` |
| `/espacios/[slug]` | Pública | Visitantes y usuarios autenticados | `library_spaces.status = active` |
| `/servicios` | Pública | Visitantes y usuarios autenticados | `library_services.status = active` |
| `/servicios/[slug]` | Pública | Visitantes y usuarios autenticados | `library_services.status = active` |
| `/avisos` | Pública | Visitantes y usuarios autenticados | `announcements.status = published` y vigentes por fecha |
| `/ayuda` | Pública | Visitantes y usuarios autenticados | `help_articles.status = published` |
| `/ayuda/[slug]` | Pública | Visitantes y usuarios autenticados | `help_articles.status = published` |
| `/horas` | Personal privada | Usuario autenticado | Solo registros propios por `user_id = auth.uid()` |
| `/reservas-espacios` | Personal privada | Usuario autenticado | Solo reservas propias por `user_id = auth.uid()` |
| `/notificaciones` | Personal privada | Usuario autenticado | Solo notificaciones propias por `user_id = auth.uid()` |
| `/mi-cuenta` | Personal privada | Usuario autenticado | Solo perfil propio por `id = auth.uid()` y datos propios |
| `/admin` | Administrativa | `librarian`, `admin`, `superadmin` | Panel administrativo |
| `/admin/qr` | Administrativa | `librarian`, `admin`, `superadmin` | Generación de QR por biblioteca activa |
| `/admin/asistencia` | Administrativa | `librarian`, `admin`, `superadmin` | Registros administrativos de asistencia |
| `/admin/reservas` | Administrativa | `librarian`, `admin`, `superadmin` | Reservas con solicitante, correo, biblioteca, espacio y estado |
| `/admin/espacios` | Administrativa | `librarian`, `admin`, `superadmin` | Gestión de espacios |
| `/admin/reportes` | Administrativa | `librarian`, `admin`, `superadmin` | Reportes administrativos |
| `/admin/avisos` | Administrativa | `librarian`, `admin`, `superadmin` | Gestión de avisos |
| `/admin/servicios` | Administrativa | `librarian`, `admin`, `superadmin` | Gestión de servicios |
| `/admin/ayuda` | Administrativa | `librarian`, `admin`, `superadmin` | Gestión de ayuda |
| `/admin/usuarios` | Administrativa especial | `librarian`, `admin`, `superadmin` | `librarian` solo lectura; `admin` y `superadmin` editan rol/estado |

## 2. Tablas con RLS activado

Estas tablas deben tener RLS activo en Supabase y políticas coherentes con la matriz anterior:

| Tabla | Reglas esperadas |
| --- | --- |
| `app_users` | Usuario lee su perfil; staff autorizado ve usuarios; solo `admin/superadmin` edita rol/estado |
| `libraries` | Lectura pública de bibliotecas activas; administración por staff |
| `library_spaces` | Público lee activos; staff administra |
| `attendance_logs` | Usuario lee solo sus registros; staff lee registros administrativos |
| `space_reservations` | Usuario lee/crea/cancela solo sus reservas; staff revisa todas |
| `notifications` | Usuario lee y actualiza solo sus notificaciones |
| `announcements` | Público lee publicados vigentes; staff administra borradores/publicados/archivados |
| `library_services` | Público lee activos; staff administra activos/inactivos |
| `help_articles` | Público lee publicados; staff administra borradores/publicados/archivados |
| `attendance_qr_tokens` | Generación y validación solo por funciones/RPC seguras |
| `audit_logs` | Escritura por acciones sensibles; lectura restringida a staff autorizado |

## 3. Reglas de privacidad por módulo

| Módulo | Resultado de revisión |
| --- | --- |
| Cuenta `/mi-cuenta` | `account.service.ts` filtra perfil por `.eq("id", userId)` y horas/reservas/notificaciones por `.eq("user_id", userId)` |
| Horas `/horas` | `attendance.service.ts` filtra entrada abierta, historial y resumen por `.eq("user_id", user.id)` |
| Reservas personales `/reservas-espacios` | `reservations.service.ts` usa `supabase.auth.getUser()` y `.eq("user_id", userData.user.id)` para listar reservas propias |
| Notificaciones `/notificaciones` | `notifications.service.ts` filtra por `.eq("user_id", userId)`; el toast y navegación realtime usan `filter: user_id=eq.<id>` |
| QR web `/horas/qr/[token]` | Requiere sesión antes de llamar al RPC de validación; el RPC debe rechazar QR vencido y biblioteca incorrecta |
| Admin QR `/admin/qr` | Corregido para validar rol `librarian/admin/superadmin` antes de cargar bibliotecas o generar QR |
| Admin asistencia `/admin/asistencia` | Corregido para validar rol antes de cargar registros administrativos |
| Admin usuarios `/admin/usuarios` | `librarian` puede ver; edición bloqueada en UI para `librarian`; `admin/superadmin` editan rol/estado |
| Admin reservas `/admin/reservas` | Valida rol antes de cargar; tabla muestra solicitante, correo, biblioteca, espacio y estado |

## 4. Lista de pruebas manuales

### Usuario visitante

Debe poder abrir:

```text
/
/espacios
/servicios
/avisos
/ayuda
```

No debe poder abrir sin login:

```text
/horas
/reservas-espacios
/notificaciones
/mi-cuenta
/admin
```

Resultado esperado: las rutas privadas muestran `Debes iniciar sesión para acceder a esta sección.` o mensaje equivalente de panel administrativo, con botón a login y redirect.

### Usuario student

Debe poder abrir:

```text
/horas
/reservas-espacios
/notificaciones
/mi-cuenta
```

No debe ver:

```text
/admin
```

Resultado esperado: no aparece enlace `Admin` en navegación. Si intenta entrar por URL, ve `No tienes permisos para acceder a esta sección.`

### Usuario librarian

Debe poder abrir:

```text
/admin
/admin/qr
/admin/asistencia
/admin/reservas
/admin/espacios
/admin/reportes
/admin/avisos
/admin/servicios
/admin/ayuda
```

En `/admin/usuarios` puede ver usuarios, pero no editar roles ni estados.

### Usuario admin

Debe poder abrir módulos admin.

En estas rutas solo debe ver sus propios datos personales:

```text
/mi-cuenta
/reservas-espacios
/notificaciones
/horas
```

### Usuario superadmin

Debe tener acceso total administrativo.

En pantallas personales también solo debe ver datos propios.

## 5. Resultado de revisión de service role

| Búsqueda | Resultado |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` en `src` | No encontrado |
| `service_role` en `src` | No encontrado |
| `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE` en `src` | No encontrado |
| `.env.local` | Contiene `SUPABASE_SERVICE_ROLE_KEY`; está cubierto por `.gitignore` (`.env*`) y no se importa en código cliente |

Nota de seguridad: el valor de `SUPABASE_SERVICE_ROLE_KEY` apareció durante la revisión en salida local de terminal. Debe rotarse en Supabase y reemplazarse en `.env.local`.

## 6. Resultado de revisión de rutas admin

| Ruta | Resultado |
| --- | --- |
| `/admin` | Valida `librarian/admin/superadmin` antes de mostrar panel |
| `/admin/qr` | Corregido para validar rol antes de cargar datos o generar QR |
| `/admin/asistencia` | Corregido para validar rol antes de cargar datos administrativos |
| `/admin/reservas` | Valida rol antes de cargar reservas administrativas |
| `/admin/espacios` | Valida rol antes de cargar espacios administrativos |
| `/admin/reportes` | Valida rol antes de cargar reportes |
| `/admin/avisos` | Valida rol antes de cargar avisos administrativos |
| `/admin/servicios` | Valida rol antes de cargar servicios administrativos |
| `/admin/ayuda` | Valida rol antes de cargar artículos administrativos |
| `/admin/usuarios` | Valida rol; `librarian` sin edición; `admin/superadmin` con edición |

## 7. Búsqueda de `any`

Resultado: no se encontró uso de `any` en `src/**/*.ts` ni `src/**/*.tsx` durante la revisión.

## 8. Validación de vistas públicas

| Módulo público | Filtro confirmado |
| --- | --- |
| Espacios | `spaces.service.ts` usa `.eq("status", "active")` |
| Servicios | `library-services.service.ts` usa `.eq("status", "active")` |
| Avisos | `announcements.service.ts` usa `.eq("status", "published")` y fechas `starts_at/ends_at` |
| Ayuda | `help.service.ts` usa `.eq("status", "published")` |

## 9. Cambios aplicados en esta revisión

1. `/admin/qr`: validación de rol antes de cargar bibliotecas y generar QR.
2. `/admin/asistencia`: validación de rol antes de cargar datos administrativos.
3. Redirects de login corregidos en `/admin/qr`, `/admin/asistencia`, `/admin/usuarios` y `/horas`.
4. Mensajes de rutas personales normalizados a `Debes iniciar sesión para acceder a esta sección.`
5. Mensajes de bloqueo admin normalizados a `No tienes permisos para acceder a esta sección.`
