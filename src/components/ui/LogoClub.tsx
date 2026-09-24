import Image from "next/image";

import { cn } from "@/lib/utils";

export type TamanoLogoClub = "sm" | "md" | "lg";

/** Lado del cuadro en píxeles, para el `sizes` de next/image y para el hueco. */
const LADO: Record<TamanoLogoClub, number> = { sm: 40, md: 64, lg: 96 };

export type LogoClubProps = {
  /** Nombre del club, para el texto alternativo y para el hueco. */
  nombre: string;
  /** Ruta dentro del bucket de logos. Null mientras no se haya subido. */
  logoUrl?: string | null;
  /** Color de identidad del club, en #RRGGBB. Tiñe el hueco, no el logo. */
  color?: string | null;
  tamano?: TamanoLogoClub;
  /** Sobre azul profundo el hueco necesita otro contraste. */
  oscuro?: boolean;
  className?: string;
};

/**
 * El espacio del logo de un club.
 *
 * Existe aunque no haya logo, y ese es el punto: reserva el hueco con las
 * mismas medidas, así la página no se recoloca el día que se suban los
 * archivos. Mientras tanto muestra las iniciales sobre el color de identidad
 * del club, que sí está en la base desde la migración 17.
 *
 * El logo NO vive en el repositorio: sale de `club.logo_path`, que el
 * administrador sube desde el panel. Un archivo en `public/` volvería a poner
 * el contenido del cliente dentro del código.
 *
 * Es cuadrado a propósito. Los tres logos que entregó el cliente tienen
 * proporciones distintas —el de la corporación es circular, el de Mastercross
 * apaisado—, y un contenedor cuadrado con `object-contain` los acomoda a
 * todos sin recortarlos.
 */
export function LogoClub({
  nombre,
  logoUrl,
  color,
  tamano = "md",
  oscuro = false,
  className,
}: LogoClubProps) {
  const lado = LADO[tamano];

  if (logoUrl) {
    return (
      <span
        className={cn("relative block shrink-0 overflow-hidden rounded-lg", className)}
        style={{ width: lado, height: lado }}
      >
        <Image
          src={logoUrl}
          alt={`Logo de ${nombre}`}
          fill
          sizes={`${lado}px`}
          className="object-contain"
        />
      </span>
    );
  }

  // Iniciales: la primera letra de las dos primeras palabras. "BMX Club TSW"
  // da "BC", "Habilidades Motrices" da "HM".
  const iniciales = nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg border-2 border-dashed font-display",
        oscuro ? "border-blanco/25 text-blanco/70" : "border-gris-borde text-texto-sec",
        tamano === "sm" ? "text-sm" : tamano === "md" ? "text-lg" : "text-2xl",
        className,
      )}
      style={{
        width: lado,
        height: lado,
        // El color de identidad solo como fondo tenue: sobre él va texto, y
        // los colores de los clubes no están medidos contra texto.
        backgroundColor: color ? `${color}1A` : undefined,
      }}
    >
      {iniciales}
    </span>
  );
}
