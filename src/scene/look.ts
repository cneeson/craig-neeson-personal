// @ts-ignore-next-line
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';
import { PerspectiveCamera, Uniform, Vector2, Vector3 } from 'three';
import { isMobile, prefersReducedMotion } from '@/services/device';
import { clamp01, damp, smoothstep } from '@/services/three';
import { CITY_SUN } from '@/scene/belfast/photo-materials';
import { EARTH_POSITION } from '@/scene/planet/geo';

/**
 * The picture's look, in one pass after the bloom and before the grain:
 * - `grade`: over the city, a warm, late-afternoon grade (warm light, cool shade, a touch more colour, a little darker), so the flat
 *   daylight of the photos has a mood;
 * - `shafts`: rays of sun streaming down through the last of the cloud as the city comes out of it, from `light`
 *   (a point on screen, above the top on the sun's side);
 * - `speed`: while the camera moves fast, a blur streaking out from where it's heading (`heading`, on screen) and
 *   colour fringing towards the edges, so the long moves feel quick. Nothing while it's held, so reading's never
 *   blurred.
 */
export class LookEffect extends Effect {
    constructor() {
        super('LookEffect', /* glsl */ `
            uniform float grade;
            uniform float shafts;
            uniform vec2 light;
            uniform float speed;
            uniform vec2 heading;

            float hash(vec2 p) {
                vec3 p3 = fract(vec3(p.xyx) * 0.1031);
                p3 += dot(p3, p3.yzx + 33.33);
                return fract((p3.x + p3.y) * p3.z);
            }

            vec3 graded(vec3 linear) {
                // Graded by eye, so roughly perceptually (the colour's linear here)
                vec3 c = sqrt(max(linear, 0.0));
                float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
                // Cool in the shade, warm in the light
                c *= mix(vec3(0.95, 0.99, 1.05), vec3(1.05, 1.0, 0.91), smoothstep(0.15, 0.85, luma));
                // A gentle S-curve, and a little more colour
                c = mix(c, c * c * (3.0 - 2.0 * c), 0.25);
                c = mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, 1.1);
                // and a little less bright than the photos' flat daylight
                c *= 0.9;
                return c * c;
            }

            void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
                vec3 colour = inputColor.rgb;
                float jitter = hash(uv * resolution + fract(time) * 97.0);

                if (speed > 0.001) {
                    // Streaked along the line from where the camera's heading, more the further from it, plus a
                    // fringe of red out and blue in towards the edges
                    vec2 away = uv - heading;
                    vec2 streak = away / max(length(away), 0.001) * speed * 0.018 * min(length(away), 1.0);
                    vec2 fringe = (uv - 0.5) * speed * 0.003;
                    vec3 sum = vec3(0.0);
                    for (int i = 0; i < SPEED_SAMPLES; i++) {
                        vec2 at = uv + streak * ((float(i) + jitter) / float(SPEED_SAMPLES) - 0.5);
                        sum += vec3(
                            texture2D(inputBuffer, at + fringe).r,
                            texture2D(inputBuffer, at).g,
                            texture2D(inputBuffer, at - fringe).b
                        );
                    }
                    colour = sum / float(SPEED_SAMPLES);
                }

                if (shafts > 0.001) {
                    // Marching towards the light, gathering what's bright on the way (the sky and the cloud), fading
                    // with the distance
                    vec2 step = (light - uv) * 0.7 / float(SHAFT_SAMPLES);
                    vec2 at = uv + step * jitter;
                    float decay = 1.0;
                    vec3 rays = vec3(0.0);
                    for (int i = 0; i < SHAFT_SAMPLES; i++) {
                        vec3 seen = texture2D(inputBuffer, at).rgb;
                        float bright = smoothstep(0.25, 0.7, dot(seen, vec3(0.2126, 0.7152, 0.0722)));
                        rays += seen * bright * decay;
                        decay *= 0.94;
                        at += step;
                    }
                    colour += rays / float(SHAFT_SAMPLES) * vec3(1.0, 0.82, 0.58) * shafts * 2.2;
                }

                if (grade > 0.001) colour = mix(colour, graded(colour), grade);
                outputColor = vec4(colour, inputColor.a);
            }`, {
            blendFunction: BlendFunction.NORMAL,
            // It reads the picture round each pixel
            attributes: EffectAttribute.CONVOLUTION,
            defines: new Map([['SPEED_SAMPLES', isMobile ? '6' : '10'], ['SHAFT_SAMPLES', isMobile ? '12' : '20']]),
            uniforms: new Map<string, Uniform>([
                ['grade', new Uniform(0)],
                ['shafts', new Uniform(0)],
                ['light', new Uniform(new Vector2(0.9, 1.2))],
                ['speed', new Uniform(0)],
                ['heading', new Uniform(new Vector2(0.5, 0.5))],
            ]),
        });
    }
}

/**
 * How fast the picture's moving: the camera's speed over its height above the ground (city units, or earth radii
 * over the planet), so it's the same measure at any scale. Blurred from `SPEED.from`, fully by `SPEED.to` (per second).
 */
const SPEED = { from: 1.6, to: 6 };
/** How long the sun's rays linger once the city's out of the clouds (s, roughly). */
const SHAFTS_LINGER = 2.5;

const previous = new Vector3();
const velocity = new Vector3();
const ahead = new Vector3();
const sunward = new Vector3();
const right = new Vector3();
let wasInCity: boolean | null = null;
let rate = 0;
let glow = 0;

type Uniforms = Map<string, { value: unknown }>;

/** Sets the look for this frame, from the camera (just placed) and where the journey is. */
export const updateLook = (uniforms: Uniforms | undefined, cam: PerspectiveCamera, isInCity: boolean, veil: number, delta: number) => {
    // The speed, skipping the frame the camera jumps between the planet and the city
    const height = isInCity ? Math.max(cam.position.y, 4) : Math.max(cam.position.distanceTo(EARTH_POSITION) - 1, 0.004);
    let measured = 0;
    if (wasInCity === isInCity && delta > 0) {
        velocity.subVectors(cam.position, previous).divideScalar(delta);
        measured = velocity.length() / height;
        // A cut, not a move
        if (measured > 40) measured = 0;
    }
    wasInCity = isInCity;
    previous.copy(cam.position);
    rate = damp(rate, measured, 8, delta);
    if (!uniforms) return;

    const speed = prefersReducedMotion ? 0 : smoothstep(clamp01((rate - SPEED.from) / (SPEED.to - SPEED.from)));
    uniforms.get('speed')!.value = speed;
    if (speed > 0.001 && velocity.lengthSq() > 0) {
        // Where it's heading on screen (or coming from, if it's backing away: the streaks run the same way)
        ahead.copy(velocity).normalize().multiplyScalar(height * 100).add(cam.position).project(cam);
        if (ahead.z > 1) ahead.negate();
        const heading = uniforms.get('heading')!.value as Vector2;
        heading.set(Math.min(Math.max(ahead.x * 0.5 + 0.5, -2), 3), Math.min(Math.max(ahead.y * 0.5 + 0.5, -2), 3));
    }

    // The sun's rays as the city comes out of the clouds, lingering a little after
    if (isInCity && veil > 0.6) glow = 1;
    else glow = damp(glow, 0, 1 / SHAFTS_LINGER, delta);
    uniforms.get('shafts')!.value = isInCity ? glow * smoothstep(clamp01((1 - veil) / 0.8)) : 0;
    if (isInCity) {
        // From above the top of the screen, on the sun's side, or where the sun is if it's in view
        sunward.copy(CITY_SUN).add(cam.position).project(cam);
        right.set(1, 0, 0).applyQuaternion(cam.quaternion);
        const side = Math.sign(right.dot(CITY_SUN)) || 1;
        const isInView = sunward.z < 1 && Math.abs(sunward.x) < 1 && Math.abs(sunward.y) < 1;
        (uniforms.get('light')!.value as Vector2).set(
            isInView ? sunward.x * 0.5 + 0.5 : 0.5 + side * 0.45,
            isInView ? sunward.y * 0.5 + 0.5 : 1.25,
        );
    }
    uniforms.get('grade')!.value = isInCity ? 1 : 0;
};
