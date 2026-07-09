// lib/compress-image.ts
// Downscales an image client-side before it's uploaded or stored, so a
// multi-MB phone photo doesn't become an oversized upload or a bloated
// base64 database row. Shared by every photo capture flow in the app.

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 0.8;

type CompressOptions = {
  maxDimension?: number;
  quality?: number;
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function drawToCanvas(img: HTMLImageElement, maxDimension: number): HTMLCanvasElement {
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// For flows that store the image inline (e.g. shift handovers' photo_data_url column).
export async function compressImageToDataUrl(
  file: File,
  { maxDimension = DEFAULT_MAX_DIMENSION, quality = DEFAULT_QUALITY }: CompressOptions = {}
): Promise<string> {
  const img = await loadImage(file);
  const canvas = drawToCanvas(img, maxDimension);
  return canvas.toDataURL('image/jpeg', quality);
}

// For flows that upload to Supabase Storage (e.g. recipe/inventory item photos).
export async function compressImageToBlob(
  file: File,
  { maxDimension = DEFAULT_MAX_DIMENSION, quality = DEFAULT_QUALITY }: CompressOptions = {}
): Promise<Blob> {
  const img = await loadImage(file);
  const canvas = drawToCanvas(img, maxDimension);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))), 'image/jpeg', quality);
  });
}
