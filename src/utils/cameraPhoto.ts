import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

let isNative: boolean | null = null;

export const getIsNativePlatform = (): boolean => {
  if (isNative !== null) return isNative;
  try {
    isNative = Capacitor.isNativePlatform();
  } catch {
    isNative = false;
  }
  return isNative;
};

const CAMERA_PERMISSION_ERROR = 'No se pudo acceder a la cámara. Revisa los permisos.';
const GALLERY_PERMISSION_ERROR = 'No se pudo acceder a la galería. Revisa los permisos.';
const STORAGE_PERMISSION_HINT = 'Activa los permisos de cámara y almacenamiento en ajustes.';

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

export const normalizeCameraPhoto = (photo: {
  dataUrl?: string;
  base64String?: string;
  format?: string;
}): string => {
  if (photo.dataUrl) return photo.dataUrl;
  if (photo.base64String) {
    const mime = photo.format ? `image/${photo.format}` : 'image/jpeg';
    return `data:${mime};base64,${photo.base64String}`;
  }
  throw new Error('No se pudo leer la foto seleccionada.');
};

export const ensureCameraPermissions = async (): Promise<boolean> => {
  if (!getIsNativePlatform()) return true;
  try {
    const status = await Camera.checkPermissions();
    if (status.camera === 'granted' || status.camera === 'limited') return true;
    
    // Request permissions with better error handling
    const request = await Camera.requestPermissions();
    
    // Check if permissions were granted
    if (request.camera === 'granted' || request.camera === 'limited') return true;
    
    // If not granted, throw a descriptive error
    throw new Error('Camera permission denied. Please enable camera permissions in app settings.');
  } catch (error: any) {
    console.error('Camera permission error:', error);
    throw error;
  }
};

export const ensureGalleryPermissions = async (): Promise<boolean> => {
  if (!getIsNativePlatform()) return true;
  try {
    const status = await Camera.checkPermissions();
    const photosStatus = status.photos ?? status.camera;
    if (photosStatus === 'granted' || photosStatus === 'limited') return true;
    
    // Request permissions with better error handling
    const request = await Camera.requestPermissions();
    const requested = request.photos ?? request.camera;
    
    // Check if permissions were granted
    if (requested === 'granted' || requested === 'limited') return true;
    
    // If not granted, throw a descriptive error
    throw new Error('Gallery permission denied. Please enable gallery/storage permissions in app settings.');
  } catch (error: any) {
    console.error('Gallery permission error:', error);
    throw error;
  }
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

export const pickPhoto = async (source: CameraSource): Promise<{ dataUrl: string; file: File }> => {
  const isNative = getIsNativePlatform();

  // Web platform - use file input
  if (!isNative) {
    const useCapture = source === CameraSource.Camera;
    return pickPhotoFromFileInput(useCapture);
  }

  // Native platform - request permissions first
  try {
    if (source === CameraSource.Camera) {
      const granted = await ensureCameraPermissions();
      if (!granted) {
        throw new Error(`${CAMERA_PERMISSION_ERROR} ${STORAGE_PERMISSION_HINT}`);
      }
    } else {
      const granted = await ensureGalleryPermissions();
      if (!granted) {
        throw new Error(`${GALLERY_PERMISSION_ERROR} ${STORAGE_PERMISSION_HINT}`);
      }
    }

    // Try to get photo using Capacitor Camera
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source,
      saveToGallery: false,
    });

    const dataUrl = normalizeCameraPhoto(photo);
    const extension = photo.format || 'jpg';
    const file = dataUrlToFile(dataUrl, `photo-${Date.now()}.${extension}`);
    return { dataUrl, file };
  } catch (err: any) {
    const msg = String(err?.message || err || '').toLowerCase();
    
    // Handle user cancellation
    if (msg.includes('cancel') || msg.includes('user cancelled')) {
      throw new Error('Cancelado');
    }
    
    // Fallback to file input if Capacitor Camera fails
    if (msg.includes('image.png') || msg.includes('does not support image') || msg.includes('unable to') || msg.includes('permission')) {
      try {
        const result = await pickPhotoFromFileInput(source === CameraSource.Camera);
        return result;
      } catch (fbErr: any) {
        const fbMsg = String(fbErr?.message || '').toLowerCase();
        if (fbMsg.includes('cancel')) throw new Error('Cancelado');
        throw new Error(`${CAMERA_PERMISSION_ERROR} ${STORAGE_PERMISSION_HINT}`);
      }
    }
    
    throw new Error(`${CAMERA_PERMISSION_ERROR} ${STORAGE_PERMISSION_HINT}`);
  }
};
