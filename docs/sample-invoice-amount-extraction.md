# Investigación de importes de los ejemplos originales

Base auditada: main, commit 2c3f2bc (incluye la corrección de integridad administrativa).

## Resultado y límite

No se reprodujo en esta versión el fallo reportado para arquitectura. El PDF original, sin regenerar ni modificar, devuelve neto 480000, IVA 0 y total 480000, sin advertencias de extracción. El recorrido de cargar ejemplo, leer campos y guardar funciona en Chromium de escritorio y con Pixel 7 emulado. Esto no verifica Android físico, Brave ni Vercel.

La causa raíz del incidente de producción permanece sin confirmar. Se requiere la URL del despliegue y comprobar la revisión realmente desplegada, el PDF servido y el JSON de POST /api/extract-pdf. No se modificó el extractor ni se debilitó la validación para producir una corrección aparente. Esta rama incorpora cobertura y diagnóstico; no afirma resolver el incidente.

## Evidencia del documento

Archivo: public/samples/factura-arquitectura-urbana.pdf

SHA-256: c2dd985e53a0c8f23d3bf2c855d56476dc46415e5fe8cad9301e646da01a9f0a

pdf2json devuelve estos campos, con espacios de alineación:

```
TOTAL:                               $ 480.000,00
IVA:                                             $ 0,00
Subtotal:                                     $ 480.000,00
```

El texto crudo está en orden inverso dentro de la página y contiene el marcador `Page (0) Break`; el analizador actual normaliza espacios y orden. Las expresiones de importes reconocen las etiquetas anteriores, y el parser monetario reconoce tanto 480.000,00 como 0,00. Ninguno queda ausente en las comprobaciones realizadas.

Reproducir la inspección sin editar el PDF:

```bash
node scripts/inspect-sample-pdf.mjs
```

## Comprobaciones

Las pruebas de endpoint existentes usan los cuatro PDFs originales y exigen importes exactos y ausencia de advertencias. Las regresiones monetarias mantienen los casos 1.000, 1.250.000, 1.000,50 y 1250,50; también rechazan entradas inválidas y mantienen advertencias ante importes ambiguos o ausentes.

Se agregaron cuatro recorridos E2E, ejecutados en ambos perfiles de navegador. Cada uno verifica neto, IVA y total en los campos, guarda pendiente y comprueba los valores persistidos después de recargar. Para evitar el duplicado contra los datos iniciales, se edita exclusivamente el número de comprobante de la copia de demostración antes de guardar; no se editan importes ni PDF. Arquitectura verifica explícitamente IVA visible 0, distinto de un campo vacío.

```bash
npm test
npm run typecheck
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

No se modifican PDF.js, IndexedDB, validaciones, circuito administrativo ni archivos PDF originales. No se fusiona ni despliega esta rama.

## Resultados ejecutados

- npm test: 76/76 aprobadas, incluidos los cuatro PDFs originales vía endpoint, formatos monetarios y ambigüedades.
- npm run typecheck y npm run build: aprobados.
- Suite E2E completa: 36/36 aprobadas, 18 escritorio y 18 Pixel 7 emulado. Ocho comprobaciones corresponden a los cuatro ejemplos originales, con importes visibles y persistidos después de recargar.
- Inspección del texto de arquitectura y comprobación SHA-256 realizadas con Node.js 24.19.0.
- Incidente de producción: pendiente de reproducción; falta URL del despliegue para contrastar su endpoint, documento y revisión. No se declara solucionado.
