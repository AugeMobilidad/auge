import { useSesion } from "@/auth/session";
import { LoginDev } from "@/auth/LoginDev";
import { Shell } from "@/components/Shell";
import { useRuta } from "@/lib/rutas";
import { Resumen } from "@/views/Resumen";
import { Despacho } from "@/views/Despacho";
import { DetalleServicio } from "@/views/DetalleServicio";
import { Incidencias } from "@/views/Incidencias";
import { VerificacionTelegram } from "@/views/VerificacionTelegram";
import { Disponibilidad } from "@/views/Disponibilidad";
import { ControlOperacional } from "@/views/ControlOperacional";
import { Maestros } from "@/views/Maestros";

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-2 w-2 animate-ping rounded-full bg-signal" />
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
          Conectando con operaciones…
        </div>
      </div>
    </div>
  );
}

function Enrutador() {
  const ruta = useRuta();
  switch (ruta.vista) {
    case "resumen":
      return <Resumen />;
    case "despacho":
      return <Despacho />;
    case "servicio":
      return <DetalleServicio servicioId={ruta.id} />;
    case "incidencias":
      return <Incidencias />;
    case "telegram":
      return <VerificacionTelegram />;
    case "disponibilidad":
      return <Disponibilidad />;
    case "maestros":
      return <Maestros />;
    case "control":
      return <ControlOperacional />;
  }
}

export function App() {
  const { actor, cargando } = useSesion();
  if (cargando) return <Splash />;
  if (actor === null) return <LoginDev />;
  return (
    <Shell>
      <Enrutador />
    </Shell>
  );
}
