export type CompressedImage = {
  file: File;
  width: number;
  height: number;
};

// Resizes a photo in the browser before upload, so phone camera originals
// (often 5–20MB) fit in a single request. 2400px on the long edge is plenty
// for a full-screen view on a large display.
export function compressImage(
  file: File,
  maxDimension = 2400,
  quality = 0.86
): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas is not supported in this browser."));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Image compression failed."));
            return;
          }
          const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
          resolve({
            file: new File([blob], newName, { type: "image/jpeg" }),
            width,
            height,
          });
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load that image."));
    };

    img.src = objectUrl;
  });
}
