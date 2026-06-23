# Biblioteca ULV App - Pasos de Deploy V1

## Uso de URL automática de Vercel

Para la Versión 1 no es obligatorio tener dominio personalizado.

El flujo será:

1. Hacer primer deploy en Vercel.
2. Copiar la URL generada por Vercel, por ejemplo:
   `https://biblioteca-ulv-app.vercel.app`
3. Configurar esa URL en `NEXT_PUBLIC_APP_URL`.
4. Hacer redeploy.
5. Configurar esa misma URL en Supabase Auth:
   - Site URL
   - Redirect URLs
6. Probar login y QR.

Más adelante se puede conectar un dominio institucional desde Vercel > Settings > Domains.

## Fallback de URL pública

La app usa `getPublicAppUrl()` en `src/lib/app-url.ts` para resolver la URL pública con este orden:

1. `NEXT_PUBLIC_APP_URL`
2. `VERCEL_PROJECT_PRODUCTION_URL`
3. `VERCEL_URL`
4. `http://localhost:3000`

Esto permite generar enlaces públicos y QR aunque todavía no exista dominio propio.

En producción se recomienda configurar `NEXT_PUBLIC_APP_URL` explícitamente después del primer deploy para asegurar que QR, redirecciones y enlaces públicos usen la URL estable de Vercel.

## Supabase Auth sin dominio propio

Mientras no haya dominio personalizado, usar la URL automática de Vercel:

```text
https://NOMBRE-DEL-PROYECTO.vercel.app
```

Configurar en Supabase:

```text
Authentication > URL Configuration
```

Site URL:

```text
https://NOMBRE-DEL-PROYECTO.vercel.app
```

Redirect URLs:

```text
https://NOMBRE-DEL-PROYECTO.vercel.app/**
https://NOMBRE-DEL-PROYECTO.vercel.app/login
https://NOMBRE-DEL-PROYECTO.vercel.app/mi-cuenta
https://NOMBRE-DEL-PROYECTO.vercel.app/horas
https://NOMBRE-DEL-PROYECTO.vercel.app/horas/qr/**
https://NOMBRE-DEL-PROYECTO.vercel.app/reservas-espacios
https://NOMBRE-DEL-PROYECTO.vercel.app/notificaciones
```

## Pruebas mínimas después del redeploy

- [ ] `/` carga en la URL `vercel.app`.
- [ ] Login funciona con Supabase Auth.
- [ ] Redirección después de login funciona.
- [ ] `/admin/qr` genera un QR con URL `https://NOMBRE-DEL-PROYECTO.vercel.app/horas/qr/TOKEN`.
- [ ] El QR no contiene `localhost`, `127.0.0.1` ni `undefined`.
- [ ] `/horas/qr/[token]` abre correctamente desde un celular.
- [ ] La PWA se puede abrir desde la URL de Vercel.

## Cambio futuro a dominio propio

Cuando exista dominio institucional:

1. Conectar el dominio en Vercel > Settings > Domains.
2. Cambiar `NEXT_PUBLIC_APP_URL` al dominio institucional.
3. Hacer redeploy.
4. Actualizar Site URL y Redirect URLs en Supabase Auth.
5. Probar login, QR y PWA nuevamente.
