# Exportación CSV para Excel con configuración argentina

## Causa y cambio

La exportación anterior separaba columnas con comas y emitía decimales con punto. Excel configurado con separador de lista `;` abría esa estructura en una sola columna y podía interpretar importes con otra convención.

Ahora ambas exportaciones (facturas e historial) usan:

- Delimitador `;` y registros CRLF, con CRLF final.
- UTF-8 con un único BOM generado por el serializador, evitando BOM duplicado en los componentes.
- Campos de texto entre comillas, comillas internas duplicadas; delimitadores y saltos de línea quedan dentro de la celda.
- Importes finitos sin agrupación de miles y con coma decimal: `1512500,00`, `0,00`, `-1000,50`. Se emiten como números, sin apóstrofes ni fórmulas. Los importes no finitos provocan error, nunca cero.
- Encabezados existentes en español y orden fijo de 13 columnas: ID, Comprobante, Tipo, Fecha, Proveedor, CUIT, Neto, IVA, Total, Retenciones demo, Estado, Motivo rechazo, Origen.

Se evaluó `sep=;` y se omitió: el separador ya coincide con la configuración regional indicada y esa directiva introduciría una fila adicional ajena a los encabezados para lectores CSV comunes. Otros lectores deben interpretar UTF-8 con BOM y el delimitador `;`; no es un archivo delimitado por comas ni un XLSX.

## Identificadores e integridad

CUIT se presenta como `30-71500123-9`, incluso si está almacenado sin guiones. El comprobante se presenta como `0004-00001842`, rellenando campos numéricos cortos sin truncar sus dígitos. Estas cadenas estructuradas conservan ceros y evitan representar los identificadores como números largos. Los IDs internos existentes siguen siendo cadenas con prefijos, conservadas en la columna ID. No se usan fórmulas `="..."`, tabulaciones ni enlaces para forzar tipos.

Los motivos se exportan completos, incluidos saltos de línea. Estados y origen permanecen en español. La normalización es exclusiva de la exportación: no escribe en IndexedDB ni cambia comprobantes, CUIT, validaciones, estados o cálculos.

## Seguridad

Solo los valores que llegan como números JavaScript finitos reciben formato numérico. Los textos que comienzan por `=`, `+`, `-`, `@`, incluso precedidos por espacios, caracteres de control o marcadores invisibles, reciben un apóstrofo inicial. También se neutralizan textos iniciados por tabulación/CR/LF. Se conserva el escape de comillas y se aplican las mismas garantías al historial. Un importe negativo no se trata como un texto no confiable ni se convierte en fórmula.

El apóstrofo de neutralización puede aparecer al leer un campo protegido con lectores genéricos. Es intencional y no modifica el dato original almacenado. No se afirma certificación de seguridad para todos los programas de planillas.

## Verificación

Las unitarias leen el CSV con un lector independiente con soporte de comillas y celdas multilínea. Cubren siete registros/13 columnas, BOM, CRLF, importes positivos/negativos, identificadores, delimitadores, acentos, comillas, motivos completos, caracteres invisibles, fórmulas y rechazo de NaN/Infinity.

La E2E extrae siete PDFs originales mediante el endpoint y comprueba la descarga real desde **Exportar CSV**, su extensión, bytes BOM, columnas y valores. Tres PDFs heredados (servicios-norte, estudio-delta e insumos-oficina) contienen el mismo comprobante; se usa un fixture aislado de exportación para incluirlos juntos, sin deshabilitar la prevención de duplicados de la aplicación. No se modificaron esos PDFs ni los datos del usuario.

Microsoft Excel y LibreOffice no están disponibles en este entorno. No se ejecutó la apertura real en Excel argentino: el criterio de apertura directa queda pendiente de una prueba manual en ese programa. No se afirma esa compatibilidad real solo por las pruebas estructurales.

Para aceptación manual: descargar desde la app en Windows con Excel y configuración argentina; abrir mediante doble clic; comprobar 13 columnas, acentos, comprobante/CUIT como texto, suma de importes, motivos multilínea y campos peligrosos sin ejecución. Si se usan separadores regionales personalizados distintos de los indicados, verificar esa configuración por separado.

Resultados de esta corrección: `npm test` pasó 109/109 pruebas; E2E pasó 46/46 (23 en escritorio y 23 en Pixel 7 emulado); `npm run typecheck` y `npm run build` finalizaron correctamente. Android físico y Microsoft Excel no se probaron.
