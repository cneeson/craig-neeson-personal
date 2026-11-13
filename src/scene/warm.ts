import { Camera, HalfFloatType, Object3D, Scene, WebGLRenderer, WebGLRenderTarget } from 'three';

type Options = { object?: Object3D, skip?: Object3D, hide?: Object3D[] };

/** Shows everything in `object` but `skip`, in view or not, and hides `hide`, for `draw`, then puts it all back. */
const revealed = ({ object, skip, hide = [] }: Options & { object: Object3D }, draw: () => void) => {
    const shown: Object3D[] = [];
    const unculled: Object3D[] = [];
    const hidden = hide.filter(child => child.visible);
    hidden.forEach(child => (child.visible = false));
    const reveal = (child: Object3D) => {
        if (child === skip) return;
        if (!child.visible) shown.push(child);
        if (child.frustumCulled) unculled.push(child);
        child.visible = true;
        child.frustumCulled = false;
        child.children.forEach(reveal);
    };
    reveal(object);
    try {
        draw();
    } finally {
        shown.forEach(child => (child.visible = false));
        unculled.forEach(child => (child.frustumCulled = true));
        hidden.forEach(child => (child.visible = true));
    }
};

/** Into a linear half-float target, like the bloom's that the scene is drawn into (three compiles for the screen differently). */
const intoTarget = (renderer: WebGLRenderer, draw: () => void) => {
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType });
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    try {
        draw();
    } finally {
        renderer.setRenderTarget(previous);
        target.dispose();
    }
};

/**
 * Gets the shaders of everything in `object` (the whole scene by default, but `skip`), hidden or not and in view or
 * not, ready to draw in `scene`, with the lights visible in it (but those in `hide`). Otherwise each is compiled the first time it's drawn, stalling that frame.
 * They're compiled in the background, then drawn once off screen, as the browser may only finish them (on the GPU)
 * when they're first drawn with. Resolves once that's done.
 */
export const warmShaders = async (renderer: WebGLRenderer, scene: Scene, camera: Camera, options: Options = {}) => {
    const settings = { ...options, object: options.object ?? scene };
    let compiled: Promise<unknown> = Promise.resolve();
    revealed(settings, () => intoTarget(renderer, () => (compiled = renderer.compileAsync(settings.object, camera, scene))));
    await compiled;
    revealed(settings, () => intoTarget(renderer, () => renderer.render(scene, camera)));
};
