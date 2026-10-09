// Vercel Functions accepts request bodies up to 4.5 MB. Keeping the PDF at
// 4 MiB leaves enough room for multipart boundaries and headers.
export const MAX_PDF_FILE_SIZE = 4 * 1024 * 1024;
export const MAX_PDF_FILE_SIZE_LABEL = "4 MB";
