// @ts-ignore-next-line
import { BlendFunction, Effect } from 'postprocessing';
import { Uniform } from 'three';

/**
 * The last touch on the picture: a soft vignette, pulling the eye in from the corners, and a fine film grain, which
 * also breaks up the banding in the sky's dark gradients. One pass for both. `amount` (the grain) and `vignette` are
 * set each frame, as the planet wants more of both than the city.
 */
export class GrainEffect extends Effect {
    constructor() {
        super('GrainEffect', /* glsl */ `
            uniform float amount;
            uniform float vignette;
            float hash(vec2 p) {
                vec3 p3 = fract(vec3(p.xyx) * 0.1031);
                p3 += dot(p3, p3.yzx + 33.33);
                return fract((p3.x + p3.y) * p3.z);
            }
            void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
                vec2 fromMiddle = (uv - 0.5) * vec2(aspect, 1.0);
                vec3 colour = inputColor.rgb * (1.0 - vignette * smoothstep(0.3, 1.0, length(fromMiddle)));
                // Added about evenly to the eye (the colour is linear here, before tone mapping), changing at about
                // the rate of film rather than every frame
                float grain = hash(floor(uv * resolution) + floor(time * 24.0) * 61.7) - 0.5;
                vec3 shown = sqrt(max(colour, 0.0)) + grain * amount;
                outputColor = vec4(shown * shown, inputColor.a);
            }`, {
            blendFunction: BlendFunction.NORMAL,
            uniforms: new Map([['amount', new Uniform(0)], ['vignette', new Uniform(0)]]),
        });
    }
}
