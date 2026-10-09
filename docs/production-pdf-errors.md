# Diagnóstico de respuestas vacías al extraer PDFs

## Síntoma reproducido

La interfaz ejecutaba `response.json()` inmediatamente después de `fetch`. Cuando Vercel o la función respondían sin cuerpo, el navegador lanzaba:

```text
SyntaxError: Unexpected end of JSON input
```

Este comportamiento fue reproducido con un PDF digital válido y una respuesta HTTP 500 vacía. La extracción del mismo PDF contra la función local respondió correctamente con JSON, lo que separa el error de presentación del parser de datos.

## Causas raíz confirmadas

La causa directa del mensaje visible era asumir que toda respuesta HTTP contenía JSON válido, sin comprobar antes:

1. `response.ok`;
2. el encabezado `Content-Type`;
3. la existencia del cuerpo;
4. que el JSON estuviera completo.

Los logs de Vercel confirmaron por qué la función no llegaba a responder:

```text
Failed to load external module pdf-parse-08f4573089f02674:
ReferenceError: DOMMatrix is not defined
```

`pdf-parse@2.4.5` carga PDF.js 5.4. PDF.js intenta obtener `DOMMatrix`, `ImageData` y `Path2D` desde `@napi-rs/canvas`. Ese require es dinámico y el artefacto serverless no contenía el módulo nativo; al faltar también las APIs del navegador en Node, el módulo externo fallaba durante su inicialización.

Además, el límite anterior de 10 MB superaba los aproximadamente 4,5 MB admitidos por Vercel Functions.

## Corrección

- El archivo se limita a 4 MiB en cliente y servidor para dejar margen al multipart de Vercel.
- El proyecto declara Node `24.x`, igual que el runtime de producción.
- `pdf-parse` y sus dependencias PDF.js/canvas se eliminaron.
- La extracción usa `pdf2json@4.1.0`, que no tiene dependencias externas y sustituye el canvas gráfico por una estructura de datos en memoria.
- El extractor se carga dentro del flujo protegido y se destruye después de cada solicitud.
- La extracción tiene un timeout interno de 20 segundos, anterior al máximo de 30 segundos de la función.
- Todos los retornos controlados de la API usan JSON, código estable y `X-Request-Id`.
- Los detalles técnicos, versión de Node, archivo, tamaño, stack y request ID quedan en los logs del servidor.
- El cliente interpreta el cuerpo como JSON solo después de validar HTTP y `Content-Type`; respuestas vacías, HTML, texto o JSON truncado se convierten en mensajes en español y conservan el detalle técnico en `console.error`.

Una terminación impuesta por la plataforma antes de ejecutar el handler no puede ser convertida a JSON por la función. El manejo defensivo del cliente cubre también ese caso.

### Alternativas evaluadas

- `pdf-parse/node`: solo expone `getHeader`; no extrae texto.
- `pdf-parse@1.1.1`: evita DOMMatrix, pero contiene una versión obsoleta de PDF.js.
- `unpdf`: funciona en serverless, pero instala un stub global parcial de `DOMMatrix`; se descartó para no ocultar incompatibilidades con un polyfill incompleto.
- `pdf2json@4.1.0`: elegido porque es actual, Apache-2.0, compatible con Node 24 y no crea ni requiere los globals gráficos.

## Cobertura de regresión

`tests/pdf-api.test.ts` verifica:

- extracción real de un PDF digital;
- extracción de un PDF con cuatro conceptos;
- JSON válido para PDF corrupto;
- rechazo JSON de archivos mayores al límite;
- respuesta HTTP vacía;
- timeout en texto plano;
- JSON truncado con HTTP 200.

`tests/pdf-runtime.test.ts` elimina expresamente `DOMMatrix`, `ImageData` y `Path2D`, comprueba que `@napi-rs/canvas` no está instalado y extrae el PDF multiconcepto sin recrear esos globals.

## Limitaciones

- Solo se extrae texto digital; no hay OCR ni renderizado de imágenes.
- El orden de lectura depende de la estructura interna del PDF.
- `pdf2json` procesa en el mismo hilo de la función; se mantiene el límite de 4 MiB y el timeout para controlar recursos.
- La corrección local y el build no prueban el runtime remoto. La confirmación final exige desplegar la rama y ejecutar `POST /api/extract-pdf` en Vercel con los PDFs de producción.
