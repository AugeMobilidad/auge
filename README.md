# Auge Movilidad — Ontología Operativa

Auge Movilidad es un operador colombiano de transporte especial de pasajeros /
movilidad gestionada. Este repositorio implementa su **ontología operativa**
siguiendo el patrón *Objects, Links, Actions, Interfaces*:

- **Convex** es el dueño de los *Objects* y *Links* (la ontología de datos) y
  de las *Actions* de capa de datos (mutations/queries con reglas de negocio).
- Las *Interfaces* orientadas a aplicación son los módulos por app de Convex
  (`appDashboard.ts`, `appTelegram.ts`): queries con forma de view-model que
  cada app consume a través de la API TypeScript generada por Convex
  (`convex/_generated/api`), sin saltarse la ontología ni tocar tablas crudas.

## Líneas de servicio modeladas

| Línea | Objeto ancla |
|---|---|
| Transporte Puntual | `serviciosTransporte` (tipoOperacion `puntual`) |
| Operación Recurrente | `operaciones` + `rutas` recurrentes |
| Gestión con Gestor Validado | `gestoresValidados` + links `vehiculosGestor` / `conductoresGestor` |
| Movilidad para Grandes Eventos | `eventos` + `operaciones` con `comandoOperativo` |
| Rutas por Comunidad | `comunidades` + `lideresRuta` + `rutas` |

> Tooling: **bun** para todo el workspace JS/TS (workspaces declarados en
> `package.json`), y Convex corriendo **local** (`bunx convex dev --local`).

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

apps/
  web-dashboard-logistica/   ← Dashboard web de logística y operaciones (React),
                               construido en paralelo, consume `appDashboard.ts`
  telegram-operaciones-bot/  ← Bot de Telegram (GramIO) para conductores y
                               comandos ligeros de coordinadores, consume
                               `appTelegram.ts` / `accionesOperativas.ts`
```

## Reglas de arquitectura

1. **Convex es dueño de Objects y Links.** Nadie escribe a las tablas sin pasar
   por las mutations de `accionesOperativas.ts`, que validan transiciones de
   estado y registran auditoría.
2. **Las Actions viven donde corresponde:** workflows de capa de datos en
   Convex; workflows de aplicación/interfaz en cada app TypeScript.
3. **Las apps no saltan la ontología.** El dashboard y el bot consumen los
   módulos `appDashboard` / `appTelegram` de Convex a través de la API
   TypeScript generada (`convex/_generated/api`), nunca tablas crudas.
4. **La historia se preserva en links.** Asignaciones, vinculaciones
   propietario–vehículo, habilitaciones conductor–vehículo y flotas de gestor
   son tablas de link con `fechaDesde`/`fechaHasta`, no campos sobreescribibles.
5. **La identidad del bot viaja como `telegramUserId`.** Nunca un `conductorId`
   provisto por el cliente: Convex resuelve la cuenta vinculada y garantiza
   que un conductor solo actúe sobre sus propios servicios.

## Desarrollo

```sh
# Backend Convex (deployment local, sin nube)
bun install
bunx convex dev --local

# Bot de Telegram (requiere BOT_TOKEN y CONVEX_URL en el entorno)
bun run --cwd apps/telegram-operaciones-bot start
```

Aún **no** existe UI del dashboard: solo contratos y estructura para
construirla sin rediseñar el backend. El bot de Telegram sí es funcional; ver
`apps/telegram-operaciones-bot/README.md` para los comandos y el flujo de
vinculación de cuentas.
