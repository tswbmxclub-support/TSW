import "server-only";

import { SITIO } from "@/config/sitio";
import type { Correo } from "./transporte";

/**
 * Plantillas de los correos de acceso. HTML mínimo y en línea: los clientes
 * de correo no cargan hojas de estilo ni fuentes. Colores del sistema de
 * diseño escritos aquí a mano porque el correo no ve las variables CSS.
 *
 * Todo texto que venga de fuera (el nombre) se escapa: un nombre con `<` no
 * puede convertirse en HTML dentro del correo.
 */

function escaparHtml(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function saludo(nombre?: string | null): string {
  const limpio = nombre?.trim();
  return limpio ? `Hola, ${escaparHtml(limpio)}.` : "Hola.";
}

function envolver(titulo: string, parrafos: string[], enlaceCrudo: string, textoBoton: string): string {
  // El enlace lleva `&` entre parámetros: en HTML va como &amp;, también en href.
  const enlace = escaparHtml(enlaceCrudo);
  const cuerpo = parrafos.map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#0B1B33;">${p}</p>`).join("");
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#F2F4F7;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #DCE3EC;border-radius:8px;">
      <tr><td style="padding:24px 24px 8px;">
        <p style="margin:0 0 16px;font-size:22px;font-weight:bold;color:#0B1B33;">${escaparHtml(SITIO.nombre)}</p>
        <h1 style="margin:0 0 16px;font-size:20px;color:#0B1B33;">${titulo}</h1>
        ${cuerpo}
        <p style="margin:24px 0;">
          <a href="${enlace}" style="display:inline-block;padding:14px 22px;background:#D7263D;color:#FFFFFF;text-decoration:none;font-weight:bold;border-radius:6px;font-size:16px;">${textoBoton}</a>
        </p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#46566F;">Si el botón no funciona, copia y pega este enlace en el navegador:<br><span style="word-break:break-all;">${enlace}</span></p>
        <p style="margin:0;font-size:14px;line-height:1.5;color:#46566F;">Este enlace es de un solo uso y vence pronto. Si no pediste este correo, ignóralo: tu cuenta no cambia.</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

/** Enlace para fijar una contraseña nueva (flujo "olvidé mi contraseña"). */
export function correoRestablecerContrasena(opciones: { para: string; enlace: string; nombre?: string | null }): Correo {
  const asunto = `Restablece tu contraseña · ${SITIO.nombre}`;
  return {
    para: opciones.para,
    asunto,
    html: envolver(
      "Restablece tu contraseña",
      [saludo(opciones.nombre), "Recibimos una solicitud para cambiar la contraseña de tu cuenta. Entra con el botón y elige una nueva."],
      opciones.enlace,
      "Elegir contraseña nueva",
    ),
    texto: [
      asunto,
      "",
      "Recibimos una solicitud para cambiar la contraseña de tu cuenta. Abre este enlace y elige una nueva:",
      opciones.enlace,
      "",
      "Este enlace es de un solo uso y vence pronto. Si no pediste este correo, ignóralo.",
    ].join("\n"),
  };
}

/** Invitación a una cuenta recién creada (administrador o titular). */
export function correoInvitacion(opciones: {
  para: string;
  enlace: string;
  nombre?: string | null;
  tipo: "admin" | "usuario";
}): Correo {
  const que = opciones.tipo === "admin" ? "el panel de administración" : "tu cuenta";
  const asunto = `Tu acceso a ${que} · ${SITIO.nombre}`;
  return {
    para: opciones.para,
    asunto,
    html: envolver(
      opciones.tipo === "admin" ? "Te invitaron al panel de administración" : "Te crearon una cuenta",
      [
        saludo(opciones.nombre),
        `${escaparHtml(SITIO.nombreLargo)} te creó una cuenta. Para empezar, elige tu contraseña con el botón.`,
        "La cuenta se activa cuando la administración lo confirme; si al entrar te dice que aún no está activa, es normal.",
      ],
      opciones.enlace,
      "Elegir mi contraseña",
    ),
    texto: [
      asunto,
      "",
      `${SITIO.nombreLargo} te creó una cuenta. Abre este enlace y elige tu contraseña:`,
      opciones.enlace,
      "",
      "La cuenta se activa cuando la administración lo confirme. Este enlace es de un solo uso y vence pronto.",
    ].join("\n"),
  };
}
