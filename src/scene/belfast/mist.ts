import { Color, DoubleSide, Group, Mesh, PerspectiveCamera, PlaneGeometry, ShaderMaterial, Texture, TextureLoader } from 'three';
import { clamp01, smoothstep } from '@/services/three';
import { bounds } from './geo';
import { CLOUD_SHADOW_GLSL, cloudShadowUniforms, photoUniforms } from './photo-materials';

/** Linear colour from sRGB components (0..1), for shader constants. */
const lin = (r: number, g: number, b: number) => new Color(r, g, b).convertSRGBToLinear();

/** The layers of mist (scene units above the water): thickest at the bottom, thinning upwards. */
const LAYERS = [0.4, 1.2, 2.2, 3.4, 4.8, 6.4];
/**
 * How the mist burns off once the city's out of the clouds: from all of it to `rest` of it over `over` seconds. Under
 * `low` (scene units) the camera's down in it, so it's gone by then, from `high`.
 */
const BURN = { rest: 0.3, over: 30, low: 12, high: 40 };

/**
 * Low mist over the Lagan, the docks and the lough: a few thin sheets just above the water (over the water mask,
 * spread out onto the banks a little), wisping on the wind and breaking up in the sun.
 */
export const createMist = () => {
    const mask = new TextureLoader().load(`${process.env.BASE_URL}belfast/water.png`);
    // water.png's first row is the north edge, which is the plane's minimum z
    mask.flipY = false;
    const [width, depth] = [bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ];

    const object = new Group();
    const materials = LAYERS.map((height, i) => {
        const material = new ShaderMaterial({
            uniforms: {
                uMask: { value: mask as Texture },
                uBounds: { value: [bounds.minX, bounds.minZ, width, depth] },
                uAmount: { value: 0 },
                uTime: { value: 0 },
                uRise: { value: i / (LAYERS.length - 1) },
                uLight: { value: lin(0.92, 0.9, 0.87) },
                uShade: { value: lin(0.7, 0.74, 0.8) },
                ...photoUniforms,
                ...cloudShadowUniforms,
            },
            vertexShader: /* glsl */ `
                varying vec3 vWorld;
                varying float vDistance;
                void main() {
                    vec4 world = modelMatrix * vec4(position, 1.0);
                    vWorld = world.xyz;
                    vec4 view = viewMatrix * world;
                    vDistance = length(view.xyz);
                    gl_Position = projectionMatrix * view;
                }
            `,
            fragmentShader: /* glsl */ `
                uniform sampler2D uMask;
                uniform vec4 uBounds;
                uniform float uAmount;
                uniform float uTime;
                uniform float uRise;
                uniform vec3 uLight;
                uniform vec3 uShade;
                uniform vec3 uFogColor;
                uniform float uFogDensity;
                varying vec3 vWorld;
                varying float vDistance;
                ${CLOUD_SHADOW_GLSL}

                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
                }
                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    vec2 u = f * f * (3.0 - 2.0 * f);
                    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), u.x), u.y);
                }
                float fbm(vec2 p) {
                    float sum = 0.0;
                    float amplitude = 0.5;
                    for (int i = 0; i < 4; i++) {
                        sum += noise(p) * amplitude;
                        p = p * 2.03 + 17.1;
                        amplitude *= 0.5;
                    }
                    return sum;
                }

                void main() {
                    vec2 maskUv = (vWorld.xz - uBounds.xy) / uBounds.zw;
                    // Blurred (a coarse level of the mask), so it spreads out over the banks, and less of it higher up
                    float water = smoothstep(0.05, 0.5, texture2D(uMask, maskUv, 5.0 + uRise * 1.5).r);
                    vec2 edge = min(maskUv, 1.0 - maskUv) * uBounds.zw;
                    water *= smoothstep(0.0, 60.0, min(edge.x, edge.y));
                    // Wisps drifting on the wind, from the south-west, each layer a little differently
                    vec2 drift = vec2(1.0, -0.6) * uTime * (0.5 + uRise * 0.4);
                    float wisps = fbm((vWorld.xz + drift) * 0.012 + uRise * 3.7);
                    float cover = smoothstep(0.45 + uRise * 0.1, 0.85, wisps * (0.6 + water * 0.8)) * smoothstep(0.0, 0.4, water);
                    // Gone close to the camera, so it's never a sheet across the lens
                    float alpha = cover * smoothstep(8.0, 60.0, vDistance) * (0.2 - uRise * 0.09) * uAmount;
                    if (alpha < 0.002) discard;
                    vec3 color = mix(uShade, uLight, cloudShadow(vWorld.xz) * 0.7 + uRise * 0.3);
                    float haze = 1.0 - exp(-pow(vDistance * uFogDensity, 2.0));
                    gl_FragColor = vec4(mix(color, uFogColor, haze), alpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            side: DoubleSide,
        });
        const sheet = new Mesh(new PlaneGeometry(width, depth), material);
        sheet.rotation.x = -Math.PI / 2;
        sheet.position.set(bounds.minX + width / 2, height, bounds.minZ + depth / 2);
        // After the water and the tiles, lowest first
        sheet.renderOrder = 2 + i * 0.01;
        object.add(sheet);
        return material;
    });

    return {
        object,
        /** `shownFor`: how long the city's been out of the clouds (s), as the mist burns off. */
        update(elapsed: number, shownFor: number, view: PerspectiveCamera) {
            const burnt = smoothstep(clamp01(shownFor / BURN.over));
            const amount = (1 - burnt * (1 - BURN.rest)) * smoothstep(clamp01((view.position.y - BURN.low) / (BURN.high - BURN.low)));
            object.visible = amount > 0.001;
            materials.forEach(material => {
                material.uniforms.uAmount.value = amount;
                material.uniforms.uTime.value = elapsed;
            });
        },
        dispose() {
            mask.dispose();
            object.children.forEach(child => (child as Mesh).geometry.dispose());
            materials.forEach(material => material.dispose());
        },
    };
};
