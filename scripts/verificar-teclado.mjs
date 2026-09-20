// Recorrido de teclado sobre SelectorDeporte y los modales del laboratorio.
// Usa el protocolo DevTools con Input.dispatchKeyEvent (eventos de teclado
// reales, no sintéticos de JS). Sale 1 si algún paso falla.
// Uso: PUERTO=3311 node scripts/verificar-teclado.mjs
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const PUERTO = process.env.PUERTO ?? "3311";

const ejecutable =
  process.env.CHROME_PATH ??
  (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "chrome");

const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "tsw-teclado-"));

function esperar(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function encenderChrome() {
  const chrome = spawn(
    ejecutable,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      `--user-data-dir=${perfil}`,
      "--remote-debugging-port=9224",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch("http://127.0.0.1:9224/json/version");
      if (res.ok) return chrome;
    } catch {
      /* todavía no */
    }
    await esperar(250);
  }
  throw new Error("Chrome headless no respondió.");
}

async function conectar() {
  const lista = await (await fetch("http://127.0.0.1:9224/json/list")).json();
  const pagina = lista.find((t) => t.type === "page");
  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error("websocket"));
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

  async function pedir(metodo, params = {}) {
    const pedido = ++id;
    ws.send(JSON.stringify({ id: pedido, method: metodo, params }));
    return new Promise((res, rej) => pendientes.set(pedido, { res, rej }));
  }

  return {
    evaluar: (expresion) => pedir("Runtime.evaluate", { expression: expresion, returnByValue: true }).then((r) => r.result?.value),
    tecla: async (key, codigo, vk) => {
      await pedir("Input.dispatchKeyEvent", { type: "keyDown", key, code: codigo, windowsVirtualKeyCode: vk });
      await pedir("Input.dispatchKeyEvent", { type: "keyUp", key, code: codigo, windowsVirtualKeyCode: vk });
    },
    viewport: (ancho, alto) =>
      pedir("Emulation.setDeviceMetricsOverride", { width: ancho, height: alto, deviceScaleFactor: 1, mobile: ancho < 700 }),
    navegar: async (url) => {
      await pedir("Page.enable");
      await pedir("Page.navigate", { url });
    },
    cerrar: () => ws.close(),
  };
}

let fallos = 0;
function paso(nombre, ok) {
  if (!ok) fallos++;
  console.log(`${ok ? "ok" : "FALLO"}  ${nombre}`);
}

const chrome = await encenderChrome();
const pesta = await conectar();

try {
  await pesta.navegar(`http://localhost:${PUERTO}/laboratorio`);
  await esperar(1800);

  // --- SelectorDeporte en móvil (360px): hoja inferior con foco atrapado ----
  await pesta.viewport(360, 800);
  await esperar(300);

  await pesta.evaluar(`
    (function () {
      var boton = document.querySelector('button[aria-haspopup="listbox"]');
      if (!boton) return "SIN BOTON";
      boton.scrollIntoView({ block: "center" });
      boton.focus();
      return "ok";
    })()
  `);
  paso("SelectorDeporte: el botón existe y recibe el foco",
    (await pesta.evaluar(`document.activeElement?.getAttribute("aria-haspopup") === "listbox"`)) === true);

  await pesta.tecla("Enter", "Enter", 13);
  await esperar(500);
  paso("SelectorDeporte (360px): Enter abre la hoja con role=dialog",
    (await pesta.evaluar(`!!document.querySelector('[role="dialog"][aria-label="Elegir deporte"]')`)) === true);

  // Tab cinco veces: el foco debe seguir dentro de la hoja (trampa de foco).
  for (let i = 0; i < 5; i++) {
    await pesta.tecla("Tab", "Tab", 9);
    await esperar(80);
  }
  paso("SelectorDeporte (360px): tras 5 Tab el foco sigue dentro de la hoja",
    (await pesta.evaluar(`
      (function () {
        var hoja = document.querySelector('[role="dialog"][aria-label="Elegir deporte"]');
        return !!hoja && hoja.contains(document.activeElement);
      })()
    `)) === true);

  await pesta.tecla("Escape", "Escape", 27);
  await esperar(500);
  paso("SelectorDeporte (360px): Escape cierra la hoja",
    (await pesta.evaluar(`!document.querySelector('[role="dialog"][aria-label="Elegir deporte"]')`)) === true);
  paso("SelectorDeporte (360px): el foco vuelve al botón al cerrar",
    (await pesta.evaluar(`document.activeElement?.getAttribute("aria-haspopup") === "listbox"`)) === true);

  // --- SelectorDeporte en escritorio (1280px): listbox con flechas ----------
  await pesta.viewport(1280, 900);
  await esperar(300);

  await pesta.evaluar(`
    (function () {
      var boton = document.querySelector('button[aria-haspopup="listbox"]');
      boton.scrollIntoView({ block: "center" });
      boton.focus();
      return "ok";
    })()
  `);
  await pesta.tecla("ArrowDown", "ArrowDown", 40);
  await esperar(400);
  paso("SelectorDeporte (1280px): ↓ abre la lista role=listbox",
    (await pesta.evaluar(`!!document.querySelector('ul[role="listbox"]')`)) === true);

  await pesta.tecla("ArrowDown", "ArrowDown", 40);
  await pesta.tecla("ArrowDown", "ArrowDown", 40);
  await pesta.tecla("Enter", "Enter", 13);
  await esperar(500);
  paso("SelectorDeporte (1280px): ↓↓ + Enter cambia al segundo deporte",
    (await pesta.evaluar(`document.querySelector('button[aria-haspopup="listbox"] .max-w-40').textContent.includes("[DEPORTE 2]")`)) === true);

  // --- Modal del laboratorio: trampa de foco y retorno ----------------------
  await pesta.evaluar(`
    (function () {
      var botones = Array.from(document.querySelectorAll("button"));
      var abrir = botones.find((b) => b.textContent.includes("Abrir diálogo"));
      if (!abrir) return "SIN BOTON";
      abrir.scrollIntoView({ block: "center" });
      abrir.focus();
      abrir.click();
      return "ok";
    })()
  `);
  await esperar(500);
  paso("Modal: se abre con role=dialog y aria-modal",
    (await pesta.evaluar(`
      (function () {
        var d = document.querySelector('[role="dialog"][aria-modal="true"]');
        return !!d && d.textContent.includes("Vaciar el carrito");
      })()
    `)) === true);

  for (let i = 0; i < 8; i++) {
    await pesta.tecla("Tab", "Tab", 9);
    await esperar(60);
  }
  paso("Modal: tras 8 Tab el foco sigue dentro del diálogo",
    (await pesta.evaluar(`
      (function () {
        var d = document.querySelector('[role="dialog"][aria-modal="true"]');
        return !!d && d.contains(document.activeElement);
      })()
    `)) === true);

  await pesta.tecla("Escape", "Escape", 27);
  await esperar(500);
  paso("Modal: Escape lo cierra y el foco vuelve fuera",
    (await pesta.evaluar(`!document.querySelector('[role="dialog"][aria-modal="true"]')`)) === true);
} finally {
  await pesta.cerrar();
  chrome.kill();
  try {
    fs.rmSync(perfil, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
  } catch {
    /* perfil residual */
  }
}

if (fallos > 0) {
  console.log(`FALLO: ${fallos} paso(s) de teclado.`);
  process.exit(1);
}
console.log("RECORRIDO DE TECLADO LIMPIO.");
