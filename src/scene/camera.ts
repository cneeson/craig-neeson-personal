import { PerspectiveCamera } from 'three';

/**
 * Handed straight to <TresCanvas>, so it's the active camera from the very first frame.
 * Declaring it inside the (async) scene instead means Tres briefly creates a default camera,
 * and the post-processing composer silently drops its effects when the camera is swapped.
 */
export const camera = new PerspectiveCamera(35, 1, 0.01, 1000);
camera.position.set(0, 0, 10);
