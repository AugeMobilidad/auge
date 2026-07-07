/**
 * Soporte de desarrollo para el login del dashboard — SOLO deployment local.
 *
 * No es auth de producción: expone la lista de usuarios del sistema activos
 * para que el dashboard ofrezca un selector de actor mientras no hay proveedor
 * de identidad real (Clerk). Cuando exista auth real, el dashboard derivará el
 * actor de `ctx.auth.getUserIdentity()` y esta query se elimina.
 *
 * Devuelve, por usuario, el set de permisos efectivos para que la UI pueda
 * ocultar acciones no permitidas (el backend igual las vuelve a validar).
 */
import { v } from "convex/values";
import { query } from "../_generated/server";
import { PERMISOS, usuarioTienePermiso } from "../seguridad";

export const listarUsuariosSistema = query({
  args: {},
  returns: v.array(
    v.object({
      usuarioSistemaId: v.id("usuariosSistema"),
      nombre: v.string(),
      tipoUsuario: v.string(),
      email: v.optional(v.string()),
      permisos: v.array(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const tipos = [
      "operadorLogistico",
      "coordinador",
      "conductor",
      "propietario",
      "gestor",
      "cliente",
      "admin",
      "sistema",
    ] as const;
    const filas = [];
    for (const tipo of tipos) {
      const usuarios = await ctx.db
        .query("usuariosSistema")
        .withIndex("by_tipo_estado", (q) => q.eq("tipoUsuario", tipo).eq("estado", "activo"))
        .collect();
      for (const usuario of usuarios) {
        const permisos: string[] = [];
        for (const permiso of Object.values(PERMISOS)) {
          if (await usuarioTienePermiso(ctx, usuario, permiso)) permisos.push(permiso);
        }
        filas.push({
          usuarioSistemaId: usuario._id,
          nombre: usuario.nombre,
          tipoUsuario: usuario.tipoUsuario,
          email: usuario.email,
          permisos,
        });
      }
    }
    return filas.sort((a, b) => a.nombre.localeCompare(b.nombre));
  },
});
