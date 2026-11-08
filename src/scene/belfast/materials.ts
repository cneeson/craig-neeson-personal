import { AdditiveBlending, BackSide, Color, DoubleSide, ShaderMaterial, Texture, Vector3 } from 'three';
import { bounds } from './geo';

/**
 * The city's materials: Belfast at night, lit by its windows, streets and floodlights. Night hides
 * what OSM doesn't have (facades, roof shapes, trees): buildings read as dark blocks and patterns
 * of light, the way a city does from the air after dark.
 *
 * Colours are written as sRGB and converted (`lin`), since the shaders output linear values.
 * Normals come from screen-space derivatives, so building vertices can be shared between faces.
 */

/** Shared by every city material, so they're updated once per frame. */
export const cityUniforms = {
    uTime: { value: 0 },
    uFogColor: { value: new Color('#3a2238').convertSRGBToLinear() },
    uFogDensity: { value: 0.0065 },
    /** Pixels per unit of size at distance 1: drawing-buffer height / (2 tan(fov / 2)). */
    uPointScale: { value: 1000 },
};

export const MOON_DIRECTION = new Vector3(-0.5, 0.42, -0.75).normalize();

const common = /* glsl */ `
    uniform float uTime;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    varying vec3 vWorld;
    varying float vDepth;

    vec3 lin(vec3 srgb) { return pow(srgb, vec3(2.2)); }

    float hash(vec3 p) {
        p = fract(p * vec3(0.1031, 0.1030, 0.0973));
        p += dot(p, p.yxz + 33.33);
        return fract((p.x + p.y) * p.z);
    }

    float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(vec3(i, 0.0)), hash(vec3(i + vec2(1, 0), 0.0)), u.x),
                   mix(hash(vec3(i + vec2(0, 1), 0.0)), hash(vec3(i + vec2(1, 1), 0.0)), u.x), u.y);
    }

    vec3 flatNormal() { return normalize(cross(dFdx(vWorld), dFdy(vWorld))); }

    vec3 fogged(vec3 color) {
        float density = vDepth * uFogDensity;
        return mix(color, uFogColor, 1.0 - exp(-density * density));
    }
`;

const worldVertex = /* glsl */ `
    varying vec3 vWorld;
    varying float vDepth;

    void setWorld(vec3 local) {
        vec4 world = modelMatrix * vec4(local, 1.0);
        vec4 view = viewMatrix * world;
        vWorld = world.xyz;
        vDepth = -view.z;
        gl_Position = projectionMatrix * view;
    }
`;

const moonDirection = `vec3(${MOON_DIRECTION.toArray().join(', ')})`;

export const createBuildingMaterial = () => new ShaderMaterial({
    uniforms: cityUniforms,
    vertexShader: /* glsl */ `
        ${worldVertex}
        attribute vec2 info;
        varying vec2 vInfo;
        void main() {
            vInfo = info;
            setWorld(position);
        }
    `,
    fragmentShader: /* glsl */ `
        ${common}
        varying vec2 vInfo;

        void main() {
            vec3 n = flatNormal();
            float seed = mod(vInfo.x, 256.0);
            float kind = floor(vInfo.x / 256.0 + 0.01);
            float isRoof = step(0.6, abs(n.y));

            vec3 base = mix(lin(vec3(0.09, 0.09, 0.14)), lin(vec3(0.13, 0.12, 0.15)), seed / 255.0);
            float moon = max(dot(n, ${moonDirection}), 0.0);
            // Warm light thrown up the walls from the streets, fading with height
            float street = exp(-vWorld.y * 2.5) * (1.0 - isRoof);
            vec3 color = base * (0.45 + 0.9 * moon) + lin(vec3(0.75, 0.45, 0.25)) * 0.25 * street;
            color += isRoof * lin(vec3(0.14, 0.1, 0.16)) * 0.4;

            if (isRoof < 0.5) {
                // Windows: a grid along each wall, one floor high
                vec2 tangent = normalize(vec2(-n.z, n.x));
                float u = dot(vWorld.xz, tangent);
                float floorHeight = kind < 0.5 ? 0.27 : kind < 1.5 ? 0.37 : kind < 2.5 ? 0.6 : 0.33;
                float bay = kind < 0.5 ? 0.34 : kind < 1.5 ? 0.24 : kind < 2.5 ? 0.9 : 0.32;
                float litChance = kind < 0.5 ? 0.16 : kind < 1.5 ? 0.32 : kind < 2.5 ? 0.04 : 0.18;

                vec2 cell = vec2(u / bay, (vWorld.y - 0.03) / floorHeight);
                vec2 id = floor(cell);
                vec2 f = fract(cell);
                float h = hash(vec3(id, seed + kind * 7.0));
                float lit = step(1.0 - litChance, h);
                float pane = smoothstep(0.16, 0.24, f.x) * smoothstep(0.84, 0.76, f.x)
                           * smoothstep(0.2, 0.3, f.y) * smoothstep(0.86, 0.78, f.y);
                // None in the parapet, nor below the ground
                pane *= step(0.3, (vInfo.y - vWorld.y) / floorHeight) * step(0.0, cell.y);

                vec3 warm = mix(lin(vec3(1.0, 0.68, 0.38)), lin(vec3(1.0, 0.86, 0.62)), fract(h * 7.31));
                vec3 glow = mix(warm, lin(vec3(0.7, 0.84, 1.0)), step(0.86, fract(h * 3.7)));
                // The odd window flickers like a television
                float flicker = step(0.97, fract(h * 17.3)) * (0.6 + 0.4 * sin(uTime * 9.0 + h * 40.0) * sin(uTime * 3.1));
                float brightness = (0.5 + 1.5 * fract(h * 11.7)) * (1.0 - flicker * 0.5);

                // Average out once a window is smaller than a pixel or two, so the grid never shimmers
                vec2 size = fwidth(cell);
                float detail = 1.0 - smoothstep(0.25, 0.6, max(size.x, size.y));
                float window = mix(litChance * 0.12, pane * lit * brightness, detail);
                color += glow * window * 1.2;
                color += pane * (1.0 - lit) * detail * lin(vec3(0.12, 0.14, 0.2)) * 0.5;
            }

            gl_FragColor = vec4(fogged(color), 1.0);
        }
    `,
});

export const createGroundMaterial = (roads: Texture, mask: Texture) => new ShaderMaterial({
    uniforms: {
        ...cityUniforms,
        uRoads: { value: roads },
        uMask: { value: mask },
        uBounds: { value: [bounds.minX, bounds.minZ, bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ] },
    },
    vertexShader: /* glsl */ `
        ${worldVertex}
        void main() { setWorld(position); }
    `,
    fragmentShader: /* glsl */ `
        ${common}
        uniform sampler2D uRoads;
        uniform sampler2D uMask;
        uniform vec4 uBounds;

        void main() {
            vec2 uv = (vWorld.xz - uBounds.xy) / uBounds.zw;
            vec2 edges = min(uv, 1.0 - uv);
            // Fades the map out towards the edge of the data, into the haze
            float inside = smoothstep(0.0, 0.05, min(edges.x, edges.y));
            vec3 mask = texture2D(uMask, clamp(uv, 0.0, 1.0)).rgb;
            vec3 roads = texture2D(uRoads, clamp(uv, 0.0, 1.0)).rgb * inside;
            float water = mask.r * inside;

            vec3 land = mix(lin(vec3(0.1, 0.09, 0.12)), lin(vec3(0.06, 0.09, 0.07)), mask.g);
            land += roads * 1.1;

            // Water: dark, with the sky glow mirrored at grazing angles and moonlit ripples
            vec3 toCamera = normalize(cameraPosition - vWorld);
            float fresnel = pow(1.0 - max(toCamera.y, 0.0), 5.0);
            vec2 flow = vWorld.xz * 2.2 + vec2(uTime * 0.25, uTime * 0.13);
            float ripple = noise(flow) * 0.6 + noise(flow * 2.7 - uTime * 0.2) * 0.4;
            vec3 sheen = mix(lin(vec3(0.03, 0.04, 0.08)), uFogColor * 1.6, fresnel);
            float glint = smoothstep(0.86, 0.98, ripple) * fresnel;
            vec3 sea = sheen + lin(vec3(0.75, 0.8, 1.0)) * glint * 0.1;

            vec3 color = mix(land, sea, water);
            color = mix(uFogColor * 0.8, color, inside);
            gl_FragColor = vec4(fogged(color), 1.0);
        }
    `,
});

const pointVertex = /* glsl */ `
    uniform float uPointScale;
    uniform float uSize;
    varying float vFade;

    void setPoint(vec3 local) {
        setWorld(local);
        float size = uSize * uPointScale / max(vDepth, 0.1);
        gl_PointSize = max(size, 1.5);
        // Points smaller than they're drawn fade instead, so distant ones don't sparkle
        vFade = clamp(size / 1.5, 0.2, 1.0);
    }
`;

const pointFragment = /* glsl */ `
    varying float vFade;
    varying vec3 vColor;
    void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float alpha = (1.0 - smoothstep(0.0, 1.0, d)) * vFade;
        float density = vDepth * uFogDensity;
        alpha *= exp(-density * density);
        gl_FragColor = vec4(vColor * alpha, 1.0);
    }
`;

const pointMaterial = (size: number, vertexShader: string, fragmentShader: string) => new ShaderMaterial({
    uniforms: { ...cityUniforms, uSize: { value: size } },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
});

export const createLampMaterial = () => pointMaterial(0.16,
    /* glsl */ `
        ${worldVertex}
        ${pointVertex}
        varying vec3 vColor;
        void main() {
            vColor = vec3(1.6, 0.75, 0.3);
            setPoint(position);
        }
    `,
    /* glsl */ `${common}${pointFragment}`,
);

/** Cars as points sliding along their lane segments: headlights one way, tail lights the other. */
export const createTrafficMaterial = () => pointMaterial(0.1,
    /* glsl */ `
        ${worldVertex}
        ${pointVertex}
        uniform float uTime;
        attribute vec4 segment;
        attribute vec3 motion;
        varying vec3 vColor;
        void main() {
            float t = fract(motion.x + uTime * motion.y);
            vec2 at = mix(segment.xy, segment.zw, t);
            // Fade in and out at the ends of the segment, so cars don't pop between them
            float ends = smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.92, t);
            vColor = (motion.z > 0.5 ? vec3(2.4, 2.2, 1.8) : vec3(2.2, 0.15, 0.08)) * ends;
            setPoint(vec3(at.x, 0.06, at.y));
        }
    `,
    /* glsl */ `${common}${pointFragment}`,
);

/**
 * The hand-built landmarks: floodlit from the ground. `glow` per vertex picks the finish:
 * 0 painted or stone, 1 metal shards (glints), 2 lit, 3 blinking aviation light.
 */
export const createLandmarkMaterial = () => new ShaderMaterial({
    uniforms: cityUniforms,
    vertexShader: /* glsl */ `
        ${worldVertex}
        attribute vec3 color;
        attribute float glow;
        varying vec3 vColor;
        varying float vGlow;
        void main() {
            vColor = color;
            vGlow = glow;
            setWorld(position);
        }
    `,
    fragmentShader: /* glsl */ `
        ${common}
        varying vec3 vColor;
        varying float vGlow;

        void main() {
            vec3 n = flatNormal();
            vec3 toCamera = normalize(cameraPosition - vWorld);
            // Floodlights below: strongest low down and on the sides, dim on top
            float side = 0.3 + 0.7 * abs(dot(n, normalize(vec3(0.8, 0.0, 0.6))));
            float falloff = mix(1.0, 0.55, clamp(vWorld.y / 11.0, 0.0, 1.0));
            float light = (0.18 + 0.9 * side * falloff) * (n.y > 0.6 ? 0.45 : 1.0);
            vec3 color = vColor * light;

            if (vGlow > 0.5 && vGlow < 1.5) {
                // Thousands of angled aluminium shards: each catches the light a little differently
                color *= 0.55 + 0.6 * hash(floor(vWorld * vec3(4.0, 5.0, 4.0)));
                float fresnel = pow(1.0 - abs(dot(n, toCamera)), 3.0);
                color += lin(vec3(0.55, 0.7, 0.9)) * fresnel * 0.35;
                float facet = hash(floor(vWorld * 7.0));
                float twinkle = step(0.975, facet) * pow(0.5 + 0.5 * sin(uTime * 2.0 + facet * 60.0), 8.0);
                color += vec3(1.6) * twinkle;
            }
            if (vGlow > 1.5) color = vColor * 3.0;
            if (vGlow > 2.5) color *= step(0.55, fract(uTime * 0.6 + vWorld.x * 0.05));

            gl_FragColor = vec4(fogged(color), 1.0);
        }
    `,
    // Some of the hand-built shapes aren't consistently wound
    side: DoubleSide,
});

/** Lettering painted on a surface: an alpha texture in a flat colour. */
export const createLetteringMaterial = (map: Texture, color: Color) => new ShaderMaterial({
    uniforms: { ...cityUniforms, uMap: { value: map }, uColor: { value: color } },
    vertexShader: /* glsl */ `
        ${worldVertex}
        varying vec2 vUv;
        void main() {
            vUv = uv;
            setWorld(position);
        }
    `,
    fragmentShader: /* glsl */ `
        ${common}
        uniform sampler2D uMap;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
            float alpha = texture2D(uMap, vUv).a;
            if (alpha < 0.05) discard;
            gl_FragColor = vec4(fogged(uColor), alpha);
        }
    `,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
});

/** Night sky over a lit city: orange-violet light pollution at the horizon, the moon above the lough. */
export const createSkyMaterial = () => new ShaderMaterial({
    uniforms: cityUniforms,
    vertexShader: /* glsl */ `
        ${worldVertex}
        void main() { setWorld(position); }
    `,
    fragmentShader: /* glsl */ `
        ${common}
        void main() {
            vec3 dir = normalize(vWorld - cameraPosition);
            float height = dir.y;
            vec3 zenith = lin(vec3(0.03, 0.03, 0.09));
            vec3 color = mix(uFogColor, zenith, smoothstep(-0.02, 0.45, height));
            // A little extra warmth just above the horizon
            color += lin(vec3(0.45, 0.22, 0.15)) * 0.25 * exp(-max(height, 0.0) * 18.0);

            float moon = dot(dir, ${moonDirection});
            color += lin(vec3(0.5, 0.55, 0.75)) * 0.12 * pow(max(moon, 0.0), 60.0);
            color += lin(vec3(0.95, 0.95, 0.88)) * 1.6 * smoothstep(0.99955, 0.99975, moon);

            // Faint stars, where the glow allows
            vec3 cell = floor(dir * 300.0);
            float star = step(0.9993, hash(cell)) * smoothstep(0.15, 0.6, height);
            color += vec3(0.9) * star;

            gl_FragColor = vec4(color, 1.0);
        }
    `,
    side: BackSide,
    depthWrite: false,
});
