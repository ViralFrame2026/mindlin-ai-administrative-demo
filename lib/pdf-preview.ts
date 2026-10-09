export function pdfCanvasSize(pageWidth: number, pageHeight: number, availableWidth: number, zoom: number, pixelRatio: number) {
  const scale = Math.max(1, availableWidth - 24) / pageWidth * zoom;
  const width = Math.max(1, Math.floor(pageWidth * scale));
  const height = Math.max(1, Math.floor(pageHeight * scale));
  // Bound canvas memory on high-density phones and unusually large pages.
  const ratio = Math.min(Math.max(1, pixelRatio), 2, 4096 / Math.max(width, height), Math.sqrt(8_000_000 / (width * height)));
  return { scale, width, height, ratio, pixelWidth: Math.max(1, Math.floor(width * ratio)), pixelHeight: Math.max(1, Math.floor(height * ratio)) };
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
