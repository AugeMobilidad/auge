/** Íconos SVG en línea (trazo), tamaño heredado del contenedor. */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (props: P) => ({
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const IconResumen = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 13a9 9 0 0 1 18 0" />
    <path d="M12 13l4-3" />
    <path d="M3 13h1M20 13h1M12 4v1" />
  </svg>
);

export const IconDespacho = (p: P) => (
  <svg {...base(p)}>
    <circle cx="5" cy="18" r="2" />
    <circle cx="19" cy="6" r="2" />
    <path d="M7 18h6a4 4 0 0 0 4-4V8" />
  </svg>
);

export const IconIncidencias = (p: P) => (
  <svg {...base(p)}>
    <path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

export const IconDisponibilidad = (p: P) => (
  <svg {...base(p)}>
    <path d="M2 8h11v9H2zM13 11h4l3 3v3h-7z" />
    <circle cx="6" cy="17" r="1.6" />
    <circle cx="17" cy="17" r="1.6" />
  </svg>
);

export const IconControl = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 12h4l2 6 4-14 2 8h6" />
  </svg>
);

export const IconTelegram = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 4 3 11l7 2 2 7 3-5 4 3 2-14Z" />
    <path d="m10 13 11-9" />
  </svg>
);

export const IconSalir = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </svg>
);

export const IconVolver = (p: P) => (
  <svg {...base(p)}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

export const IconMas = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
