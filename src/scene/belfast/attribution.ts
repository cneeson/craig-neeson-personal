/**
 * The on-screen credit for the photorealistic tiles (Google's logo and the data providers), which
 * must be visible while they are. city-attribution.vue registers its elements here, and
 * belfast-photo.vue shows and updates them.
 */
export const attribution: { element: HTMLElement | null; text: HTMLElement | null } = {
    element: null,
    text: null,
};
