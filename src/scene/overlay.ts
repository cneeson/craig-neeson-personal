import { PerspectiveCamera, Vector3 } from 'three';
import { EARTH_POSITION, earthToWorld } from './planet/geo';
import { sceneState } from './state';

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

const world = new Vector3();
const toCamera = new Vector3();
const outward = new Vector3();

/**
 * Where `point` (in the earth group's space) is on a screen `width` × `height`, in pixels, or null if it's round the
 * back of the planet or off screen. Writes into `target`.
 */
export const screenOnEarth = (
    point: Vector3, camera: PerspectiveCamera, width: number, height: number, target: { x: number, y: number },
) => {
    earthToWorld(point, sceneState.earthRotationY, world);
    // Facing the camera?
    toCamera.copy(camera.position).sub(world);
    const isFacing = toCamera.dot(outward.copy(world).sub(EARTH_POSITION)) > 0;
    world.project(camera);
    if (!isFacing || world.z >= 1 || Math.abs(world.x) >= 1.1 || Math.abs(world.y) >= 1.1) return null;
    target.x = ((world.x + 1) / 2) * width;
    target.y = ((1 - world.y) / 2) * height;
    return target;
};
