// Sustituto de @tensorflow/tfjs-backend-webgpu (no instalado): pose-detection solo lo usa si el backend activo es
// WebGPU, y el probador usa WebGL. Ver src/shims/mediapipe-pose.ts.
export class WebGPUBackend {}
export const webgpu_util = {};
