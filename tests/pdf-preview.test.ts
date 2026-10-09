import { describe, expect, it, vi } from "vitest";
import { createManagedPdfUrl, supportsInlinePdfPreview } from "../lib/pdf-preview";

describe("visualización local de PDF", () => {
  it("usa vista embebida en escritorio y alternativa segura en Android", () => {
    expect(supportsInlinePdfPreview("Mozilla/5.0 (X11; Linux x86_64) Chrome/140")).toBe(true);
    expect(supportsInlinePdfPreview("Mozilla/5.0 (Linux; Android 15) Chrome/140 Mobile")).toBe(false);
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
