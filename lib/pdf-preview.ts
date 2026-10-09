export function supportsInlinePdfPreview(userAgent: string) {
  // Android no ofrece un visor PDF embebido consistente; se muestran acciones seguras
  // de apertura/descarga en lugar de un marco vacío.
  return !/Android/i.test(userAgent);
}

export function createManagedPdfUrl(
  blob: Blob,
  urlApi: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> = URL,
) {
  const url = urlApi.createObjectURL(blob);
  let released = false;
  return {
    url,
    release() {
      if (released) return;
      released = true;
      urlApi.revokeObjectURL(url);
    },
  };
}
