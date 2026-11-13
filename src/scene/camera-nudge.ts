// Debug: a hand-held city camera for finding shots (debug-camera.vue).
import type { Pose } from './shots';

/** While `pose` is set, the city camera sits there instead of following the director. Plain, read every frame. */
export const cameraNudge: { pose: Pose | null } = { pose: null };
