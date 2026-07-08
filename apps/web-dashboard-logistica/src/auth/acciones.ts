/**
 * Acciones de escritura del dashboard. Cada función delega en una mutation
 * `dashboard*` de Convex e INYECTA `actorUsuarioSistemaId` desde la sesión.
 *
 * Este es el único lugar del frontend que conoce el id del actor para escrituras:
 * las vistas llaman `acciones.asignarServicio(...)` sin pasar identidad. Al
 * migrar a auth real, el backend deja de recibir `actorUsuarioSistemaId` y este
 * módulo elimina la inyección — nada más cambia.
 */
import { useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useActor } from "./session";

type SinActor<T> = Omit<T, "actorUsuarioSistemaId">;
type Args<F extends (args: never) => unknown> = Parameters<F>[0];

export function useAcciones() {
  const actor = useActor();

  const crearServicio = useMutation(api.accionesOperativas.dashboardCrearServicio);
  const asignarServicio = useMutation(api.accionesOperativas.dashboardAsignarServicio);
  const reasignarServicio = useMutation(api.accionesOperativas.dashboardReemplazarAsignacion);
  const confirmarAsignacion = useMutation(api.accionesOperativas.dashboardConfirmarAsignacion);
  const cancelarServicio = useMutation(api.accionesOperativas.dashboardCancelarServicio);
  const registrarIncidencia = useMutation(api.accionesOperativas.dashboardRegistrarIncidencia);
  const resolverIncidencia = useMutation(api.accionesOperativas.dashboardResolverIncidencia);
  const aprobarLiquidacion = useMutation(api.accionesOperativas.dashboardAprobarLiquidacion);
  const actualizarDocumento = useMutation(api.accionesOperativas.dashboardActualizarDocumento);
  const programarMantenimiento = useMutation(
    api.accionesOperativas.dashboardProgramarMantenimiento,
  );
  const verificarCuentaTelegram = useMutation(
    api.accionesOperativas.dashboardVerificarCuentaTelegram,
  );
  const maestroCrearCliente = useMutation(api.accionesOperativas.dashboardMaestroCrearCliente);
  const maestroActualizarCliente = useMutation(
    api.accionesOperativas.dashboardMaestroActualizarCliente,
  );
  const maestroCrearPrograma = useMutation(api.accionesOperativas.dashboardMaestroCrearPrograma);
  const maestroCrearOperacion = useMutation(
    api.accionesOperativas.dashboardMaestroCrearOperacion,
  );
  const maestroActualizarOperacion = useMutation(
    api.accionesOperativas.dashboardMaestroActualizarOperacion,
  );
  const maestroCrearRuta = useMutation(api.accionesOperativas.dashboardMaestroCrearRuta);
  const maestroActualizarRuta = useMutation(
    api.accionesOperativas.dashboardMaestroActualizarRuta,
  );
  const maestroCrearParada = useMutation(api.accionesOperativas.dashboardMaestroCrearParada);
  const maestroActualizarParada = useMutation(
    api.accionesOperativas.dashboardMaestroActualizarParada,
  );

  return useMemo(() => {
    const id = actor.id;
    return {
      crearServicio: (a: SinActor<Args<typeof crearServicio>>) =>
        crearServicio({ ...a, actorUsuarioSistemaId: id }),
      asignarServicio: (a: SinActor<Args<typeof asignarServicio>>) =>
        asignarServicio({ ...a, actorUsuarioSistemaId: id }),
      reasignarServicio: (a: SinActor<Args<typeof reasignarServicio>>) =>
        reasignarServicio({ ...a, actorUsuarioSistemaId: id }),
      confirmarAsignacion: (a: SinActor<Args<typeof confirmarAsignacion>>) =>
        confirmarAsignacion({ ...a, actorUsuarioSistemaId: id }),
      cancelarServicio: (a: SinActor<Args<typeof cancelarServicio>>) =>
        cancelarServicio({ ...a, actorUsuarioSistemaId: id }),
      registrarIncidencia: (a: SinActor<Args<typeof registrarIncidencia>>) =>
        registrarIncidencia({ ...a, actorUsuarioSistemaId: id }),
      resolverIncidencia: (a: SinActor<Args<typeof resolverIncidencia>>) =>
        resolverIncidencia({ ...a, actorUsuarioSistemaId: id }),
      aprobarLiquidacion: (a: SinActor<Args<typeof aprobarLiquidacion>>) =>
        aprobarLiquidacion({ ...a, actorUsuarioSistemaId: id }),
      actualizarDocumento: (a: SinActor<Args<typeof actualizarDocumento>>) =>
        actualizarDocumento({ ...a, actorUsuarioSistemaId: id }),
      programarMantenimiento: (a: SinActor<Args<typeof programarMantenimiento>>) =>
        programarMantenimiento({ ...a, actorUsuarioSistemaId: id }),
      verificarCuentaTelegram: (a: SinActor<Args<typeof verificarCuentaTelegram>>) =>
        verificarCuentaTelegram({ ...a, actorUsuarioSistemaId: id }),
      maestroCrearCliente: (a: SinActor<Args<typeof maestroCrearCliente>>) =>
        maestroCrearCliente({ ...a, actorUsuarioSistemaId: id }),
      maestroActualizarCliente: (a: SinActor<Args<typeof maestroActualizarCliente>>) =>
        maestroActualizarCliente({ ...a, actorUsuarioSistemaId: id }),
      maestroCrearPrograma: (a: SinActor<Args<typeof maestroCrearPrograma>>) =>
        maestroCrearPrograma({ ...a, actorUsuarioSistemaId: id }),
      maestroCrearOperacion: (a: SinActor<Args<typeof maestroCrearOperacion>>) =>
        maestroCrearOperacion({ ...a, actorUsuarioSistemaId: id }),
      maestroActualizarOperacion: (
        a: SinActor<Args<typeof maestroActualizarOperacion>>,
      ) => maestroActualizarOperacion({ ...a, actorUsuarioSistemaId: id }),
      maestroCrearRuta: (a: SinActor<Args<typeof maestroCrearRuta>>) =>
        maestroCrearRuta({ ...a, actorUsuarioSistemaId: id }),
      maestroActualizarRuta: (a: SinActor<Args<typeof maestroActualizarRuta>>) =>
        maestroActualizarRuta({ ...a, actorUsuarioSistemaId: id }),
      maestroCrearParada: (a: SinActor<Args<typeof maestroCrearParada>>) =>
        maestroCrearParada({ ...a, actorUsuarioSistemaId: id }),
      maestroActualizarParada: (a: SinActor<Args<typeof maestroActualizarParada>>) =>
        maestroActualizarParada({ ...a, actorUsuarioSistemaId: id }),
    };
  }, [
    actor.id,
    crearServicio,
    asignarServicio,
    reasignarServicio,
    confirmarAsignacion,
    cancelarServicio,
    registrarIncidencia,
    resolverIncidencia,
    aprobarLiquidacion,
    actualizarDocumento,
    programarMantenimiento,
    verificarCuentaTelegram,
    maestroCrearCliente,
    maestroActualizarCliente,
    maestroCrearPrograma,
    maestroCrearOperacion,
    maestroActualizarOperacion,
    maestroCrearRuta,
    maestroActualizarRuta,
    maestroCrearParada,
    maestroActualizarParada,
  ]);
}
