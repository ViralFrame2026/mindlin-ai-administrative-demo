# Fase 3: UX administrativa profesional

## Auditoría previa y alcance

Base: main 496df72. Se revisaron App Router, shell, dashboard, listados, historial, CSV, workflow, operaciones transaccionales, tests y merges recientes de integridad administrativa y ejemplos PDF.

Prioridad alta: CSV escapaba comillas pero permitía fórmulas en campos de texto. Se agrega neutralización para prefijos =, +, -, @, incluidos espacios/control iniciales; no se alteran datos persistidos. Se prueba el archivo efectivamente descargado. No equivale a certificar todos los lectores de planillas.

Prioridad media: búsqueda no encontraba 0004-00001842; filtros no informaban selección accesible; el menú móvil no atrapaba foco ni respondía a Escape; el usuario demo se ocultaba; navegación inferior podía cubrir contenido; trazabilidad y exportaciones mostraban códigos internos. Se incorporan búsqueda normalizada, estados/acciones en español, diálogo modal nativo y foco visible. Los identificadores y eventos históricos se conservan; descripciones antiguas se traducen al presentarlas.

Prioridad baja: botón de notificaciones sin función real; gráfico de distribución vacío parecía indicar rechazo. El acceso conduce al historial y el anillo vacío es neutral. La evolución temporal sigue identificada como ilustrativa; no se crean series históricas falsas. Las métricas de importes, cola y aprobadas conservan sus fórmulas.

No se cambian PDFs, extracción, modelo IndexedDB, revisión de conflictos, reglas, snapshot de retenciones ni permisos. Se conserva el rechazo y su motivo visible. Solo las descripciones de nuevos eventos y errores de transición se expresan en español; no se migra ni elimina historial.

## Verificación y límites

Los tests existentes cubren CUIT, matemática, aprobación/rechazo, duplicados, reglas congeladas, concurrencia, migración y recargas. Se agregan tests de CSV, búsqueda y textos, además de E2E del menú, filtros, ancho de 320px y descargas CSV.

Ejecutar npm test, npm run typecheck, npm run build y npm run test:e2e (Chromium). El perfil Android es emulado; no se afirma prueba en Android físico, Brave o Vercel, ni certificación WCAG. El diálogo nativo requiere un navegador moderno compatible con dialog/showModal.

Persisten las limitaciones: demo local, usuario fijo, retenciones ilustrativas, sin OCR, sin auditoría inmutable ni backend empresarial. Se mantienen las protecciones administrativas existentes; esto no es un sistema contable certificado.

## Resultados finales — 9 de octubre de 2026

- npm test: 93/93, ocho archivos, aprobados.
- npm run typecheck: aprobado.
- npm run build: aprobado, Node.js 24.
- Suite E2E completa: 44/44, 22 recorridos en escritorio y 22 con Pixel 7 emulado, aprobados sobre el build de producción.
- Búsqueda y filtros a 320 px sin desbordamiento; Tab/Escape/foco del diálogo; CSV real descargado con fórmulas neutralizadas y acciones en español; métricas de la demo verificadas.
- Regresiones administrativas y del visor: aprobación explícita, rechazo justificado, duplicados, concurrencia, recargas, conservación de retenciones, PDFs originales y canvas, aprobadas.
- Diff verificado: no se cambiaron almacenamiento/store, matemática, reglas, extractor, visor PDF.js ni PDFs originales. No se eliminaron datos/historial.
- Los primeros E2E detectaron foco que salía del diálogo al final del recorrido Tab; se corrigió explícitamente y la suite final pasa. No se desactivaron pruebas ni validaciones.
- No se verificó Android físico, Brave, Vercel ni ejecución de archivos en Excel/LibreOffice. No se fusionó ni desplegó.
