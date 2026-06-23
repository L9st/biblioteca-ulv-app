# Biblioteca ULV App - Checklist de Versión 1

## 1. Objetivo de la Versión 1

La Versión 1 de Biblioteca ULV App tiene como objetivo ofrecer una aplicación web/PWA para apoyar la gestión de servicios bibliotecarios de la Universidad Linda Vista, sin modificar la base de datos de Koha.

La app permite a los usuarios consultar espacios, registrar asistencia, reservar espacios, recibir notificaciones, consultar avisos, servicios y ayuda; además, permite al personal autorizado administrar información desde un panel interno.

---

## 2. Alcance de la Versión 1

La Versión 1 incluye los siguientes módulos:

- Dashboard principal
- Menú global y barra móvil
- Mi cuenta
- Registro de horas
- QR de asistencia
- Reservas de espacios
- Notificaciones
- Espacios
- Avisos
- Servicios
- Ayuda / Preguntas frecuentes
- Panel administrativo
- Reportes
- Usuarios
- Seguridad y permisos por rol

---

## 3. Rutas públicas

Estas rutas pueden ser vistas por visitantes y usuarios autenticados:

| Ruta | Descripción | Estado |
|---|---|---|
| `/` | Dashboard principal | Pendiente de prueba |
| `/espacios` | Lista pública de espacios | Pendiente de prueba |
| `/espacios/[slug]` | Detalle de espacio | Pendiente de prueba |
| `/servicios` | Lista pública de servicios | Pendiente de prueba |
| `/servicios/[slug]` | Detalle de servicio | Pendiente de prueba |
| `/avisos` | Avisos publicados | Pendiente de prueba |
| `/ayuda` | Centro de ayuda | Pendiente de prueba |
| `/ayuda/[slug]` | Detalle de ayuda | Pendiente de prueba |

---

## 4. Rutas privadas de usuario

Estas rutas requieren sesión:

| Ruta | Descripción | Estado |
|---|---|---|
| `/mi-cuenta` | Perfil personal del usuario | Pendiente de prueba |
| `/horas` | Registro y consulta de horas propias | Pendiente de prueba |
| `/reservas-espacios` | Reservas propias del usuario | Pendiente de prueba |
| `/notificaciones` | Notificaciones propias | Pendiente de prueba |
| `/horas/qr/[token]` | Registro de asistencia por QR | Pendiente de prueba |

Regla obligatoria:

- El usuario solo debe ver sus propios datos.
- Aunque sea admin o superadmin, en pantallas personales solo debe ver su propia información.

---

## 5. Rutas administrativas

Estas rutas requieren rol:

- `librarian`
- `admin`
- `superadmin`

| Ruta | Descripción | Estado |
|---|---|---|
| `/admin` | Panel administrativo principal | Pendiente de prueba |
| `/admin/qr` | Generación de QR de asistencia | Pendiente de prueba |
| `/admin/asistencia` | Revisión de asistencia | Pendiente de prueba |
| `/admin/reservas` | Gestión de reservas | Pendiente de prueba |
| `/admin/usuarios` | Gestión de usuarios | Pendiente de prueba |
| `/admin/espacios` | Gestión de espacios | Pendiente de prueba |
| `/admin/reportes` | Reportes de asistencia | Pendiente de prueba |
| `/admin/avisos` | Gestión de avisos | Pendiente de prueba |
| `/admin/servicios` | Gestión de servicios | Pendiente de prueba |
| `/admin/ayuda` | Gestión de ayuda y preguntas frecuentes | Pendiente de prueba |

---

## 6. Roles y permisos esperados

| Rol | Permisos esperados |
|---|---|
| Visitante | Ver rutas públicas |
| student | Ver rutas públicas y sus datos personales |
| librarian | Acceso administrativo operativo, sin edición avanzada de roles si aplica |
| admin | Acceso administrativo y gestión de usuarios |
| superadmin | Acceso administrativo completo |

Reglas obligatorias:

- `student` no debe ver enlace Admin.
- Visitante no debe acceder a rutas privadas.
- Staff sí puede acceder al panel administrativo.
- Las rutas personales siempre deben filtrar por usuario actual.

---

## 7. Tablas principales de Supabase

La app usa tablas propias en Supabase/PostgreSQL, separadas de Koha.

Tablas principales:

- `app_users`
- `libraries`
- `library_spaces`
- `attendance_logs`
- `attendance_qr_tokens`
- `attendance_qr_attempts`
- `space_reservations`
- `notifications`
- `announcements`
- `library_services`
- `help_articles`

Regla obligatoria:

- Todas las tablas sensibles deben tener RLS activado.
- No se debe usar la base de datos de Koha para guardar datos de esta app.

---

## 8. Checklist de seguridad

- [ ] RLS activado en tablas principales.
- [ ] Políticas RLS revisadas.
- [ ] No se usa `SUPABASE_SERVICE_ROLE_KEY` en cliente.
- [ ] No existe `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Las rutas personales filtran por usuario actual.
- [ ] Las rutas admin validan rol antes de mostrar datos.
- [ ] El enlace Admin no aparece para estudiantes.
- [ ] Las notificaciones muestran solo datos del usuario actual.
- [ ] Las reservas personales muestran solo reservas propias.
- [ ] La asistencia personal muestra solo registros propios.
- [ ] Las rutas públicas muestran solo datos activos o publicados.

---

## 9. Checklist responsive

- [ ] Menú global no está saturado.
- [ ] Barra móvil tiene máximo 5 accesos.
- [ ] Barra móvil no tapa botones.
- [ ] Dashboard principal no está saturado.
- [ ] Secciones del dashboard están agrupadas correctamente.
- [ ] `/reservas-espacios` no tiene scroll horizontal en celular.
- [ ] Selectores y fechas se adaptan en celular.
- [ ] Tablas administrativas son responsive.
- [ ] Formularios se ven correctamente en celular.
- [ ] PWA se puede usar en celular.

---

## 10. Pruebas con usuario visitante

Probar sin iniciar sesión:

- [ ] Puede abrir `/`.
- [ ] Puede abrir `/espacios`.
- [ ] Puede abrir `/servicios`.
- [ ] Puede abrir `/avisos`.
- [ ] Puede abrir `/ayuda`.
- [ ] No puede abrir `/mi-cuenta`.
- [ ] No puede abrir `/horas`.
- [ ] No puede abrir `/reservas-espacios`.
- [ ] No puede abrir `/notificaciones`.
- [ ] No puede abrir `/admin`.

---

## 11. Pruebas con usuario student

Probar con usuario normal:

- [ ] Puede iniciar sesión.
- [ ] Puede abrir `/mi-cuenta`.
- [ ] Puede abrir `/horas`.
- [ ] Puede abrir `/reservas-espacios`.
- [ ] Puede abrir `/notificaciones`.
- [ ] Puede ver solo sus propias reservas.
- [ ] Puede ver solo sus propias horas.
- [ ] Puede ver solo sus propias notificaciones.
- [ ] No ve enlace Admin.
- [ ] No puede abrir `/admin`.

---

## 12. Pruebas con usuario librarian

Probar con bibliotecario:

- [ ] Puede abrir `/admin`.
- [ ] Puede abrir `/admin/qr`.
- [ ] Puede generar QR.
- [ ] Puede revisar asistencia.
- [ ] Puede revisar reservas.
- [ ] Puede aprobar o rechazar reservas.
- [ ] Puede administrar espacios.
- [ ] Puede administrar avisos.
- [ ] Puede administrar servicios.
- [ ] Puede administrar ayuda.
- [ ] Puede ver reportes.
- [ ] En `/mi-cuenta` ve solo sus propios datos.

---

## 13. Pruebas con usuario admin

Probar con administrador:

- [ ] Puede abrir todo el panel admin.
- [ ] Puede gestionar usuarios.
- [ ] Puede cambiar rol o estado según reglas definidas.
- [ ] Puede revisar reportes.
- [ ] Puede aprobar reservas.
- [ ] Puede administrar contenidos.
- [ ] En `/mi-cuenta` ve solo sus propios datos.
- [ ] En `/reservas-espacios` ve solo sus propias reservas personales.

---

## 14. Pruebas de flujo principal

Flujos mínimos de V1:

- [ ] Usuario inicia sesión.
- [ ] Usuario registra entrada.
- [ ] Usuario registra salida.
- [ ] Admin genera QR.
- [ ] Usuario registra asistencia por QR.
- [ ] Usuario crea reserva.
- [ ] Admin aprueba reserva.
- [ ] Usuario recibe notificación.
- [ ] Usuario lee notificación.
- [ ] Admin crea aviso.
- [ ] Admin crea servicio.
- [ ] Admin crea artículo de ayuda.
- [ ] Usuario consulta ayuda.
- [ ] Admin exporta reporte.

---

## 15. Variables de entorno necesarias

Revisar que existan:

```env
NEXT_PUBLIC_APP_NAME=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_KOHA_OPAC_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
AUTH_SECRET=
QR_TOKEN_SECRET=
```

Reglas:

- `SUPABASE_SERVICE_ROLE_KEY` nunca debe usarse en cliente.
- Solo las variables con prefijo `NEXT_PUBLIC_` pueden exponerse al navegador.
- `NEXT_PUBLIC_APP_URL` debe apuntar a la URL real de producción antes de usar QR.

---

## 16. Datos reales pendientes

Antes de publicar, cargar datos reales:

- [ ] Bibliotecas activas.
- [ ] Espacios reales.
- [ ] Servicios reales.
- [ ] Preguntas frecuentes reales.
- [ ] Avisos iniciales.
- [ ] Horarios reales.
- [ ] Contactos reales.
- [ ] Normas básicas de uso.

---

## 17. Errores conocidos

Registrar aquí cualquier error pendiente:

| Fecha | Módulo | Error | Prioridad | Estado |
| ----- | ------ | ----- | --------- | ------ |
|       |        |       |           |        |

---

## 18. Pendientes para Versión 2

Posibles mejoras para V2:

- Escáner QR interno desde la PWA.
- Código corto para asistencia.
- Calendario visual de reservas.
- Integración más profunda con API REST de Koha.
- Notificaciones por correo.
- Auditoría avanzada.
- Panel estadístico con gráficos.
- Mejoras PWA offline.
- Control por ubicación o red institucional.
- Exportación PDF de reportes.
- Manual integrado dentro de la app.

---

## 19. Criterio de cierre de V1

La Versión 1 puede considerarse lista cuando:

- [ ] Todas las rutas principales cargan sin error.
- [ ] Los permisos funcionan correctamente.
- [ ] Las rutas personales muestran solo datos propios.
- [ ] Las rutas administrativas están protegidas.
- [ ] La vista móvil funciona correctamente.
- [ ] Se probaron al menos 3 roles.
- [ ] Se cargaron datos reales mínimos.
- [ ] El QR funciona con URL real.
- [ ] Los reportes exportan correctamente.
- [ ] El personal responsable validó el flujo principal.

---

## 20. Estado general

Estado actual de V1:

```text
En revisión final
```

Responsable técnico:

```text
Pendiente
```

Fecha de revisión:

```text
Pendiente
```
