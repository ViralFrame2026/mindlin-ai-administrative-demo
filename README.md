# Mindlin AI — Administrative Automation

Demo comercial 2.0 de un circuito administrativo para cargar, extraer, validar, revisar y decidir facturas argentinas en PDF. Construida con Next.js, TypeScript y Tailwind CSS, lista para desplegar en Vercel.

## Funcionalidades

- Dashboard responsive con métricas, cola de trabajo y estado del circuito.
- Carga, vista previa y descarga de facturas PDF.
- Extracción real de la capa de texto mediante `pdf2json` en una Route Handler de Node.js, sin canvas ni APIs gráficas del navegador.
- Interpretación editable de emisor, CUIT, tipo, punto de venta, número, fechas e importes.
- Priorización del emisor frente al receptor, números combinados o separados y advertencias ante datos ambiguos.
- Validación del dígito verificador de CUIT y consistencia `neto + IVA = total`.
- Detección de duplicados por hash SHA-256 o por CUIT + punto de venta + número.
- Retenciones demostrativas configurables, con mínimos, alícuotas y base neta/total.
- Circuito obligatorio `Pendiente → En revisión → Aprobada/Rechazada`, confirmación explícita de aprobación y motivo obligatorio de rechazo.
- Trazabilidad de actor demo, fecha, hora, acción, cambio de estado y motivo.
- Historial de operaciones y exportación CSV de facturas o actividad.
- Persistencia transaccional de facturas, reglas, historial y PDFs en IndexedDB, con sincronización entre pestañas.
- Visor PDF.js con páginas reales en canvas, zoom, navegación y ajuste responsive en móvil/escritorio, además de apertura y descarga del original.
- Cuatro facturas ficticias de construcción, arquitectura, mantenimiento y logística, matemáticamente consistentes.
- Carga de ejemplos con un clic: los PDFs recorren el endpoint y el extractor real, sin precargar campos.

## Ejecutar localmente

Requisitos: Node.js 24 y npm.

```bash
npm ci
npm run dev
```

Abrir `http://localhost:3000`. No se requieren variables de entorno ni servicios externos.

Comandos de verificación:

```bash
npm test
npm run typecheck
npm run build
```

El visor tiene pruebas de navegador sobre el build de producción:

```bash
npx playwright install chromium
npm run test:e2e
```

Los detalles del worker local, la privacidad, la emulación móvil y los comandos alternativos están en [`docs/mobile-pdf-viewer.md`](docs/mobile-pdf-viewer.md).

Para regenerar los PDFs ficticios:

```bash
npm run generate:samples
```

## Probar la extracción real

1. Ir a **Facturas → Nueva factura**.
2. En **PDFs ficticios para probar**, elegir **Usar** sobre cualquiera de los cuatro casos.
3. La aplicación obtiene el binario y lo envía a `POST /api/extract-pdf`, exactamente como una carga local.
4. Revisar los campos y las advertencias. Como el comprobante también existe en los datos iniciales, el duplicado queda bloqueado.
5. Para probar un alta completa, cargar otro PDF o editar el número antes de guardar. Toda factura nueva se guarda como **Pendiente**.

La ruta `POST /api/extract-pdf` recibe el binario PDF, extrae su texto con `pdf2json` y devuelve campos estructurados, advertencias y una vista previa. La extracción no está hardcodeada contra los archivos de muestra. El tamaño máximo es 4 MB para respetar el límite de payload de Vercel Functions, incluido el margen del formulario multipart.

El analizador reconoce comprobantes como `0004-00001842` y campos separados, tolera variaciones de orden y prioriza etiquetas explícitas de emisor/proveedor. Si encuentra candidatos equivalentes o no puede identificar un campo, no lo inventa: devuelve una advertencia y deja el dato editable.

## Circuito de aprobación

1. Una carga validada se persiste como **Pendiente**.
2. Un usuario debe enviarla expresamente a **En revisión**.
3. Desde allí puede abrir una confirmación de **Aprobación** o registrar un **Rechazo** con motivo obligatorio.
4. Las decisiones finales no se reabren en este prototipo.

El encabezado identifica a `María González · Demo`. No existe autenticación, autorización ni concurrencia multiusuario real.

## Persistencia y reinicio

Toda la información de la demo queda en el navegador:

- Metadatos, reglas e historial: IndexedDB, esquema administrativo v2.
- Binarios PDF subidos: el mismo IndexedDB; se confirman junto con el alta y su historial.
- Las claves antiguas de `localStorage` se conservan como copia de migración; ya no reciben escrituras.

El botón **Reiniciar demo** solicita confirmación y restaura las cuatro facturas ficticias, sus distintos estados y el historial demostrativo; también elimina los PDFs que el usuario haya cargado. Al no existir backend, los datos no se sincronizan entre navegadores o dispositivos.

La migración y las garantías de integridad están documentadas en [`docs/administrative-integrity.md`](docs/administrative-integrity.md).

Las mejoras de navegación, accesibilidad, búsqueda y CSV se describen en [`docs/professional-administrative-ux.md`](docs/professional-administrative-ux.md).

El formato CSV regional, la protección contra fórmulas y la validación pendiente en Excel están documentados en [`docs/excel-compatible-csv.md`](docs/excel-compatible-csv.md).

## Pruebas cubiertas

- Extracción real de cuatro PDFs digitales con órdenes y etiquetas diferentes.
- Priorización emisor/receptor, comprobantes combinados/separados y ausencia de valores inventados.
- PDF multiconcepto, archivo dañado, límites y respuestas JSON defensivas.
- Transiciones válidas e inválidas, rechazo sin motivo y bloqueo de aprobación de duplicados.
- Renderizado real en navegador de escritorio y Android emulado: canvas, navegación multipágina, zoom, recuperación de IndexedDB y liberación de workers/URLs temporales.
- Validación de CUIT, importes, duplicados y retenciones ilustrativas.

## Despliegue en Vercel

El proyecto usa el runtime Node.js 24 para la extracción de PDF. `pdf2json` ejecuta el parser con un canvas de datos en memoria y no requiere `DOMMatrix`, `ImageData`, `Path2D` ni `@napi-rs/canvas`:

```bash
vercel
```

En el panel de Vercel, conservar el framework detectado como Next.js y el comando de build `npm run build`.

El diagnóstico y las garantías ante respuestas vacías o no JSON están documentados en [`docs/production-pdf-errors.md`](docs/production-pdf-errors.md).

## Limitaciones explícitas del prototipo

- Solo procesa PDFs digitales con capa de texto. No incorpora OCR para imágenes o documentos escaneados.
- Los patrones de extracción cubren formatos argentinos frecuentes, pero no todas las plantillas o tablas posibles. Los campos quedan editables y se señalan ambigüedades por ese motivo.
- Las reglas de retención son **demostrativas y configurables**. No implementan cálculos fiscales oficiales, padrones, jurisdicciones, acumulados, certificados de exclusión ni normativa vigente.
- CUIT e importes se validan localmente; no se consulta ARCA ni otro registro externo.
- La persistencia local no reemplaza una base de datos, autenticación, permisos, firma digital ni auditoría inmutable.
- El visor interno usa PDF.js en el navegador; los archivos y recursos permanecen en el mismo origen. La apertura del original depende del visor instalado en cada dispositivo.

Para un entorno productivo se necesitarían backend persistente, almacenamiento de objetos, autenticación y roles, OCR, antivirus, cifrado, observabilidad e integración con fuentes fiscales/contables autorizadas.
