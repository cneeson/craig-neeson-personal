import {
    BackSide, Color, HalfFloatType, LinearFilter, Mesh, OrthographicCamera, PlaneGeometry, RepeatWrapping, Scene,
    ShaderMaterial, SphereGeometry, Vector3, WebGLRenderer, WebGLRenderTarget,
} from 'three';

const lin = (hex: string) => new Color(hex).convertSRGBToLinear();

/**
 * The sky's colours (sRGB): the flat background, the broad clouds of colour (violet, teal, rose and blue, drifting
 * into one another), and the band across it.
 */
const COLOURS = { base: '#090118', clouds: ['#2a0d4a', '#0c2c3a', '#3a1230', '#101c48'], band: '#3b1f66' };

// The way the title's camera looks, and its up: the band crosses that view from upper left to lower right, behind
// the planet
const HERO_FORWARD = new Vector3(0.131, -0.521, -0.844);
const HERO_UP = new Vector3(0.199, 0.847, -0.492);
const across = new Vector3().crossVectors(HERO_FORWARD, HERO_UP).multiplyScalar(Math.cos(0.5))
    .addScaledVector(HERO_UP, Math.sin(0.5));
const BAND_NORMAL = new Vector3().crossVectors(HERO_FORWARD, across).normalize();

const noise = /* glsl */ `
    float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
            mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
            mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
            f.z);
    }
    float fbm(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 6; i++) {
            value += amplitude * noise(p);
            p = p * 2.02 + 17.3;
            amplitude *= 0.5;
        }
        return value;
    }
`;

/**
 * Paints the sky once, into an equirectangular texture: broad, faint clouds of colour, warped so they're wispy, and a
 * band of denser, brighter sky with dust lanes across it. All kept well under the bloom's threshold.
 */
const bakeMaterial = new ShaderMaterial({
    uniforms: {
        uBase: { value: lin(COLOURS.base) },
        uClouds: { value: COLOURS.clouds.map(lin) },
        uBand: { value: lin(COLOURS.band) },
        uBandNormal: { value: BAND_NORMAL },
    },
    vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
        }`,
    fragmentShader: /* glsl */ `
        uniform vec3 uBase;
        uniform vec3 uClouds[4];
        uniform vec3 uBand;
        uniform vec3 uBandNormal;
        varying vec2 vUv;
        ${noise}
        // Undoes three's ACES filmic tone mapping (at an exposure of 1), so the sky shows in its colours
        // rather than crushed to black, as anything this dark otherwise is
        vec3 untoneMapped(vec3 shown) {
            const mat3 inputMat = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
            const mat3 outputMat = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
            vec3 y = inverse(outputMat) * shown;
            // y = (v² + 0.0245786v - 0.000090537) / (0.983729v² + 0.432951v + 0.238081), solved for v
            vec3 a = y * 0.983729 - 1.0;
            vec3 b = y * 0.432951 - 0.0245786;
            vec3 c = y * 0.238081 + 0.000090537;
            vec3 v = (-b - sqrt(max(b * b - 4.0 * a * c, 0.0))) / (2.0 * a);
            return max(inverse(inputMat) * v * 0.6, 0.0);
        }
        void main() {
            // Matches the sky sphere's mapping (see below)
            float lon = (vUv.x - 0.5) * 6.2831853;
            float lat = (vUv.y - 0.5) * 3.1415927;
            vec3 dir = vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));

            vec3 warp = vec3(fbm(dir * 2.0 + 1.7), fbm(dir * 2.0 + 9.2), fbm(dir * 2.0 + 4.4)) - 0.5;
            vec3 p = dir * 1.8 + warp * 1.6;
            // Stretched, as the noise mostly sits around the middle: dark gaps between the clouds
            float clouds = pow(smoothstep(0.42, 0.72, fbm(p)), 1.6);
            // Which colour, from three slow fields: violet or teal, rose or blue, and one pair or the other
            float tintA = smoothstep(0.38, 0.62, fbm(dir * 2.6 + warp + 23.0));
            float tintB = smoothstep(0.38, 0.62, fbm(dir * 2.2 + warp + 61.0));
            float pair = smoothstep(0.4, 0.6, fbm(dir * 1.8 + 80.0));
            vec3 tint = mix(mix(uClouds[0], uClouds[1], tintA), mix(uClouds[2], uClouds[3], tintB), pair);
            vec3 colour = uBase * mix(0.6, 1.0, smoothstep(0.3, 0.55, fbm(dir * 1.2 + 40.0)));
            colour += tint * clouds * 0.65;

            // The band, ragged at its edges, and darker in its dust lanes
            float off = dot(dir, uBandNormal) + (fbm(dir * 3.0 + 5.0) - 0.5) * 0.3;
            float band = exp(-pow(off / 0.16, 2.0));
            float lanes = smoothstep(0.45, 0.6, fbm(dir * 7.0 + warp * 2.0));
            float glow = band * smoothstep(0.3, 0.75, fbm(dir * 10.0 + 2.0)) * (1.0 - 0.8 * lanes);
            // The band takes on the clouds' colours along its length too, so it isn't all violet
            colour += mix(uBand, tint * 1.5, 0.65) * glow;
            // Well greyed, so it stays in the background
            colour = mix(vec3(dot(colour, vec3(0.2126, 0.7152, 0.0722))), colour, 0.6);
            gl_FragColor = vec4(untoneMapped(colour), 1.0);
        }`,
    depthTest: false,
    depthWrite: false,
});

/**
 * A faint nebula behind the stars, so the black isn't flat. Painted once into a texture (see bakeMaterial), then
 * looked up by direction on a sphere kept around the camera, behind everything else.
 */
export const createNebula = (renderer: WebGLRenderer, width: number) => {
    const target = new WebGLRenderTarget(width, width / 2, {
        type: HalfFloatType,
        magFilter: LinearFilter,
        minFilter: LinearFilter,
        depthBuffer: false,
    });
    target.texture.wrapS = RepeatWrapping;

    const material = new ShaderMaterial({
        uniforms: { uSky: { value: target.texture } },
        vertexShader: /* glsl */ `
            varying vec3 vDir;
            void main() {
                vDir = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
        fragmentShader: /* glsl */ `
            uniform sampler2D uSky;
            varying vec3 vDir;
            void main() {
                vec3 dir = normalize(vDir);
                vec2 uv = vec2(atan(dir.x, dir.z) / 6.2831853 + 0.5, asin(clamp(dir.y, -1.0, 1.0)) / 3.1415927 + 0.5);
                // With a little grain, about a step of the screen's 8 bits, so the dark gradients don't band
                float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
                gl_FragColor = vec4(texture2D(uSky, uv).rgb * (1.0 + grain * 0.1), 1.0);
            }`,
        side: BackSide,
        depthTest: false,
        depthWrite: false,
    });
    const mesh = new Mesh(new SphereGeometry(500, 32, 16), material);
    mesh.renderOrder = -10;
    mesh.frustumCulled = false;

    const quad = new Mesh(new PlaneGeometry(2, 2), bakeMaterial);
    quad.frustumCulled = false;
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.render(new Scene().add(quad), new OrthographicCamera());
    renderer.setRenderTarget(previous);
    quad.geometry.dispose();
    bakeMaterial.dispose();

    return {
        mesh,

        dispose() {
            target.dispose();
            material.dispose();
            mesh.geometry.dispose();
        },
    };
};
