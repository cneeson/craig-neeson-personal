import { AdditiveBlending, BackSide, Color, MeshStandardMaterial, ShaderMaterial, Texture, Vector3 } from 'three';

/** Linear colour from sRGB components (0..1), for shader constants. */
const lin = (r: number, g: number, b: number) => new Color(r, g, b).convertSRGBToLinear();

/** Towards the scene's directional light (it shines on the origin), which lights the earth's day side. */
export const SUN_DIRECTION = new Vector3(100, 100, -30).normalize();

/** The air's colour where the sun lights it, and its faint glow on the night side. */
const SKY_BLUE = lin(0.45, 0.7, 1);
const NIGHT_BLUE = lin(0.12, 0.2, 0.42);
/** Along the terminator, where the sunlight reaching the air has come a long way through it. */
const DUSK = lin(1, 0.55, 0.3);

/** How high the air reaches, and how quickly it thins out, as a fraction of the earth's radius. */
const ATMOSPHERE_HEIGHT = 0.045;
const SCALE_HEIGHT = 0.011;

/** Shared GLSL: how lit the air is above `up` (a unit vector from the earth's centre), as a colour. */
const AIR_COLOR_GLSL = /* glsl */ `
    uniform vec3 uSunDirection;
    uniform vec3 uSkyBlue;
    uniform vec3 uNightBlue;
    uniform vec3 uDusk;
    vec3 airColor(vec3 up) {
        float sun = dot(up, uSunDirection);
        vec3 color = mix(uNightBlue, uSkyBlue, smoothstep(-0.25, 0.35, sun));
        return color + uDusk * exp(-pow(sun / 0.22, 2.0)) * 0.8;
    }
`;

const airUniforms = () => ({
    uSunDirection: { value: SUN_DIRECTION },
    uSkyBlue: { value: SKY_BLUE },
    uNightBlue: { value: NIGHT_BLUE },
    uDusk: { value: DUSK },
});

/**
 * The earth's surface: the day map with its bump map, lit by the scene's lights, plus city lights (NASA's Black
 * Marble) wherever the sun isn't shining, and a haze of air thickening towards the edge of the disc.
 * `uLights` (0..1) dims the city lights, so they can fade out before the day-time city.
 */
export const createEarthMaterial = (textures: { map: Texture, bumpMap: Texture, lightsMap: Texture }) => {
    const uniforms = {
        ...airUniforms(),
        uLightsMap: { value: textures.lightsMap },
        uLights: { value: 1 },
    };
    const material = new MeshStandardMaterial({ map: textures.map, bumpMap: textures.bumpMap, bumpScale: 0.3 });
    material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vUp;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvUp = normalize(mat3(modelMatrix) * normal);');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>
                varying vec3 vUp;
                uniform sampler2D uLightsMap;
                uniform float uLights;
                ${AIR_COLOR_GLSL}`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
                vec3 up = normalize(vUp);
                // City lights on the night side, coming on through dusk. The map's faint, moonlit ground is cut away.
                float sun = dot(up, uSunDirection);
                float night = smoothstep(0.1, -0.15, sun) + 0.35 * smoothstep(0.45, 0.1, sun);
                vec3 lights = max(texture2D(uLightsMap, vMapUv).rgb - 0.012, 0.0);
                totalEmissiveRadiance += lights * vec3(1.6, 1.25, 0.85) * night * uLights;
                // Looking through more air towards the edge of the disc
                float rim = 1.0 - max(dot(normal, normalize(vViewPosition)), 0.0);
                totalEmissiveRadiance += airColor(up) * pow(rim, 3.0) * 0.35;`);
    };
    return { material, uniforms };
};

/**
 * The glow of the atmosphere around the earth's limb, on a shell a little bigger than the earth: each pixel
 * glows by how close its line of sight passes to the ground, so the glow hugs the horizon and fades into
 * space, from orbit or from just above the clouds. Blue on the day side, orange along the terminator.
 * Additive, and drawn from the inside of the shell so only the part beyond the planet shows.
 */
export const createAtmosphereMaterial = (centre: Vector3) => new ShaderMaterial({
    uniforms: {
        ...airUniforms(),
        uCentre: { value: centre },
        uTop: { value: ATMOSPHERE_HEIGHT },
        uScaleHeight: { value: SCALE_HEIGHT },
    },
    vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            vWorld = world.xyz;
            gl_Position = projectionMatrix * viewMatrix * world;
        }
    `,
    fragmentShader: /* glsl */ `
        uniform vec3 uCentre;
        uniform float uTop;
        uniform float uScaleHeight;
        varying vec3 vWorld;
        ${AIR_COLOR_GLSL}
        void main() {
            vec3 direction = normalize(vWorld - cameraPosition);
            // The lowest point of the line of sight (no further back than the camera)
            float along = max(dot(uCentre - cameraPosition, direction), 0.0);
            vec3 lowest = cameraPosition + direction * along - uCentre;
            float height = max(length(lowest) - 1.0, 0.0);
            float glow = exp(-height / uScaleHeight) * (1.0 - smoothstep(uTop * 0.6, uTop, height));
            gl_FragColor = vec4(airColor(normalize(lowest)) * glow * 0.55, 1.0);
        }
    `,
    side: BackSide,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
});

export const ATMOSPHERE_RADIUS = 1 + ATMOSPHERE_HEIGHT;
