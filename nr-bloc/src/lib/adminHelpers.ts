// Kept comfortably under Vercel's serverless request body ceiling (~4.5MB).
// The admin forms compress images client-side before upload, so normal
// photos land well under this regardless of their original size.
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB

export const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function escapeYamlString(value: string): string {
  return value.replace(/"/g, '\\"');
}

export function validateImageFile(file: File): string | null {
  if (file.size > MAX_IMAGE_BYTES) return "Image must be under 4MB.";
  if (!IMAGE_EXTENSIONS[file.type]) {
    return "Image must be a JPEG, PNG, WebP, or GIF.";
  }
  return null;
}
