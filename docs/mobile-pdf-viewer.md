# Visor PDF interno

El visor anterior usaba `iframe` y desactivaba explícitamente la vista previa en Android. La nueva vista renderiza páginas reales con PDF.js 6.4.299 en canvas, tanto en el detalle como durante la revisión de una carga.

## Implementación y privacidad

- PDF.js se importa dentro de un efecto cliente. Su código gráfico nunca se evalúa durante SSR ni en el extractor `pdf2json`.
- `predev` y `prebuild` copian el worker legacy y los recursos (fuentes, CMaps, WASM e ICC) a `/pdfjs/<versión>/`. El motor y el worker siempre tienen la misma versión; no se usa CDN.
- El PDF se lee desde su URL local de IndexedDB o desde los ejemplos del mismo origen. El visor no envía su contenido a ningún servicio externo.
- Se mantiene IndexedDB sin cambios de esquema, claves o migración de datos.
- Cada documento tiene su worker, destruido al cambiar de archivo o desmontar la vista. Los renderizados pendientes se cancelan. Las URLs temporales se revocan desde el componente que las creó.
- Se renderiza una página por vez y se limita el canvas a 8 millones de píxeles y 4096 píxeles por lado. El zoom permite desplazamiento dentro del visor sin ensanchar la página de la aplicación.

## Controles

Página anterior/siguiente, indicador de página actual/total, zoom de 50% a 250%, Ajustar al ancho, Abrir y Descargar. Se muestran estados de carga y errores en español para documentos ausentes, corruptos o protegidos.

## Reproducir las pruebas

```bash
npm install
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Las pruebas de navegador levantan el build de producción en el puerto 3600. Si hay Chromium instalado en el sistema:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

La suite comprueba píxeles dibujados, worker local real, descarga, recuperación de un PDF de tres páginas desde IndexedDB, navegación, zoom, ancho de 320 px, revocación de URL, terminación del worker y manejo de archivos corruptos/ausentes. Cada prueba se ejecuta en escritorio Chromium y con emulación Pixel 7. Los datos se preparan únicamente dentro de contextos de navegador aislados de prueba.

El favicon ausente de la aplicación original se excluye del registro de errores del visor; no se excluyen errores de PDF.js, worker, canvas ni JavaScript.

## Alcance de la validación

Verificación realizada en esta rama: `npm test` (33 pruebas), `npm run typecheck` y `npm run build` aprobados; 10 pruebas de navegador aprobadas sobre el build de producción con Chromium 151 del sistema, cinco en escritorio y cinco con emulación Pixel 7. Se comprobó que el artefacto de `/api/extract-pdf` no incluye PDF.js ni canvas nativo. No aparecieron errores de worker, SSR o canvas en los casos válidos.

Chromium y la emulación móvil permiten verificar el motor compartido por Chrome y Brave, pero no equivalen a probar Brave con todas sus opciones de Shields ni un Android físico. La comprobación final del despliegue Vercel debe verificar que el worker local y sus recursos se sirven correctamente y repetir la carga de un PDF en los dispositivos de destino.

Este visor muestra el documento; no incorpora OCR, búsqueda textual, selección de texto, firmas o edición del PDF.
