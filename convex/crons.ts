/**
 * Trabajos programados del deployment.
 */
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Medianoche en Colombia (UTC-5 fijo) = 05:00 UTC. Se corre a las 00:10 hora
// local para refrescar los snapshots de estado de documentos de cumplimiento.
crons.daily(
  "refrescar estados de documentos de cumplimiento",
  { hourUTC: 5, minuteUTC: 10 },
  internal.accionesOperativas.refrescarEstadosDocumentos,
  {},
);

export default crons;
