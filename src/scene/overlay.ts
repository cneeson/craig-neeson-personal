import { PerspectiveCamera } from 'three';

type OverlayFrame = (camera: PerspectiveCamera, progress: number, elapsed: number) => void;

const frames = new Set<OverlayFrame>();

/**
 * Runs `frame` every rendered frame, once the camera has moved, for the DOM drawn over the scene (the display
 * over the planet, the signs in the city, the letterbox). Updating in step with the camera, rather than on a
 * separate animation frame, keeps them pinned to the scene without lagging a frame behind it. Returns a
 * function that stops it.
 */
export const onOverlayFrame = (frame: OverlayFrame) => {
    frames.add(frame);
    return () => frames.delete(frame);
};

/** Called by the render loop after placing the camera. */
export const updateOverlays = (camera: PerspectiveCamera, progress: number, elapsed: number) =>
    frames.forEach(frame => frame(camera, progress, elapsed));
