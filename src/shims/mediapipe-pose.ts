// Sustituto de @mediapipe/pose (no instalado). pose-detection lo importa solo para BlazePose con MediaPipe;
// nosotros usamos MoveNet con TensorFlow.js, así que nunca se llama. Sin este archivo, el navegador no podía cargar
// el detector de postura del probador (importación sin resolver) y la web se recargaba sola.
export class Pose {
  constructor() {
    throw new Error('MediaPipe Pose no está disponible en Estilo Vivo');
  }
}
