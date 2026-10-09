# Integridad administrativa

## Correcciones y regresiones

La rama corrige los seis hallazgos de criticidad alta de la auditoría de main (505215a):

| Hallazgo original | Garantía nueva | Regresión |
| --- | --- | --- |
| Neto -100, tipo XYZ, punto abc podían aprobarse | Validaciones actuales al guardar y decidir; no se confía en flags antiguos | administrative-integrity.test.ts y E2E de factura inconsistente |
| CUIT del receptor en líneas separadas seleccionado como emisor | Contexto aplicado también al valor siguiente; CUIT ambiguo queda vacío | pdf-integrity.test.ts genera un PDF real con receptor primero |
| 1.000 interpretado como 1 | Parser monetario estricto y campos desconocidos explícitos | Tests de formatos y PDF digital real |
| IVA 21 repetido en dos páginas sumado como 42 | Identidad de bloque fiscal completo, prioridad de resumen y conservación de conceptos | PDF real multipágina; conceptos iguales legítimos |
| Una pestaña sobrescribía estados y eventos de otra | Lectura y escritura serializadas, revisión por factura, BroadcastChannel | Transacciones concurrentes y E2E con dos pestañas/recargas |
| Alícuota 150 y recálculo silencioso de aprobadas | Rango 0–100, reglas versionadas, cálculos conservados y recálculo explícito | Tests de tasas; E2E con motivo y valores antes/después |

## Validación contable

Se permiten los tipos de factura A, B, C, E, M y T. Esta demo no incorpora el catálogo completo de comprobantes fiscales ni notas de crédito. Punto de venta: 1–5 dígitos, mayor que cero; número: 1–8 dígitos, mayor que cero. Las representaciones con ceros iniciales se normalizan para detectar duplicados. Las fechas deben ser calendáricamente válidas, con año desde 1900; vencimiento no anterior a emisión. Neto e IVA finitos y no negativos; total finito y positivo. Se exige neto + IVA = total con tolerancia de 0,02 ARS para redondeo. No se modelan otros tributos, percepciones ni descuentos fiscales separados: requieren corrección manual al modelo o una futura ampliación, nunca aprobación silenciosa.

Al aprobar se valida otra vez el contenido actual y los duplicados contra el estado vigente dentro de la transacción. Cambiar los flags de validación antiguos no habilita importes inválidos. Una factura nueva no puede guardarse si conserva advertencias de extracción sin confirmación manual. La confirmación se invalida al editar campos; advertencias y confirmación se conservan en el detalle.

## Números y extracción

- `1.000` → 1000; `1.250.000` → 1250000.
- `1.000,50` → 1000.50; `1250,50` → 1250.50.
- Se admite un punto decimal con uno o dos decimales, por ejemplo `420000.50`, por compatibilidad con PDFs digitales existentes.
- Una agrupación con punto y tres cifras se interpreta como miles argentinos, no como tres decimales. Formatos mixtos de otra convención como `1,234.56`, agrupaciones mal formadas y texto inválido se rechazan. No se eliminan caracteres arbitrarios para fabricar un importe.
- El parser puro lanza un error ante entrada inválida. El analizador conserva una advertencia y un valor no numérico; la API lo serializa como `null`, y la interfaz presenta el campo sin importe válido y bloquea el alta. Nunca se transforma en cero. Un cero explícito en un PDF, como IVA 0, continúa siendo válido.

El contexto emisor/receptor se reinicia por página. Candidatos con puntaje equivalente y valores distintos quedan sin seleccionar y exigen corrección/confirmación. El resumen global de IVA explícito tiene prioridad sobre el detalle. Si no existe, se compara el bloque completo neto + líneas fiscales + total entre páginas; resúmenes idénticos no se suman dos veces. Conceptos individuales iguales no se deduplican. Resúmenes diferentes sin una interpretación única exigen revisión manual; no se suman como si fueran varias facturas.

Persisten las limitaciones de un extractor heurístico sin OCR: no cubre todas las plantillas, tablas en columnas, resúmenes reformateados ni documentos que contengan varias facturas. La coherencia contable y las advertencias constituyen una barrera adicional, no una certificación fiscal.

## Persistencia y migración

Se mantiene la base `mindlin-ai-demo` y el almacén `pdf-files`, actualizando su versión de 1 a 2 e incorporando `administrative-state`. La factura, el PDF y el evento de alta se escriben en una misma transacción. Las decisiones y eventos también se confirman juntos. Un fallo o aborto revierte todo; la interfaz informa éxito después del commit.

La primera apertura importa las tres claves v1 de localStorage si existen completas y tienen estructura válida. Se conservan las claves originales, los blobs, estados finales, importes y cálculos. Una migración inválida/incompleta se detiene con mensaje en español y descarga de metadatos para recuperación; no reemplaza el contenido con ejemplos. Los PDFs permanecen en IndexedDB: el JSON de recuperación no contiene sus binarios. La reparación de datos dañados requiere intervención técnica y copia del perfil del navegador; no hay restauración automática ni borrado de recuperación.

Las reglas importadas reciben la versión 1 como punto de partida. No puede reconstruirse la regla histórica que originó un cálculo previo ni recuperarse un historial que ya se hubiera perdido antes de migrar. Los importes existentes se conservan; no se recalculan durante la migración. Cerrar o recargar todas las pestañas de la versión anterior al actualizar: una versión antigua sigue escribiendo localStorage y no participa del protocolo v2.

Cada operación lee el último estado dentro de una transacción readwrite. Decisiones sobre facturas diferentes se combinan sin pérdida. Una revisión obsoleta sobre la misma factura, o una versión obsoleta de reglas, se rechaza y refresca el estado. BroadcastChannel comunica commits; foco/pageshow permiten refrescar cuando no esté disponible. La revisión global evita aplicar respuestas de lectura atrasadas. No es colaboración entre dispositivos ni autorización multiusuario.

## Retenciones

Tasas finitas entre 0 y 100 inclusive; mínimos finitos no negativos. Guardar crea una nueva versión y registra reglas anteriores/nuevas. Ninguna factura existente se recalcula automáticamente. Cada cálculo conserva versión y snapshot de reglas.

En el detalle, una factura con reglas antiguas ofrece **Recalcular explícitamente**. Requiere motivo de al menos cinco caracteres, conserva el estado administrativo y registra actor demo, fecha, motivo, totales, líneas y versiones antes/después. En aprobadas esta acción es explícita; el cálculo original queda en el evento. Las reglas siguen siendo ilustrativas, no oficiales.

## Verificación

```bash
npm ci
npm test
npm run typecheck
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

El último comando requiere Chromium en esa ruta; alternativamente instalar el Chromium de Playwright y ejecutar `npm run test:e2e`. Los E2E utilizan el build de producción y prueban escritorio y Pixel 7 emulado. Los resultados finales se registran en la PR. No constituyen una prueba en Android físico, Brave ni Vercel: verificar el comportamiento en el despliegue y dispositivos objetivo antes de declarar compatibilidad productiva.

La persistencia continúa siendo local y editable por quien controla el navegador. No hay autenticación empresarial, auditoría inmutable, respaldos remotos ni eliminación del riesgo de pérdida del perfil. No se agregaron servicios externos para procesar documentos, secretos o configuración de producción.

### Resultados de esta entrega (9 de octubre de 2026)

- Node.js 24.19.0, Chromium 151 del entorno.
- `npm test`: 76/76 pruebas, siete archivos, aprobadas. Incluye los cuatro ejemplos existentes, el multiconcepto y cinco PDFs digitales generados para las regresiones.
- `npm run typecheck`: aprobado.
- `npm run build`: aprobado; worker y recursos PDF.js preparados desde el paquete instalado.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`: 28/28 pruebas, catorce recorridos en escritorio y catorce con Pixel 7 emulado, aprobadas.
- E2E: alta real, estado inicial pendiente, aprobación explícita, rechazo con motivo, concurrencia entre pestañas y sobre la misma factura, recargas, migración v1 con PDF conservado, reglas inválidas, recálculo con trazabilidad, reinicio y regresiones del visor.
- Los registros de PDF corrupto y migración inválida son errores esperados de casos negativos. No se ocultaron para hacer pasar las pruebas.
- Sin pruebas de Vercel, Android físico ni Brave. Sin despliegue ni cambios de secretos/configuración productiva.
