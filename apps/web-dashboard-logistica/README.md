# web-dashboard-logistica

**Dashboard web de logística y operaciones** de Auge Movilidad. Panel de control
en tiempo real para despachadores, coordinadores, cumplimiento y centro de
comando. Stack: **Vite + React + TypeScript + Tailwind v4 + `convex/react`**
(suscripciones reactivas con `useQuery`).

## Ejecutar

```sh
# 1. Backend Convex local (desde la raíz del repo)
bunx convex dev --local

# 2. Dependencias del workspace (desde la raíz)
bun install

# 3. Dev server del dashboard
cd apps/web-dashboard-logistica
bun run dev            # http://localhost:5173

# Verificación de tipos
bun run typecheck
```

La URL del backend es **siempre env-driven** vía `VITE_CONVEX_URL`
(ver `.env.example`); nunca se hardcodea un deployment.

## Vistas (todas cableadas al backend)

| Vista | Fuente de datos | Escrituras |
|---|---|---|
| Resumen | `appDashboard.dashboardResumenOperativo` | — |
| Despacho del día | `appDashboard.dashboardTableroDespacho` | asignar · reasignar · cancelar |
| Detalle de servicio | `appDashboard.dashboardDetalleServicio` | confirmar · reasignar · cancelar · incidencia · aprobar liquidación |
| Incidencias abiertas | `appDashboard.dashboardIncidenciasAbiertas` | resolver |
| Disponibilidad | `appDashboard.dashboardCumplimiento` + `dashboardDocumentosProximosVencer` | actualizar documento · programar mantenimiento |
| Control operacional | `analisis.*` + `dashboardLiquidaciones` + `dashboardEventos` | — |

El dashboard **solo** consume las funciones `appDashboard.*` / `analisis.*`
(queries) y las mutations `dashboard*` de `accionesOperativas.ts`. Nunca toca
tablas crudas ni las mutations internas de capa de datos.

## Autenticación (dev-grade, swap-ready)

Todo lo relativo a identidad vive **aislado en `src/auth/`**:

- `session.tsx` — contexto de sesión. Hoy es un **login de desarrollo**: elige un
  actor de la lista de `usuariosSistema` activos (query dev
  `dev/usuarios:listarUsuariosSistema`) y lo guarda en `localStorage`. Expone
  `useActor()`, `useSesion()` y `usePermiso()`.
- `LoginDev.tsx` — selector de usuario a pantalla completa.
- `acciones.ts` — **único** punto donde el frontend conoce el id del actor para
  escrituras: `useAcciones()` inyecta `actorUsuarioSistemaId` en cada mutation
  `dashboard*`. Las vistas llaman `acciones.asignarServicio(...)` sin pasar
  identidad.

### Ruta exacta de migración a auth real (Clerk)

1. **Cliente**: envolver con `ConvexProviderWithClerk` (`convex/react-clerk`) y
   `<ClerkProvider>`; reemplazar `LoginDev` por `<SignIn />`. En `session.tsx`,
   derivar el actor del usuario autenticado (mapear el `subject`/email de Clerk a
   un `usuariosSistema`) en lugar del selector + `localStorage`.
2. **Servidor**: en cada mutation `dashboard*` de `convex/accionesOperativas.ts`,
   **eliminar el argumento `actorUsuarioSistemaId`** y resolver el actor desde
   `ctx.auth.getUserIdentity()` (buscar el `usuariosSistema` por email/subject),
   luego llamar `requerirPermiso` igual que hoy.
3. **Puente**: en `src/auth/acciones.ts`, quitar la inyección de
   `actorUsuarioSistemaId`. **Nada fuera de `src/auth/` cambia** — las vistas ya
   no plumbean identidad.
4. Borrar la query dev `convex/dev/usuarios.ts`.

Como la superficie de datos (`accionesOperativas.ts`) mantiene todas las
escrituras crudas como `internalMutation`, ningún cliente puede saltarse los
chequeos de permiso ni actuar como `ACTOR_SISTEMA`.

## Estructura

```
src/
  main.tsx / App.tsx        arranque + enrutado por hash
  convexClient.ts           ConvexReactClient (VITE_CONVEX_URL)
  auth/                      sesión, login dev y hook de acciones (aislado)
  components/                Shell, primitivos de UI, modales
  views/                    Resumen, Despacho, DetalleServicio, Incidencias,
                            Disponibilidad, ControlOperacional
  lib/                       formato (America/Bogota) y router por hash
```
