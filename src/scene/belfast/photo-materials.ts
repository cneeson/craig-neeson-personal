import { BackSide, Color, DataTexture, ShaderMaterial, SRGBColorSpace, Texture, Vector3 } from 'three';

/** Linear colour from sRGB components (0..1), for shader constants. */
const lin = (r: number, g: number, b: number) => new Color(r, g, b).convertSRGBToLinear();

/** The haze along the horizon. Distant tiles fade into it, so the edge of what's loaded never shows. */
const HAZE = lin(0.78, 0.84, 0.9);

export const photoUniforms = {
    uFogColor: { value: HAZE },
    uFogDensity: { value: 0.0025 },
};

// For the odd tile without a texture
const blank = new DataTexture(new Uint8Array([150, 150, 150, 255]), 1, 1);
blank.colorSpace = SRGBColorSpace;
blank.needsUpdate = true;

/** Replaces the tiles' own materials: their photo texture, unlit (the lighting is baked in), fading into the haze. */
export const createTileMaterial = (map: Texture | null) => new ShaderMaterial({
    uniforms: { map: { value: map ?? blank }, ...photoUniforms },
    vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying float vDistance;
        void main() {
            vUv = uv;
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
        void main() {
            vec3 color = texture2D(map, vUv).rgb;
            float haze = 1.0 - exp(-pow(vDistance * uFogDensity, 2.0));
            gl_FragColor = vec4(mix(color, uFogColor, haze), 1.0);
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
