# AGENTS.md

## Proyecto

**Biblioteca ULV App**

Aplicación web progresiva, PWA, para la Biblioteca de la Universidad Linda Vista.
Debe funcionar como sitio web y como app instalable en celular.

La app complementa a Koha ILS, pero no lo reemplaza.

---

## Objetivo principal

Crear una aplicación moderna, móvil y accesible para:

* Buscar recursos bibliográficos.
* Acceder al OPAC de Koha.
* Consultar información de biblioteca.
* Conocer los espacios físicos de la biblioteca.
* Registrar entrada y salida.
* Contar horas de permanencia en biblioteca.
* Registrar uso de espacios.
* Reservar espacios.
* Mostrar avisos.
* Generar reportes para bibliotecarios.

---

## Stack recomendado

El proyecto debe basarse en:

* **Next.js**
* **TypeScript**
* **Tailwind CSS**
* **Supabase**
* **PostgreSQL**
* **Prisma**, si se decide usar ORM
* **PWA Manifest**
* **Service Worker**
* **Vercel** para despliegue inicial gratuito
* Servidor propio en una etapa posterior

---

## Principio de portabilidad

La app debe poder iniciar en servicios gratuitos como Vercel + Supabase, pero debe estar preparada para migrarse posteriormente a un servidor propio.

Por lo tanto:

* No depender excesivamente de funciones exclusivas de Vercel.
* No depender de rutas absolutas de Supabase Storage.
* Usar variables de entorno.
* Separar la lógica de base de datos, autenticación, almacenamiento y Koha.
* Mantener migraciones versionadas.
* Evitar código difícil de mover a Docker o servidor propio.

---

## Arquitectura general

La aplicación debe seguir esta arquitectura:

```text
Usuario
  ↓
Biblioteca ULV App - PWA
  ↓
Backend interno de Next.js
  ↓
Base de datos propia PostgreSQL / Supabase
  ↓
Koha OPAC / Koha API REST
```

La aplicación no debe conectarse directamente a la base de datos interna de Koha.

---

## Reglas importantes sobre Koha

1. No modificar directamente la base de datos de Koha.
2. No guardar tablas propias dentro de la base de datos de Koha.
3. No usar credenciales administrativas de Koha en el frontend.
4. No exponer claves API de Koha en el navegador.
5. Usar la API REST de Koha solamente desde el backend.
6. En la primera versión, usar enlaces seguros al OPAC.
7. La integración avanzada con Koha debe hacerse por etapas.
8. Koha sigue siendo el sistema principal para catalogación, circulación, usuarios y reservas bibliográficas.

---

## Colores institucionales obligatorios

La interfaz debe respetar los colores institucionales:

```css
--color-ulv-blue: #06426a;
--color-ulv-yellow: #fac600;
--color-ulv-bg: #f9f9f9;
```

Uso recomendado:

* **#06426a** para encabezados, barras superiores, títulos importantes, menú inferior y elementos institucionales.
* **#fac600** para botones principales, llamadas a la acción, íconos destacados y estados activos.
* **#f9f9f9** para fondo general de la aplicación.

No usar colores aleatorios si no son necesarios.
Si se requieren colores secundarios, deben ser neutros y mantener coherencia visual.

---

## Identidad visual

La app debe tener una apariencia:

* Limpia.
* Institucional.
* Moderna.
* Móvil primero.
* Fácil de usar.
* Accesible.
* Con tarjetas redondeadas.
* Con botones grandes para celular.
* Con contraste adecuado.
* Con navegación inferior tipo app cuando corresponda.

---

## Diseño responsive

Toda pantalla debe diseñarse primero para celular.

Tamaños mínimos recomendados:

* Botones táctiles cómodos.
* Texto legible.
* Espaciado suficiente.
* Formularios simples.
* Tarjetas verticales.
* Navegación clara.

Evitar interfaces cargadas o con demasiadas columnas en celular.

---

## Estructura recomendada del proyecto

```text
biblioteca-ulv-app/
│
├── README.md
├── AGENTS.md
├── package.json
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── middleware.ts
│
├── public/
│   ├── manifest.json
│   ├── icons/
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   └── images/
│       └── espacios/
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   ├── login/
│   │   ├── catalogo/
│   │   ├── mi-cuenta/
│   │   ├── horas/
│   │   ├── espacios/
│   │   ├── reservas-espacios/
│   │   ├── servicios/
│   │   ├── avisos/
│   │   ├── contacto/
│   │   └── admin/
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── cards/
│   │   ├── forms/
│   │   ├── scanner/
│   │   └── pwa/
│   │
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── database.ts
│   │   ├── storage.ts
│   │   ├── supabase.ts
│   │   ├── koha-api.ts
│   │   ├── permissions.ts
│   │   └── utils.ts
│   │
│   ├── services/
│   │   ├── attendance.service.ts
│   │   ├── spaces.service.ts
│   │   ├── reservations.service.ts
│   │   ├── announcements.service.ts
│   │   ├── users.service.ts
│   │   └── koha.service.ts
│   │
│   ├── modules/
│   │   ├── attendance/
│   │   ├── spaces/
│   │   ├── reservations/
│   │   ├── reports/
│   │   └── notifications/
│   │
│   └── styles/
│       └── globals.css
│
└── docs/
    ├── architecture.md
    ├── database.md
    ├── deployment.md
    └── api.md
```

---

## Rutas principales

```text
/                       Inicio
/catalogo               Catálogo / acceso a Koha
/mi-cuenta              Cuenta del usuario
/horas                  Mis horas
/horas/entrada          Registrar entrada
/horas/salida           Registrar salida
/espacios               Espacios de biblioteca
/espacios/[slug]        Detalle de espacio
/reservas-espacios      Reservar espacios
/servicios              Servicios
/avisos                 Avisos
/contacto               Contacto
/admin                  Panel administrativo
/admin/espacios         Gestión de espacios
/admin/asistencia       Control de asistencia
/admin/reportes         Reportes
/admin/avisos           Gestión de avisos
```

---

## Módulos obligatorios

### 1. Inicio

Debe mostrar accesos rápidos a:

* Buscar en Koha.
* Mi cuenta.
* Registrar entrada.
* Registrar salida.
* Mis horas.
* Espacios de biblioteca.
* Servicios.
* Contacto.

---

### 2. Catálogo

Primera versión:

* Redirigir al OPAC de Koha.
* Permitir búsqueda básica usando URL del OPAC.
* Abrir resultados en una vista compatible con celular.

Versión posterior:

* Consultar API REST de Koha.
* Mostrar disponibilidad.
* Mostrar biblioteca.
* Mostrar signatura.
* Mostrar tipo de material.

---

### 3. Control de horas

Debe permitir:

* Registrar entrada.
* Registrar salida.
* Calcular total de minutos.
* Mostrar horas del día.
* Mostrar horas de la semana.
* Mostrar horas del mes.
* Evitar doble entrada abierta.
* Evitar salida sin entrada.
* Permitir corrección solo a bibliotecarios autorizados.

Estados permitidos:

```text
open
closed
corrected
cancelled
```

---

### 4. Espacios de biblioteca

Debe permitir:

* Ver lista de espacios.
* Ver foto del espacio.
* Ver descripción.
* Ver servicios.
* Ver normas.
* Ver ubicación interna.
* Registrar uso del espacio.
* Generar QR para cada espacio.
* Marcar si el espacio es reservable.

Ejemplos de espacios:

* Recepción.
* Sala de lectura.
* Área de computadoras.
* Cubículos.
* Estantería abierta.
* Área de tesis.
* Hemeroteca.
* Biblioteca virtual.
* Préstamo y devolución.
* Zona de trabajo grupal.

---

### 5. Reserva de espacios

Debe permitir:

* Seleccionar espacio.
* Seleccionar fecha.
* Seleccionar horario.
* Crear reserva.
* Cancelar reserva.
* Evitar reservas solapadas.
* Mostrar estado de la reserva.

Estados permitidos:

```text
pending
confirmed
cancelled
completed
expired
```

---

### 6. Avisos

Debe permitir:

* Ver avisos publicados.
* Filtrar por biblioteca.
* Publicar avisos desde el panel administrativo.
* Definir fecha de publicación.
* Definir fecha de expiración.
* Definir público objetivo.

---

### 7. Panel administrativo

Debe permitir al personal autorizado:

* Ver usuarios dentro de la biblioteca.
* Ver registros abiertos.
* Corregir entradas y salidas.
* Administrar espacios.
* Subir fotos.
* Generar QR.
* Ver reportes.
* Exportar información.
* Publicar avisos.

---

## Base de datos

La app debe usar una base de datos propia en PostgreSQL.

Tablas sugeridas:

```text
app_users
libraries
library_spaces
attendance_logs
space_usage_logs
space_reservations
announcements
audit_logs
```

No crear estas tablas dentro de la base de Koha.

---

## Modelo conceptual

### app_users

Usuarios de la aplicación.

Campos mínimos:

```text
id
koha_borrowernumber
name
email
role
library_code
status
created_at
updated_at
```

Roles:

```text
student
teacher
librarian
admin
superadmin
```

---

### libraries

Bibliotecas o sedes.

Campos mínimos:

```text
id
code
name
description
address
phone
email
opening_hours
status
created_at
updated_at
```

Ejemplos:

```text
SARA_E_OCAMPO
PLANTEL_TUXTLA
```

---

### library_spaces

Espacios físicos.

Campos mínimos:

```text
id
library_id
name
slug
description
services
rules
location_hint
capacity
image_url
qr_token
is_reservable
status
created_at
updated_at
```

---

### attendance_logs

Registro general de entrada y salida.

Campos mínimos:

```text
id
user_id
library_id
check_in_at
check_out_at
total_minutes
status
source
notes
created_at
updated_at
```

---

### space_usage_logs

Registro de uso de espacios.

Campos mínimos:

```text
id
user_id
library_id
space_id
started_at
ended_at
total_minutes
status
notes
created_at
updated_at
```

---

### space_reservations

Reservas de espacios.

Campos mínimos:

```text
id
user_id
library_id
space_id
start_at
end_at
status
purpose
created_at
updated_at
```

---

### announcements

Avisos y comunicados.

Campos mínimos:

```text
id
title
content
library_id
audience
published_at
expires_at
status
created_by
created_at
updated_at
```

---

### audit_logs

Auditoría de acciones importantes.

Campos mínimos:

```text
id
user_id
action
entity_type
entity_id
old_value
new_value
ip_address
user_agent
created_at
```

---

## Variables de entorno

Usar `.env.example`.

```env
NEXT_PUBLIC_APP_NAME="Biblioteca ULV App"
NEXT_PUBLIC_APP_URL="https://biblioteca-ulv-app.vercel.app"

NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""

DATABASE_URL=""

KOHA_OPAC_URL=""
KOHA_STAFF_URL=""
KOHA_API_URL=""
KOHA_API_CLIENT_ID=""
KOHA_API_CLIENT_SECRET=""

AUTH_SECRET=""
QR_TOKEN_SECRET=""

STORAGE_PUBLIC_URL=""
UPLOAD_MAX_SIZE_MB="5"
```

Regla obligatoria:

```text
SUPABASE_SERVICE_ROLE_KEY nunca debe usarse en componentes del cliente.
```

---

## Reglas de autenticación

La app puede iniciar con Supabase Auth.

Debe estar preparada para una integración futura con:

* Google institucional.
* CAS.
* LDAP.
* Autenticación conectada con Koha.

No guardar contraseñas de Koha en texto plano.

---

## Reglas de seguridad

1. Usar HTTPS en producción.
2. Validar todos los formularios.
3. No exponer secretos en el frontend.
4. No guardar contraseñas en texto plano.
5. No usar usuarios administrativos para integraciones simples.
6. Registrar auditoría en acciones sensibles.
7. Proteger datos personales.
8. Limitar acceso al panel administrativo por rol.
9. Revisar permisos antes de mostrar datos.
10. No permitir edición de horas sin dejar motivo.

---

## Reglas para QR

Los QR pueden usarse para:

* Entrada a biblioteca.
* Salida de biblioteca.
* Uso de espacios.
* Identificación de espacios.
* Confirmación de reservas.

Reglas:

1. No guardar datos sensibles dentro del QR.
2. Usar tokens.
3. Asociar QR con biblioteca o espacio.
4. Registrar fecha, hora, usuario e IP.
5. Preferir QR dinámico para asistencia oficial.
6. Permitir QR fijo solo para identificación de espacios no críticos.

---

## Reglas de UI

La interfaz debe usar componentes reutilizables.

Componentes recomendados:

```text
Button
Card
Input
Select
Textarea
Badge
Modal
Drawer
BottomNav
Header
PageTitle
StatCard
EmptyState
LoadingState
QRCodeCard
SpaceCard
AttendanceCard
```

---

## Tailwind sugerido

Configurar colores institucionales en `tailwind.config.ts`:

```ts
theme: {
  extend: {
    colors: {
      ulv: {
        blue: "#06426a",
        yellow: "#fac600",
        bg: "#f9f9f9",
      },
    },
  },
}
```

Uso esperado:

```tsx
className="bg-ulv-blue text-white"
className="bg-ulv-yellow text-ulv-blue"
className="bg-ulv-bg"
```

---

## Estilo visual

Usar:

* Fondos claros.
* Tarjetas blancas.
* Bordes suaves.
* Sombras ligeras.
* Botones redondeados.
* Íconos simples.
* Navegación inferior en móvil.
* Encabezado azul institucional.
* Botones principales en amarillo institucional.

Evitar:

* Interfaces oscuras por defecto.
* Colores ajenos a la identidad ULV.
* Textos muy pequeños.
* Botones difíciles de tocar.
* Formularios extensos sin división.

---

## PWA

La app debe incluir:

```text
manifest.json
icon-192.png
icon-512.png
theme_color #06426a
background_color #f9f9f9
display standalone
name Biblioteca ULV
short_name Biblioteca ULV
```

Ejemplo:

```json
{
  "name": "Biblioteca ULV",
  "short_name": "Biblioteca ULV",
  "description": "Aplicación de servicios bibliotecarios de la Universidad Linda Vista",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f9f9f9",
  "theme_color": "#06426a",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

## Reportes recomendados

El panel debe considerar reportes de:

* Horas por usuario.
* Horas por biblioteca.
* Horas por espacio.
* Asistencia diaria.
* Asistencia semanal.
* Asistencia mensual.
* Usuarios dentro de biblioteca.
* Espacios más usados.
* Horarios con mayor demanda.
* Reservas de espacios.
* Exportación CSV.

---

## Código

Reglas de código:

1. Usar TypeScript.
2. Evitar `any` salvo caso justificado.
3. Separar componentes de lógica.
4. Usar servicios para operaciones de datos.
5. Usar validaciones antes de insertar datos.
6. Mantener funciones pequeñas.
7. Nombrar variables de forma clara.
8. Usar nombres en inglés para código y español para textos visibles.
9. Evitar duplicación.
10. Documentar funciones críticas.

---

## Textos visibles

Los textos visibles para el usuario deben estar en español.

Ejemplos:

```text
Buscar libros
Mi cuenta
Registrar entrada
Registrar salida
Mis horas
Espacios de biblioteca
Servicios
Contacto
Panel bibliotecario
```

---

## Buenas prácticas para desarrollo

1. Crear primero el diseño móvil.
2. Implementar una función a la vez.
3. Probar cada módulo antes de avanzar.
4. No conectar Koha API hasta que la app básica funcione.
5. No guardar datos oficiales sin validación.
6. Documentar cambios importantes.
7. Usar Git desde el inicio.
8. Mantener `.env.example` actualizado.
9. No subir `.env` al repositorio.
10. Hacer backups antes de migraciones.

---

## Roadmap recomendado

### Fase 1

* Configuración inicial.
* Diseño institucional.
* PWA básica.
* Inicio.
* Servicios.
* Contacto.
* Espacios de biblioteca.

### Fase 2

* Login.
* Registro de entrada.
* Registro de salida.
* Mis horas.
* Panel básico de asistencia.

### Fase 3

* QR por biblioteca.
* QR por espacio.
* Uso de espacios.
* Reportes básicos.

### Fase 4

* Reserva de espacios.
* Avisos.
* Administración de espacios.
* Exportación de reportes.

### Fase 5

* Integración avanzada con Koha API.
* Préstamos.
* Reservas.
* Disponibilidad.
* Credencial digital.

---

## No hacer

No hacer lo siguiente:

```text
No conectar frontend directamente a la base de datos de Koha.
No guardar claves secretas en componentes cliente.
No usar colores fuera de la identidad institucional sin motivo.
No crear funciones destructivas sobre Koha.
No eliminar registros sin auditoría.
No permitir edición de horas sin control.
No hacer la app solo para escritorio.
No bloquear la migración futura a servidor propio.
```

---

## Resultado esperado

Cada agente o herramienta de vibe coding debe generar código que:

* Respete la arquitectura definida.
* Use los colores institucionales.
* Sea portable.
* Sea seguro.
* Sea móvil primero.
* Sea claro para usuarios de biblioteca.
* No afecte la base de datos de Koha.
* Permita crecer por fases.

---

## Resumen de decisión técnica

La aplicación inicia con:

```text
Next.js + TypeScript + Tailwind CSS + Supabase + PostgreSQL
```

Despliegue inicial:

```text
Vercel + Supabase
```

Migración futura:

```text
Servidor propio + Docker + PostgreSQL
```

Koha se mantiene como sistema principal y la app funciona como capa móvil, informativa y de control de uso de biblioteca.
