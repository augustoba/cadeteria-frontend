// sockjs-client asume un entorno Node (usa `global`) — no existe en el navegador.
(window as unknown as { global: unknown }).global = globalThis;
