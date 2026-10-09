# Diagnóstico de respuestas vacías al extraer PDFs

## Síntoma reproducido

La interfaz ejecutaba `response.json()` inmediatamente después de `fetch`. Cuando Vercel o la función respondían sin cuerpo, el navegador lanzaba:

```text
SyntaxError: Unexpected end of JSON input
```

Este comportamiento fue reproducido con un PDF digital válido y una respuesta HTTP 500 vacía. La extracción del mismo PDF contra la función local respondió correctamente con JSON, lo que separa el error de presentación del parser de datos.

## Causa raíz confirmada

La causa directa del mensaje visible era asumir que toda respuesta HTTP contenía JSON válido, sin comprobar antes:

1. `response.ok`;
2. el encabezado `Content-Type`;
3. la existencia del cuerpo;
4. que el JSON estuviera completo.

El origen exacto de la respuesta vacía de una ejecución histórica de Vercel solo puede determinarse con los logs de esa ejecución y el archivo original. El código sí contenía tres caminos capaces de producir una respuesta de plataforma fuera del control del handler:

- Permitía archivos de hasta 10 MB, aunque Vercel Functions limita el cuerpo de la solicitud a aproximadamente 4,5 MB.
- `pdf-parse` se importaba al inicializar el módulo, antes del `try`; un error de carga podía impedir que el handler construyera su respuesta JSON.
- No se declaraba el rango de Node.js. `pdf-parse@2.4.5` requiere Node `>=20.16` o `>=22.3` y no soporta Node 21.

## Corrección

- El archivo se limita a 4 MiB en cliente y servidor para dejar margen al multipart de Vercel.
- El proyecto declara Node `>=22.3 <25`, rango compatible con `pdf-parse@2.4.5`.
- `pdf-parse` se carga dinámicamente dentro del flujo protegido.
- La extracción tiene un timeout interno de 20 segundos, anterior al máximo de 30 segundos de la función.
- Todos los retornos controlados de la API usan JSON, código estable y `X-Request-Id`.
- Los detalles técnicos, versión de Node, archivo, tamaño, stack y request ID quedan en los logs del servidor.
- El cliente interpreta el cuerpo como JSON solo después de validar HTTP y `Content-Type`; respuestas vacías, HTML, texto o JSON truncado se convierten en mensajes en español y conservan el detalle técnico en `console.error`.

Una terminación impuesta por la plataforma antes de ejecutar el handler no puede ser convertida a JSON por la función. El manejo defensivo del cliente cubre también ese caso.

## Cobertura de regresión

`tests/pdf-api.test.ts` verifica:

- extracción real de un PDF digital;
- extracción de un PDF con cuatro conceptos;
- JSON válido para PDF corrupto;
- rechazo JSON de archivos mayores al límite;
- respuesta HTTP vacía;
- timeout en texto plano;
- JSON truncado con HTTP 200.
