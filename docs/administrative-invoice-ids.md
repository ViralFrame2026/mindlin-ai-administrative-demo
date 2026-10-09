# Identificadores administrativos locales

## Modelo y alcance

`Invoice.id` sigue siendo la clave interna de rutas, relaciones y auditoría. `administrativeId` es independiente del comprobante fiscal y se muestra en detalle, listado, búsqueda, historial y columna ID de facturas CSV. El formato es `FAC-000001`, con un mínimo de seis dígitos (la secuencia puede crecer). No se usan fórmulas de Excel.

La garantía de unicidad corresponde a un único almacén IndexedDB del origen y perfil del navegador. Instalaciones independientes pueden emitir el mismo código; borrar los datos del sitio crea un almacén nuevo. No hay autenticación, numeración empresarial centralizada ni garantía global.

## Asignación y concurrencia

La transacción `readwrite` existente abarca `administrative-state` y `pdf-files`. Lee y escribe el contador persistente `administrative-sequence` en el mismo object store que el estado, como clave independiente de `current`. No requiere cambiar la versión de IndexedDB ni trasladar/eliminar PDFs.

La transacción migra primero el estado, ejecuta la operación y asigna definitivamente IDs nuevos desde el contador confirmado. Un ID proporcionado en una factura nueva se ignora. Un cambio a un ID de factura existente aborta la operación. El contador se guarda junto con estado, historia y PDF: abortar no reserva números ni deja escrituras parciales. IndexedDB serializa las transacciones entre pestañas; BroadcastChannel y la recarga existente actualizan la interfaz.

El contador no depende del número de facturas. Se conserva al eliminar registros o reemplazar/restaurar el estado; los registros que siguen existiendo mantienen sus códigos. También se almacena `nextAdministrativeNumber` en el estado como metadato recuperable. Nunca retrocede por una operación normal.

## Migración y recuperación

Los campos nuevos son opcionales en el esquema de entrada para aceptar datos anteriores (v1 localStorage y v2 IndexedDB). La primera transacción asigna códigos a los registros faltantes, ordenados por `createdAt` y, en empate, por ID interno, mediante comparación estable independiente de locale. Los códigos existentes se preservan; el contador avanza por encima del mayor código asignado y del máximo persistido.

La migración es idempotente. Mantiene UUID, comprobantes, importes, fechas, estados, rechazo, retenciones, claves de PDF e historial. Solo añade el código a cada registro y a eventos relacionados mediante `invoiceId`, sin reescribir motivos/descripciones ni snapshots previos. Eventos sin relación conocida no reciben un código inventado.

IDs administrativos inválidos/duplicados, UUID duplicados o contador inválido detienen la transacción y conservan los datos anteriores. Se mantiene la pantalla de recuperación y descarga de copia existente. No restaurar/borrar datos ante un error de migración; conservar el navegador y solicitar recuperación.

## CSV e interfaz

En facturas cambia únicamente el contenido de la columna ID. Mantiene 13 columnas, punto y coma, BOM único, CRLF, importes numéricos con coma decimal y protección contra fórmulas. `FAC-000001` es texto alfanumérico, sin fórmula de Excel. En el CSV de historial se agrega el código a la descripción, manteniendo sus columnas existentes. Los UUID permanecen en enlaces y almacenamiento, no como identidad administrativa visible.

## Pruebas

Regresiones unitarias: asignación automática, unicidad, migración determinista/idempotente de siete registros anteriores, preservación de asignados, rechazo de conflictos, transacciones concurrentes, no reutilización tras eliminación/reemplazo, PDF e historial, aprobación/rechazo, búsqueda y CSV.

La demo inicial de main tiene cuatro facturas, aunque contiene siete PDFs de ejemplo. La prueba unitaria de migración usa esos cuatro registros y tres registros históricos ficticios adicionales; la E2E existente de siete PDFs usa los originales sin modificarlos (tres PDFs heredados comparten el mismo comprobante). Las pruebas de migración no eliminan la prevención de duplicados del flujo real.

E2E nueva: dos pestañas extraen PDFs originales distintos, guardan concurrentemente, obtienen códigos diferentes, visualizan canvas, aprueban/rechazan, recargan y verifican conservación del código en estado, historial, búsqueda y descarga CSV. Se ejecuta en escritorio y Pixel 7 emulado; no equivale a Android físico ni Microsoft Excel real.

Resultados finales: `npm test` 117/117 (10 archivos); E2E 48/48 (24 escritorio y 24 Pixel 7 emulado); `npm run typecheck` y `npm run build` correctos. La primera corrida E2E detectó fixtures que copiaban el código de otra factura y una transición pendiente→rechazada no permitida; se corrigieron las pruebas, sin relajar las reglas del producto.
