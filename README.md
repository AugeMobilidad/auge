# Auge Movilidad — Ontología Operativa

Auge Movilidad es un operador colombiano de transporte especial de pasajeros /
movilidad gestionada. Este repositorio implementa su **ontología operativa**
siguiendo el patrón *Objects, Links, Actions, Interfaces*:

- **Convex** es el dueño de los *Objects* y *Links* (la ontología de datos) y
  de las *Actions* de capa de datos (mutations/queries con reglas de negocio).
- **Rust** es el dueño de las *Interfaces* orientadas a aplicación, usando el
  cliente oficial de Convex para Rust más `convex-typegen` para generar tipos
  desde el esquema y las funciones de Convex.

## Líneas de servicio modeladas

| Línea | Objeto ancla |
|---|---|
| Transporte Puntual | `serviciosTransporte` (tipoOperacion `puntual`) |
| Operación Recurrente | `operaciones` + `rutas` recurrentes |
| Gestión con Gestor Validado | `gestoresValidados` + links `vehiculosGestor` / `conductoresGestor` |
| Movilidad para Grandes Eventos | `eventos` + `operaciones` con `comandoOperativo` |
| Rutas por Comunidad | `comunidades` + `lideresRuta` + `rutas` |

> Tooling: **bun** para JS (workspaces declarados en `package.json`),
> **cargo** para Rust, y Convex corriendo **local** (`bunx convex dev --local`).

## Mapa del workspace (quién es dueño de qué)

```txt
convex/                      ← ONTOLOGÍA + ACCIONES DE DATOS (fuente de verdad)
  schema.ts                    Objects y Links con validadores e índices
  operaciones.ts               Queries de negocio con salida interpretable
  accionesOperativas.ts        Mutations / workflows de capa de datos
  analisis.ts                  Analítica de control operacional (red flags)
  appDashboard.ts              Queries con forma de view-model para el dashboard web
  appTelegram.ts               Queries con forma corta para el bot de Telegram
  seguridad.ts                 Resolución de actor y chequeos de autorización
  auditoria.ts                 Registro de auditoría de transiciones importantes

crates/
  auge_interfaces/           ← INTERFACES TIPADAS (Rust, cara a las apps)
                               Tipos generados por convex-typegen + fachadas
                               por perfil (despacho, conductor, gestor, etc.)

apps/
  web-dashboard-logistica/   ← SHELL del futuro dashboard web (sin UI todavía)
  telegram-operaciones-bot/  ← SHELL del futuro bot de Telegram (sin bot real)
```

## Reglas de arquitectura

1. **Convex es dueño de Objects y Links.** Nadie escribe a las tablas sin pasar
   por las mutations de `accionesOperativas.ts`, que validan transiciones de
   estado y registran auditoría.
2. **Las Actions viven donde corresponde:** workflows de capa de datos en
   Convex; workflows de aplicación/interfaz en Rust (`crates/auge_interfaces`).
3. **Las apps no saltan la ontología.** El dashboard y el bot consumen las
   fachadas tipadas de `auge_interfaces` (o los módulos `appDashboard` /
   `appTelegram` de Convex), nunca tablas crudas.
4. **La historia se preserva en links.** Asignaciones, vinculaciones
   propietario–vehículo, habilitaciones conductor–vehículo y flotas de gestor
   son tablas de link con `fechaDesde`/`fechaHasta`, no campos sobreescribibles.
5. **Los tipos Rust se generan, no se duplican a mano.** `build.rs` de
   `auge_interfaces` corre `convex-typegen` contra `convex/`.

## Desarrollo

```sh
# Backend Convex (deployment local, sin nube)
bun install
bunx convex dev --local

# Interfaces Rust
cargo build -p auge_interfaces

# Shell del bot (placeholder compilable)
cargo build -p telegram-operaciones-bot
```

Aún **no** existe UI del dashboard ni integración real con la API de Telegram:
solo contratos, tipos y estructura para construirlos sin rediseñar el backend.
