/**
 * Compresses an image File to WebP format using the Canvas API.
 * Resizes to max 1400px wide and converts to WebP at 82% quality.
 * Generates a thumbnail at 400px wide at 75% quality.
 */
export async function compressImage(
  file: File,
  maxWidth = 1400,
  quality = 0.75 // Reduced from 0.82 for better compression
): Promise<Blob | File> {
  // If it's already a WebP and small, don't touch it
  if (file.type === 'image/webp' && file.size < 100 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      
      // Don't upscale
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            // If the "compressed" blob is significantly larger than the original 
            // and the original was already quite small, keep the original.
            if (blob.size > file.size && file.size < 50 * 1024) {
              resolve(file);
            } else {
              resolve(blob);
            }
          }
          else reject(new Error('Compression failed'));
        },
        'image/webp',
        quality
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

export async function generateThumbnail(file: File): Promise<Blob> {
  return compressImage(file, 400, 0.75);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getPublicUrl(bucket: string, path: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}
