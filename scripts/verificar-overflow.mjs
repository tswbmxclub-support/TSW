// Verificación de overflow horizontal a 360px y 1280px con Chrome headless.
// Habla con el protocolo DevTools por websocket (módulo nativo de Node 22+),
// mide scrollWidth > clientWidth en cada ruta y ancho, y sale 1 si hay
// desbordamiento. Uso: PUERTO=3311 node scripts/verificar-overflow.mjs
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const PUERTO = process.env.PUERTO ?? "3311";
const ANCHOS = [360, 1280];

// Rutas nuevas de la corporación multideporte. /admin/* exige sesión y el
// proveedor Email de Supabase sigue apagado (bloqueante 2), así que el panel
// no es alcanzable sin login; se verifica lo público del alcance nuevo.
const RUTAS = [
  "/laboratorio",
  "/cuenta",
  "/cuenta/acceso",
  "/cuenta/mensualidades",
  "/cuenta/recuperar",
];

const ejecutable =
  process.env.CHROME_PATH ??
  (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "chrome");

const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "tsw-chrome-"));

function esperar(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

/** Enciende Chrome headless con puerto de depuración y espera el endpoint. */
async function encenderChrome() {
  const chrome = spawn(
    ejecutable,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      `--user-data-dir=${perfil}`,
      "--remote-debugging-port=9223",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch("http://127.0.0.1:9223/json/version");
      if (res.ok) return chrome;
    } catch {
      /* todavía no */
    }
    await esperar(250);
  }
  throw new Error("Chrome headless no respondió en el puerto de depuración.");
}

/**
 * Se conecta por websocket a la primera pestaña (el about:blank inicial) y
 * la reutiliza para todas las mediciones: navegar una sola pestaña es más
 * fiable que crear pestañas con /json/new, cuya respuesta cambia de formato
 * entre versiones de Chrome.
 */
async function abrirPestana() {
  const lista = await (await fetch("http://127.0.0.1:9223/json/list")).json();
  const pagina = lista.find((t) => t.type === "page");
  if (!pagina) throw new Error("No hay pestañas en Chrome headless.");

  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error("No se pudo abrir el websocket de DevTools."));
  });

  let id = 0;
  const pendientes = new Map();

  ws.onmessage = (evento) => {
    const mensaje = JSON.parse(evento.data);
    if (mensaje.id && pendientes.has(mensaje.id)) {
      const { res, rej } = pendientes.get(mensaje.id);
      pendientes.delete(mensaje.id);
      mensaje.error ? rej(new Error(mensaje.error.message)) : res(mensaje.result);
    }
  };

  function pedir(metodo, params = {}) {
    const pedido = ++id;
    ws.send(JSON.stringify({ id: pedido, method: metodo, params }));
    return new Promise((res, rej) => pendientes.set(pedido, { res, rej }));
  }

  return {
    async evaluar(expresion) {
      const resultado = await pedir("Runtime.evaluate", { expression: expresion, returnByValue: true });
      return resultado.result?.value;
    },
    async fijarViewport(ancho, alto) {
      await pedir("Emulation.setDeviceMetricsOverride", {
        width: ancho,
        height: alto,
        deviceScaleFactor: 1,
        mobile: ancho < 700,
      });
    },
    async navegar(url) {
      await pedir("Page.enable");
      await pedir("Page.navigate", { url });
    },
    async cerrar() {
      ws.close();
    },
  };
}

let fallos = 0;
const chrome = await encenderChrome();
const pesta = await abrirPestana();

try {
  for (const ancho of ANCHOS) {
    for (const ruta of RUTAS) {
      try {
        // Viewport emulado: 360px es viewport real aunque la ventana del
        // sistema sea mayor.
        await pesta.fijarViewport(ancho, ancho === 360 ? 800 : 900);
        await pesta.navegar(`http://localhost:${PUERTO}${ruta}`);
        await esperar(1500); // carga, hidratación y fuentes

        const exceso = await pesta.evaluar(
          `(function () { var d = document.documentElement; return d.scrollWidth - d.clientWidth; })()`,
        );
        const ok = exceso !== null && exceso <= 0;
        if (!ok) fallos++;
        console.log(`${ancho}px ${ruta} -> ${ok ? "ok" : `DESBORDA ${exceso}px`}`);
      } catch (error) {
        fallos++;
        console.log(`${ancho}px ${ruta} -> ERROR: ${error.message}`);
      }
    }
  }

  await pesta.cerrar();
} finally {
  chrome.kill();
  // Windows retiene archivos del perfil unos segundos tras kill(): la
  // limpieza es mejor esfuerzo y no debe tumbar la verificación.
  try {
    fs.rmSync(perfil, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
  } catch {
    /* perfil residual en %TEMP%, sin efecto en el resultado */
  }
}

if (fallos > 0) {
  console.log(`FALLO: ${fallos} medición(es) con desbordamiento.`);
  process.exit(1);
}
console.log("VERIFICACIÓN LIMPIA: 0 desbordamientos.");
