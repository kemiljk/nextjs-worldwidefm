/**
 * Replace a filename's extension with `.jpg`, since compression always outputs JPEG.
 */
function toJpegFilename(filename: string): string {
  const extensionStart = filename.lastIndexOf('.');
  const base = extensionStart > 0 ? filename.slice(0, extensionStart) : filename;
  return `${base}.jpg`;
}

export async function compressImage(
  file: File,
  maxSizeMB: number = 2,
  maxWidthOrHeight: number = 2000
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    img.onload = () => {
      let { width, height } = img;

      if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
        if (width > height) {
          height = (height / width) * maxWidthOrHeight;
          width = maxWidthOrHeight;
        } else {
          width = (width / height) * maxWidthOrHeight;
          height = maxWidthOrHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);

      const compressAndCheck = (quality: number) => {
        canvas.toBlob(
          blob => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            const targetSize = maxSizeMB * 1024 * 1024;

            if (blob.size <= targetSize || quality <= 0.1) {
              const compressedFile = new File([blob], toJpegFilename(file.name), {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });

              console.log(
                `Image compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(blob.size / 1024 / 1024).toFixed(2)}MB`
              );
              resolve(compressedFile);
            } else {
              compressAndCheck(quality - 0.1);
            }
          },
          'image/jpeg',
          quality
        );
      };

      compressAndCheck(0.9);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
