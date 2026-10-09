# Mindlin AI — demo comercial 2.0

## Extracción documental

`POST /api/extract-pdf` conserva el límite de 4 MB, el timeout de 20 segundos y las respuestas JSON defensivas. `pdf2json` obtiene la capa de texto sin canvas nativo ni APIs gráficas del navegador. El análisis posterior:

- detecta numeración argentina combinada y campos separados;
- reconoce tipo, punto de venta, número, emisión, vencimiento, neto, IVA y total;
- puntúa etiquetas explícitas de emisor/proveedor por encima de receptor/cliente;
- acepta distintos órdenes y documentos con múltiples conceptos;
- informa candidatos ambiguos y deja campos ausentes vacíos para revisión manual.

No hay OCR. Los PDFs escaneados, protegidos, dañados o con maquetaciones no contempladas pueden requerir carga manual.

## Flujo administrativo

La máquina de estados permite solamente:

```text
Pendiente → En revisión → Aprobada
                        ↘ Rechazada (motivo obligatorio)
```

No se aprueba al cargar ni al validar. La aprobación requiere una segunda confirmación y queda bloqueada ante errores críticos o duplicados. Cada transición registra actor, timestamp, acción, estado anterior/nuevo y motivo cuando corresponde.

`María González · usuario demo` es una identidad fija de presentación. No representa permisos multiusuario ni autenticación real.

## Visor y almacenamiento

Los PDFs cargados se guardan en IndexedDB. La página de detalle crea una URL temporal, la revoca al cambiar de documento o desmontarse y registra errores técnicos en consola mientras muestra mensajes comprensibles. Los archivos de muestra se sirven desde el mismo origen. No se usa Google Docs ni otro visor externo.

En escritorio se intenta la vista embebida. En Android se muestran acciones de apertura y descarga porque el soporte de PDF dentro de `iframe` no es consistente.

## Casos ficticios

Los cuatro casos —construcción, arquitectura, mantenimiento y logística— son PDFs digitales sin validez fiscal, con conceptos e importes matemáticamente consistentes. La acción **Usar** descarga el binario desde `/samples` y lo envía al mismo endpoint real; no asigna campos desde datos hardcodeados.

**Reiniciar demo** limpia IndexedDB y restaura metadatos, reglas, estados e historial ficticios en el almacenamiento local.

## Límites comerciales visibles

- Sin OCR ni lectura de imágenes.
- Retenciones ilustrativas, no cálculos fiscales oficiales.
- Sin consulta a ARCA, ERP ni sistema contable.
- Persistencia exclusiva del navegador, sin sincronización ni auditoría inmutable.
- Sin roles o permisos multiusuario reales.
