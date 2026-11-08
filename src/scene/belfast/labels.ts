/**
 * The landmark labels are DOM elements (crisp text, cheap) positioned by the render loop, which
 * projects each landmark onto the screen every frame. city-labels.vue registers them here, in
 * the same order as `landmarks`.
 */
export const labelElements: (HTMLElement | null)[] = [];
