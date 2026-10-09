import { describe, expect, it, vi } from "vitest";
import { createManagedPdfUrl, pdfCanvasSize } from "../lib/pdf-preview";

describe("visualización local de PDF", () => {
  it("ajusta una página al ancho móvil y limita la memoria del canvas", () => {
    const size = pdfCanvasSize(595, 842, 296, 1, 3);
    expect(size.width).toBeLessThanOrEqual(272);
    expect(size.ratio).toBeLessThanOrEqual(2);
    const large = pdfCanvasSize(595, 842, 1600, 2.5, 4);
    expect(large.pixelWidth * large.pixelHeight).toBeLessThanOrEqual(8_000_000);
    expect(Math.max(large.pixelWidth, large.pixelHeight)).toBeLessThanOrEqual(4096);
  });

  it("libera cada URL temporal exactamente una vez", () => {
    const createObjectURL = vi.fn(() => "blob:mindlin-preview");
    const revokeObjectURL = vi.fn();
    const preview = createManagedPdfUrl(new Blob(["%PDF-1.7"]), { createObjectURL, revokeObjectURL });
    expect(preview.url).toBe("blob:mindlin-preview");
    preview.release();
    preview.release();
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mindlin-preview");
  });
});
