# Biblioteca ULV App - Datos Iniciales V1

Este documento sirve como guía para cargar y confirmar la información base de la Versión 1 de Biblioteca ULV App antes de presentarla o publicarla.

Reglas generales:

- No modificar la base de datos de Koha.
- No guardar datos propios de esta app dentro de Koha.
- Cargar la información en las tablas propias de Supabase/PostgreSQL.
- Confirmar la información real con el personal responsable antes de publicar.

---

## 1. Bibliotecas

Estas bibliotecas deben existir en la tabla `libraries`.

| Nombre | Código | Descripción | Estado | Observaciones |
|---|---|---|---|---|
| Biblioteca Sara E. Ocampo | `SARA_E_OCAMPO` | Biblioteca principal de la Universidad Linda Vista. | Pendiente de confirmar | Confirmar descripción, dirección y datos de contacto. |
| Biblioteca Plantel Tuxtla | `PLANTEL_TUXTLA` | Biblioteca del Plantel Tuxtla. | Pendiente de confirmar | Confirmar descripción, dirección y datos de contacto. |

Campos sugeridos a revisar en `libraries`:

- `code`
- `name`
- `description`
- `address`
- `phone`
- `email`
- `opening_hours`
- `status`

---

## 2. Espacios iniciales

Estos datos se cargan desde `/admin/espacios`.

| Biblioteca | Nombre del espacio | Slug | Descripción | Capacidad | Reservable | Estado | Observaciones |
|---|---|---|---|---|---|---|---|
| Biblioteca Sara E. Ocampo | Sala de lectura | `sala-de-lectura` | Área general para lectura, estudio individual y consulta de materiales. | Pendiente | No | Pendiente de confirmar | Confirmar capacidad real y ubicación interna. |
| Biblioteca Sara E. Ocampo | Área de consulta | `area-de-consulta` | Espacio para consulta de recursos bibliográficos y apoyo académico. | Pendiente | No | Pendiente de confirmar | Confirmar servicios disponibles. |
| Biblioteca Sara E. Ocampo | Cubículos de estudio | `cubiculos-de-estudio` | Espacios para estudio individual o grupal, según disponibilidad. | Pendiente | Sí | Pendiente de confirmar | Confirmar número de cubículos y reglas de reserva. |
| Biblioteca Sara E. Ocampo | Zona de trabajo académico | `zona-de-trabajo-academico` | Área destinada a actividades académicas, estudio colaborativo o trabajo grupal. | Pendiente | Sí | Pendiente de confirmar | Confirmar si requiere autorización previa. |
| Biblioteca Sara E. Ocampo | Área de computadoras | `area-de-computadoras` | Equipos de cómputo disponibles para consulta académica y búsqueda de información. | Pendiente | No | Pendiente de confirmar | Confirmar cantidad de equipos y horarios. |
| Biblioteca Plantel Tuxtla | Sala de lectura | `sala-de-lectura-tuxtla` | Área general para lectura y estudio. | Pendiente | No | Pendiente de confirmar | Confirmar existencia y capacidad. |
| Biblioteca Plantel Tuxtla | Área de consulta | `area-de-consulta-tuxtla` | Espacio para consulta de materiales y orientación bibliográfica. | Pendiente | No | Pendiente de confirmar | Confirmar servicios disponibles. |
| Biblioteca Plantel Tuxtla | Cubículos de estudio | `cubiculos-de-estudio-tuxtla` | Espacios de estudio sujetos a disponibilidad. | Pendiente | Sí | Pendiente de confirmar | Confirmar si el espacio existe y es reservable. |
| Biblioteca Plantel Tuxtla | Zona de trabajo académico | `zona-de-trabajo-academico-tuxtla` | Área para trabajo académico individual o grupal. | Pendiente | Sí | Pendiente de confirmar | Confirmar reglas de uso. |
| Biblioteca Plantel Tuxtla | Área de computadoras | `area-de-computadoras-tuxtla` | Equipos para búsqueda de información y actividades académicas. | Pendiente | No | Pendiente de confirmar | Confirmar cantidad de equipos. |

Datos a confirmar por cada espacio:

- Foto o imagen representativa.
- Capacidad real.
- Ubicación interna.
- Servicios disponibles.
- Normas específicas.
- Si es reservable o solo informativo.

---

## 3. Servicios iniciales

Estos datos se cargan desde `/admin/servicios`.

| Biblioteca | Título | Slug | Resumen | Descripción | Categoría | Audiencia | Requisitos | Horario | Contacto | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| Todas las bibliotecas | Préstamo de libros | `prestamo-de-libros` | Solicita materiales bibliográficos para uso académico. | Servicio de préstamo de materiales disponibles según reglamento de biblioteca. | Préstamo | Estudiantes, docentes y personal | Credencial o identificación institucional vigente | Pendiente | Pendiente | Pendiente de confirmar |
| Todas las bibliotecas | Renovación de materiales | `renovacion-de-materiales` | Extiende el periodo de préstamo si el material está disponible. | Renovación sujeta a políticas de biblioteca y disponibilidad del material. | Préstamo | Usuarios con préstamo activo | No tener adeudos o restricciones | Pendiente | Pendiente | Pendiente de confirmar |
| Todas las bibliotecas | Consulta en sala | `consulta-en-sala` | Consulta materiales dentro de las instalaciones de biblioteca. | Uso de recursos bibliográficos dentro de sala de lectura o áreas autorizadas. | Consulta | Público autorizado | Respetar normas de uso | Pendiente | Pendiente | Pendiente de confirmar |
| Todas las bibliotecas | Orientación bibliográfica | `orientacion-bibliografica` | Recibe apoyo para localizar información académica. | Apoyo del personal bibliotecario para identificar recursos, catálogos y fuentes de información. | Orientación | Estudiantes y docentes | Solicitar apoyo al personal | Pendiente | Pendiente | Pendiente de confirmar |
| Todas las bibliotecas | Uso de computadoras | `uso-de-computadoras` | Utiliza equipos para búsqueda de información y trabajo académico. | Acceso a equipos disponibles en biblioteca para actividades académicas. | Tecnología | Estudiantes, docentes y personal | Uso responsable de los equipos | Pendiente | Pendiente | Pendiente de confirmar |
| Todas las bibliotecas | Capacitación en búsqueda de información | `capacitacion-busqueda-informacion` | Aprende a buscar información académica de forma efectiva. | Sesiones de apoyo sobre búsqueda en catálogos, bases de datos y recursos digitales. | Capacitación | Estudiantes y docentes | Solicitar o inscribirse según disponibilidad | Pendiente | Pendiente | Pendiente de confirmar |
| Todas las bibliotecas | Reserva de espacios | `reserva-de-espacios` | Solicita espacios disponibles para estudio o trabajo académico. | Reserva de espacios bibliotecarios autorizados, sujeto a disponibilidad y aprobación. | Espacios | Usuarios autenticados | Iniciar sesión y justificar la reserva | Pendiente | Pendiente | Pendiente de confirmar |
| Todas las bibliotecas | Apoyo al usuario | `apoyo-al-usuario` | Recibe ayuda sobre servicios de biblioteca o uso de la app. | Orientación general para resolver dudas sobre biblioteca, servicios y aplicación. | Atención | Todos los usuarios | Contactar al personal responsable | Pendiente | Pendiente | Pendiente de confirmar |

---

## 4. Avisos iniciales

Estos datos se cargan desde `/admin/avisos`.

| Biblioteca | Título | Resumen | Contenido | Tipo | Audiencia | Estado | Fecha de inicio | Fecha de finalización |
|---|---|---|---|---|---|---|---|---|
| Todas las bibliotecas | Bienvenida a Biblioteca ULV App | Nueva app de servicios bibliotecarios. | Bienvenido a Biblioteca ULV App, una herramienta para consultar servicios, espacios, asistencia, reservas y ayuda de biblioteca. | General | Todos | Pendiente de publicar | Pendiente | Pendiente |
| Todas las bibliotecas | Horario de atención de biblioteca | Consulta los horarios vigentes. | Los horarios de atención serán publicados y actualizados por el personal de biblioteca. | Informativo | Todos | Pendiente de publicar | Pendiente | Pendiente |
| Todas las bibliotecas | Uso responsable de espacios | Respeta las normas de uso de biblioteca. | Los espacios deben utilizarse para actividades académicas, cuidando mobiliario, equipos y materiales. | Reglamento | Todos | Pendiente de publicar | Pendiente | Pendiente |
| Todas las bibliotecas | Registro de asistencia mediante QR | Registra entrada y salida con QR. | Los usuarios podrán registrar su asistencia escaneando el QR autorizado o siguiendo las indicaciones del personal de biblioteca. | Informativo | Usuarios autenticados | Pendiente de publicar | Pendiente | Pendiente |
| Todas las bibliotecas | Reservas de espacios disponibles | Ya puedes solicitar espacios desde la app. | Los usuarios autenticados podrán solicitar reservas de espacios disponibles, sujetas a aprobación del personal autorizado. | Servicio | Usuarios autenticados | Pendiente de publicar | Pendiente | Pendiente |

---

## 5. Ayuda / Preguntas frecuentes

Estos datos se cargan desde `/admin/ayuda`.

| Biblioteca | Título | Slug | Pregunta | Respuesta | Categoría | Audiencia | Estado | Orden |
|---|---|---|---|---|---|---|---|---|
| Todas las bibliotecas | Registrar entrada | `como-registro-mi-entrada` | ¿Cómo registro mi entrada a la biblioteca? | Inicia sesión en la app, entra a la sección de horas y usa el QR o el método autorizado por biblioteca para registrar tu entrada. | Asistencia | Usuarios autenticados | Pendiente de publicar | 1 |
| Todas las bibliotecas | Registrar salida | `como-registro-mi-salida` | ¿Cómo registro mi salida? | Entra a la sección de horas y registra tu salida con el QR o método autorizado antes de retirarte de la biblioteca. | Asistencia | Usuarios autenticados | Pendiente de publicar | 2 |
| Todas las bibliotecas | Olvidé registrar salida | `que-hago-si-olvide-registrar-mi-salida` | ¿Qué hago si olvidé registrar mi salida? | Contacta al personal de biblioteca para solicitar revisión. Las correcciones deben ser realizadas por personal autorizado. | Asistencia | Usuarios autenticados | Pendiente de publicar | 3 |
| Todas las bibliotecas | Reservar un espacio | `como-reservo-un-espacio` | ¿Cómo reservo un espacio? | Inicia sesión, entra a Reservas de espacios, selecciona el espacio, fecha, horario y envía tu solicitud. | Reservas | Usuarios autenticados | Pendiente de publicar | 4 |
| Todas las bibliotecas | Estado de reserva | `como-reviso-si-mi-reserva-fue-aprobada` | ¿Cómo reviso si mi reserva fue aprobada? | Consulta la sección Mis reservas o tus notificaciones para conocer el estado de tu solicitud. | Reservas | Usuarios autenticados | Pendiente de publicar | 5 |
| Todas las bibliotecas | Horas acumuladas | `como-veo-mis-horas-acumuladas` | ¿Cómo veo mis horas acumuladas? | Entra a la sección Mis horas para revisar tus registros y acumulados del día, semana y mes. | Asistencia | Usuarios autenticados | Pendiente de publicar | 6 |
| Todas las bibliotecas | Leer notificaciones | `como-leo-mis-notificaciones` | ¿Cómo leo mis notificaciones? | Entra a Notificaciones desde el menú o la barra móvil para consultar avisos relacionados con tu actividad. | Cuenta | Usuarios autenticados | Pendiente de publicar | 7 |
| Todas las bibliotecas | Consultar Koha | `como-consulto-el-catalogo-koha` | ¿Cómo consulto el catálogo Koha? | Usa el acceso al catálogo desde la app para abrir el OPAC de Koha y buscar materiales bibliográficos. | Catálogo | Todos | Pendiente de publicar | 8 |
| Todas las bibliotecas | Problemas de inicio de sesión | `que-hago-si-no-puedo-iniciar-sesion` | ¿Qué hago si no puedo iniciar sesión? | Verifica tus datos de acceso. Si el problema continúa, contacta al personal responsable de biblioteca o sistemas. | Cuenta | Todos | Pendiente de publicar | 9 |
| Todas las bibliotecas | Contacto por problemas | `a-quien-contacto-si-tengo-problemas-con-la-app` | ¿A quién contacto si tengo problemas con la app? | Contacta al personal de biblioteca o al responsable técnico definido por la institución. | Soporte | Todos | Pendiente de publicar | 10 |

---

## 6. Horarios

Completar esta sección con horarios oficiales antes de publicar.

### Biblioteca Sara E. Ocampo

```text
Biblioteca: Biblioteca Sara E. Ocampo
Horario de lunes a viernes: Pendiente de confirmar
Horario de sábado: Pendiente de confirmar
Horario especial: Pendiente de confirmar
Observaciones: Confirmar horarios oficiales, periodos vacacionales y horarios especiales por eventos.
```

### Biblioteca Plantel Tuxtla

```text
Biblioteca: Biblioteca Plantel Tuxtla
Horario de lunes a viernes: Pendiente de confirmar
Horario de sábado: Pendiente de confirmar
Horario especial: Pendiente de confirmar
Observaciones: Confirmar horarios oficiales, periodos vacacionales y horarios especiales por eventos.
```

---

## 7. Contactos

Completar esta sección con información oficial antes de publicar.

### Biblioteca Sara E. Ocampo

```text
Biblioteca: Biblioteca Sara E. Ocampo
Responsable: Pendiente de confirmar
Correo: Pendiente de confirmar
Teléfono: Pendiente de confirmar
Ubicación: Pendiente de confirmar
Observaciones: Confirmar datos oficiales autorizados para publicación.
```

### Biblioteca Plantel Tuxtla

```text
Biblioteca: Biblioteca Plantel Tuxtla
Responsable: Pendiente de confirmar
Correo: Pendiente de confirmar
Teléfono: Pendiente de confirmar
Ubicación: Pendiente de confirmar
Observaciones: Confirmar datos oficiales autorizados para publicación.
```

---

## 8. Normas básicas de uso

Lista inicial sugerida para revisar con el personal de biblioteca:

- Registrar entrada al ingresar a la biblioteca.
- Registrar salida al retirarse.
- Usar los espacios reservados en el horario autorizado.
- Cancelar una reserva si no se utilizará.
- Mantener silencio en áreas de estudio.
- Cuidar mobiliario, equipos y materiales.
- Consultar al personal de biblioteca ante cualquier problema.

Normas pendientes de confirmar:

- Tiempo máximo de reserva.
- Número máximo de reservas por usuario.
- Reglas de cancelación.
- Reglas para uso de cubículos.
- Reglas para uso de computadoras.
- Sanciones o restricciones por mal uso.

---

## 9. Datos pendientes de confirmar

| Dato | Responsable | Estado | Observaciones |
|---|---|---|---|
| Horarios oficiales | Pendiente | Pendiente | Confirmar por biblioteca. |
| Contactos oficiales | Pendiente | Pendiente | Confirmar correo, teléfono y responsable. |
| Capacidad real de espacios | Pendiente | Pendiente | Requerido para reservas y reportes. |
| Normas institucionales | Pendiente | Pendiente | Revisar con biblioteca y administración. |
| Servicios disponibles por biblioteca | Pendiente | Pendiente | Confirmar qué servicios aplica a cada sede. |
| Responsables administradores | Pendiente | Pendiente | Definir usuarios con rol `librarian`, `admin` o `superadmin`. |
| Fotografías de espacios | Pendiente | Pendiente | Cargar imágenes reales si están disponibles. |
| URL pública de producción | Pendiente | Pendiente | Necesaria para QR y PWA. |
| Textos finales de avisos | Pendiente | Pendiente | Validar redacción institucional antes de publicar. |
| Catálogo Koha OPAC | Pendiente | Pendiente | Confirmar URL pública segura para `NEXT_PUBLIC_KOHA_OPAC_URL`. |
