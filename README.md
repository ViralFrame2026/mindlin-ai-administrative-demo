# Mindlin AI — Administrative Automation

Prototipo funcional de un dashboard administrativo para cargar, extraer, validar y aprobar facturas argentinas en PDF. Construido con Next.js, TypeScript y Tailwind CSS, listo para desplegar en Vercel.

## Funcionalidades

- Dashboard responsive con métricas, cola de trabajo y estado del circuito.
- Carga, vista previa y descarga de facturas PDF.
- Extracción real de la capa de texto mediante `pdf-parse` en una Route Handler de Node.js.
- Interpretación editable de proveedor, CUIT, comprobante, fechas e importes.
- Validación del dígito verificador de CUIT y consistencia `neto + IVA = total`.
- Detección de duplicados por hash SHA-256 o por CUIT + punto de venta + número.
- Retenciones demostrativas configurables, con mínimos, alícuotas y base neta/total.
- Aprobación y rechazo con motivo y trazabilidad.
- Historial de operaciones y exportación CSV de facturas o actividad.
- Persistencia del estado en `localStorage` y de PDFs cargados en IndexedDB.
- Cuatro facturas ficticias incluidas para una demostración grabada.

## Ejecutar localmente

Requisitos: Node.js 20.9 o superior y npm.

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`. No se requieren variables de entorno ni servicios externos.

Comandos de verificación:

```bash
npm test
npm run typecheck
npm run build
```

Para regenerar los PDFs ficticios:

```bash
npm run generate:samples
```

## Probar la extracción real

1. Ir a **Facturas → Nueva factura**.
2. Descargar uno de los PDFs ficticios ofrecidos en la misma pantalla.
3. Volver a cargar ese archivo y elegir **Extraer información**.
4. Revisar los campos detectados. Como el comprobante también existe en los datos iniciales, se mostrará la detección de duplicado.
5. Para probar un alta sin duplicado, editar el número antes de guardar.

La ruta `POST /api/extract-pdf` recibe el binario PDF, extrae su texto con `pdf-parse` y devuelve campos estructurados junto con una vista previa. La extracción no está hardcodeada contra los archivos de muestra. El tamaño máximo es 4 MB para respetar el límite de payload de Vercel Functions, incluido el margen del formulario multipart.

## Persistencia y reinicio

Toda la información de la demo queda en el navegador:

- Metadatos, reglas e historial: `localStorage`.
- Binarios PDF subidos: IndexedDB.

El botón **Reiniciar demo** restaura los datos ficticios y elimina PDFs que el usuario haya cargado. Al no existir backend, los datos no se sincronizan entre navegadores o dispositivos.

## Despliegue en Vercel

El proyecto usa el runtime Node.js para la extracción de PDF. `package.json` declara Node `>=22.3 <25`, compatible con `pdf-parse@2.4.5`:

```bash
vercel
```

En el panel de Vercel, conservar el framework detectado como Next.js y el comando de build `npm run build`.

El diagnóstico y las garantías ante respuestas vacías o no JSON están documentados en [`docs/production-pdf-errors.md`](docs/production-pdf-errors.md).

## Limitaciones explícitas del prototipo

- Solo procesa PDFs digitales con capa de texto. No incorpora OCR para imágenes o documentos escaneados.
- Los patrones de extracción cubren formatos argentinos frecuentes, pero no todas las variantes posibles. Los campos quedan editables por ese motivo.
- Las reglas de retención son **demostrativas y configurables**. No implementan cálculos fiscales oficiales, padrones, jurisdicciones, acumulados, certificados de exclusión ni normativa vigente.
- CUIT e importes se validan localmente; no se consulta ARCA ni otro registro externo.
- La persistencia local no reemplaza una base de datos, autenticación, permisos, firma digital ni auditoría inmutable.
- La vista PDF depende del visor integrado del navegador.

Para un entorno productivo se necesitarían backend persistente, almacenamiento de objetos, autenticación y roles, OCR, antivirus, cifrado, observabilidad e integración con fuentes fiscales/contables autorizadas.
