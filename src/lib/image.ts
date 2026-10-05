/** Photo helpers shared by every upload (reports, progress updates, completions). */

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
/** Largest original we accept — it is shrunk before upload, so phone photos of any normal size work. */
export const MAX_PICK_BYTES = 20 * 1024 * 1024;

/** Returns an error message for an unusable file, or null if it's fine. */
export function photoProblem(file: File): string | null {
  if (!PHOTO_TYPES.includes(file.type)) return 'Please choose a JPEG, PNG or WebP photo.';
  if (file.size > MAX_PICK_BYTES) return 'That photo is over 20 MB. Please choose a smaller one.';
  return null;
}

/** Shrinks a photo to at most `maxSide` pixels on its longest side as a JPEG (~0.3–1 MB).
 *  Falls back to the original file if the browser can't decode it. */
export async function shrinkPhoto(file: File, maxSide = 2000, quality = 0.85): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === 'image/jpeg' && file.size < 1.5 * 1024 * 1024) { bitmap.close(); return file; }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close(); return file; }
    ctx.fillStyle = '#fff';                       // PNG transparency → white, not black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
