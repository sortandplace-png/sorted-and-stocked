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

// --- Cropping -------------------------------------------------------------
//
// Same canvas as above, drawn from a source rectangle instead of the whole
// image -- deliberately an extension of this module rather than a second
// image path, so every flow keeps one place where pixels are touched.
//
// Crop and rotate are applied in ONE pass, then compressed, so the image is
// never re-encoded twice. Cropping a already-compressed JPEG and re-saving it
// would compound the loss.

/** Source rectangle in the ORIGINAL image's pixel space. */
export type CropRect = { x: number; y: number; width: number; height: number };

/** Quarter turns clockwise. Phone photos arrive sideways constantly. */
export type Rotation = 0 | 90 | 180 | 270;

export function loadImageFromSrc(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Existing photos are served from Supabase Storage, a different origin.
    // Without this the canvas is tainted and toBlob() throws a SecurityError,
    // which is what would break "crop the photo already on this item".
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCropped(img: HTMLImageElement, crop: CropRect, rotation: Rotation, maxDimension: number) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  // After a quarter turn the output's width/height swap.
  const swapped = rotation === 90 || rotation === 270;
  const cropW = crop.width;
  const cropH = crop.height;
  const outW = swapped ? cropH : cropW;
  const outH = swapped ? cropW : cropH;

  const scale = Math.min(1, maxDimension / Math.max(outW, outH));
  canvas.width = Math.max(1, Math.round(outW * scale));
  canvas.height = Math.max(1, Math.round(outH * scale));

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  // Draw the crop rect centred on the rotated origin. Width/height here are
  // pre-rotation, which is why they're taken from the crop and not the canvas.
  ctx.drawImage(
    img,
    crop.x,
    crop.y,
    cropW,
    cropH,
    (-cropW * scale) / 2,
    (-cropH * scale) / 2,
    cropW * scale,
    cropH * scale
  );
  return canvas;
}

export async function cropImageToBlob(
  src: string,
  crop: CropRect,
  rotation: Rotation = 0,
  { maxDimension = DEFAULT_MAX_DIMENSION, quality = DEFAULT_QUALITY }: CompressOptions = {}
): Promise<Blob> {
  const img = await loadImageFromSrc(src);
  const canvas = drawCropped(img, crop, rotation, maxDimension);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))), 'image/jpeg', quality);
  });
}

export async function cropImageToDataUrl(
  src: string,
  crop: CropRect,
  rotation: Rotation = 0,
  { maxDimension = DEFAULT_MAX_DIMENSION, quality = DEFAULT_QUALITY }: CompressOptions = {}
): Promise<string> {
  const img = await loadImageFromSrc(src);
  return drawCropped(img, crop, rotation, maxDimension).toDataURL('image/jpeg', quality);
}

/** Centre-square preview at Print Labels' real size. A 2"x2" label shrinks
 *  the photo to a small square, so framing that reads fine full-size can be
 *  unusable there -- this is what the cropper previews. */
export const LABEL_THUMB_PX = 160;

export async function labelThumbDataUrl(src: string, crop: CropRect, rotation: Rotation = 0): Promise<string> {
  const img = await loadImageFromSrc(src);
  const side = Math.min(crop.width, crop.height);
  const square: CropRect = {
    x: crop.x + (crop.width - side) / 2,
    y: crop.y + (crop.height - side) / 2,
    width: side,
    height: side,
  };
  return drawCropped(img, square, rotation, LABEL_THUMB_PX).toDataURL('image/jpeg', 0.8);
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
