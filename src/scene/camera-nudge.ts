// Debug: a hand-held city camera for finding shots (debug-camera.vue).
import type { Pose } from './shots';

/** While `pose` is set, the city camera sits there instead of following the director. Plain, read every frame. */
export const cameraNudge: { pose: Pose | null } = { pose: null };

// For driving it from browser tests, in development
if (process.env.NODE_ENV === 'development') (window as unknown as { cameraNudge: typeof cameraNudge }).cameraNudge = cameraNudge;
