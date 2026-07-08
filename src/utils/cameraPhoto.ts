import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource as CapCameraSource } from '@capacitor/camera';

export type CameraSourceType = 'camera' | 'gallery';
export const CameraSource = { Camera: 'camera' as const, Photos: 'gallery' as const };
export type CameraSource = (typeof CameraSource)[keyof typeof CameraSource];

const isNative = () => Capacitor.isNativePlatform();

export const createFileInput = (accept: string = 'image/*'): HTMLInputElement => {
  const existing = document.getElementById('__ev_file_input') as HTMLInputElement;
  if (existing) existing.remove();
  const input = document.createElement('input');
  input.id = '__ev_file_input';
  input.type = 'file';
  input.accept = accept;
  input.style.cssText = 'display:none;position:fixed;top:-100px;left:-100px;z-index:-1;opacity:0;';
  document.body.appendChild(input);
  return input;
};

export const dataUrlToFile = (dataUrl: string, filename: string): File => {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i);
  }
  return new File([array], filename, { type: mime });
};

export const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('No se pudo leer el archivo.'));
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsDataURL(file);
  });
};

const pickPhotoNative = async (source: 'camera' | 'gallery'): Promise<{ dataUrl: string; file: File }> => {
  const photo = await Camera.getPhoto({
    quality: 95,
    width: 1024,
    resultType: CameraResultType.DataUrl,
    source: source === 'camera' ? CapCameraSource.Camera : CapCameraSource.Photos,
    correctOrientation: true,
  });
  if (!photo.dataUrl) throw new Error('No se obtuvo la imagen.');
  const file = dataUrlToFile(photo.dataUrl, `photo_${Date.now()}.jpg`);
  return { dataUrl: photo.dataUrl, file };
};

export const pickPhotoFromFileInput = (capture?: boolean): Promise<{ dataUrl: string; file: File }> => {
  return new Promise((resolve, reject) => {
    const input = createFileInput('image/*');
    if (capture) input.setAttribute('capture', 'environment');
    const timeout = setTimeout(() => {
      input.remove();
      reject(new Error('Cancelado'));
    }, 120000);
    input.onchange = async () => {
      clearTimeout(timeout);
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        reject(new Error('Cancelado'));
        return;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        resolve({ dataUrl, file });
      } catch (err) {
        reject(err);
      }
    };
    input.click();
  });
};

export const pickPhoto = async (source: 'camera' | 'gallery'): Promise<{ dataUrl: string; file: File }> => {
  if (isNative()) return pickPhotoNative(source);
  return pickPhotoFromFileInput(source === 'camera');
};
