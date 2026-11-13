import { BackSide, Color, DataTexture, ShaderMaterial, SRGBColorSpace, Texture, Vector3 } from 'three';

/** Linear colour from sRGB components (0..1), for shader constants. */
const lin = (r: number, g: number, b: number) => new Color(r, g, b).convertSRGBToLinear();

/** The haze along the horizon. Distant tiles fade into it, so the edge of what's loaded never shows. */
const HAZE = lin(0.78, 0.84, 0.9);

export const photoUniforms = {
    uFogColor: { value: HAZE },
    uFogDensity: { value: 0.0017 },
};

/** Drives the cloud shadows drifting over the city; the city's render loop keeps it up to date. */
export const cloudShadowUniforms = {
    uCloudTime: { value: 0 },
};

/**
 * GLSL for the shadows of clouds drifting over the city on the wind, from the south-west: `cloudShadow(xz)` is
 * how much sun reaches the ground at a world position, 0 (in shadow) to 1. The clouds are a few hundred metres
 * across, blowing at about 8 m/s, and cover about half the sky. Needs `cloudShadowUniforms`.
 */
export const CLOUD_SHADOW_GLSL = /* glsl */ `
    uniform float uCloudTime;
    float cloudHash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
    }
    float cloudNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(cloudHash(i), cloudHash(i + vec2(1.0, 0.0)), u.x),
            mix(cloudHash(i + vec2(0.0, 1.0)), cloudHash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float cloudShadow(vec2 xz) {
        vec2 p = xz / 45.0 - vec2(0.015, -0.011) * uCloudTime;
        float n = 0.5 * cloudNoise(p) + 0.25 * cloudNoise(p * 2.03 + 3.1)
            + 0.125 * cloudNoise(p * 4.01 + 7.7) + 0.0625 * cloudNoise(p * 8.05 + 1.3);
        return 1.0 - smoothstep(0.42, 0.5, n);
    }
`;

/** The colour of the ground in a cloud's shadow, relative to sunlit: lit only by the blue sky. */
export const CLOUD_SHADE_GLSL = /* glsl */ 'vec3(0.6, 0.65, 0.74)';

// For the odd tile without a texture
const blank = new DataTexture(new Uint8Array([150, 150, 150, 255]), 1, 1);
blank.colorSpace = SRGBColorSpace;
blank.needsUpdate = true;

/**
 * Replaces the tiles' own materials: their photo texture, unlit (the lighting is baked in), under drifting cloud
 * shadows and fading into the haze.
 */
export const createTileMaterial = (map: Texture | null) => new ShaderMaterial({
    uniforms: { map: { value: map ?? blank }, ...photoUniforms, ...cloudShadowUniforms },
    vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying float vDistance;
        varying vec2 vGround;
        void main() {
            vUv = uv;
            vGround = (modelMatrix * vec4(position, 1.0)).xz;
            vec4 view = modelViewMatrix * vec4(position, 1.0);
            vDistance = length(view.xyz);
            gl_Position = projectionMatrix * view;
        }
    `,
    fragmentShader: /* glsl */ `
        uniform sampler2D map;
        uniform vec3 uFogColor;
        uniform float uFogDensity;
        varying vec2 vUv;
        varying float vDistance;
        varying vec2 vGround;
        ${CLOUD_SHADOW_GLSL}
        void main() {
            vec3 color = texture2D(map, vUv).rgb;
            color *= mix(${CLOUD_SHADE_GLSL}, vec3(1.0), cloudShadow(vGround));
            float haze = 1.0 - exp(-pow(vDistance * uFogDensity, 2.0));
            gl_FragColor = vec4(mix(color, uFogColor, haze), 1.0);
            // Where TilesFadePlugin adds its dithered fade between levels of detail
            #include <dithering_fragment>
        }
    `,
});

/** A daytime sky: pale haze at the horizon deepening to blue overhead, with a soft glow from the sun. */
export const createDaySkyMaterial = () => new ShaderMaterial({
    uniforms: {
        uHaze: { value: HAZE },
        uZenith: { value: lin(0.34, 0.54, 0.84) },
        uSunColor: { value: lin(1, 0.93, 0.8) },
        // Ahead and to the right of the flight, low in the sky
        uSun: { value: new Vector3(0.85, 0.42, 0.31).normalize() },
    },
    vertexShader: /* glsl */ `
        varying vec3 vDirection;
        void main() {
            vDirection = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */ `
        uniform vec3 uHaze;
        uniform vec3 uZenith;
        uniform vec3 uSunColor;
        uniform vec3 uSun;
        varying vec3 vDirection;
        void main() {
            vec3 direction = normalize(vDirection);
            vec3 color = mix(uHaze, uZenith, pow(max(direction.y, 0.0), 0.55));
            float sun = max(dot(direction, uSun), 0.0);
            color += uSunColor * (pow(sun, 8.0) * 0.12 + pow(sun, 300.0) * 0.8);
            gl_FragColor = vec4(color, 1.0);
        }
    `,
    side: BackSide,
    depthWrite: false,
});
