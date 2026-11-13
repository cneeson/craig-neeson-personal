import {
    AdditiveBlending, BufferAttribute, BufferGeometry, Camera, MathUtils, Mesh, ShaderMaterial, Vector2, Vector3,
    WebGLRenderer,
} from 'three';

/**
 * Now and then, a shooting star: a short streak falling across part of the view, brightening and gone in under a
 * second. Rare enough to be a surprise (every `EVERY` seconds or so), never with reduced motion. Like the stars, it's
 * on the sky (kept around the camera), behind the planet.
 */

/** Seconds between them, at random in this range (and before the first). */
const EVERY = [25, 45];
const FIRST = [8, 16];
/** Seconds each lasts. */
const DURATION = 0.9;
/** How far it travels (radians of sky) and how much of that its tail trails. */
const ARC = [0.2, 0.32];
const TRAIL = 0.4;
/** Width at its head (CSS pixels). */
const WIDTH = 1.8;
const SEGMENTS = 40;
const RADIUS = 250;

export const createShootingStar = (renderer: WebGLRenderer) => {
    // A strip along it: `aAlong` 0 at the tail to 1 at the head, `aSide` across
    const along = new Float32Array((SEGMENTS + 1) * 2);
    const side = new Float32Array((SEGMENTS + 1) * 2);
    const index: number[] = [];
    for (let i = 0; i <= SEGMENTS; i++) {
        along.set([i / SEGMENTS, i / SEGMENTS], i * 2);
        side.set([1, -1], i * 2);
        if (i < SEGMENTS) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const geometry = new BufferGeometry();
    // Placed in the shader; three just needs to know how many there are
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(along.length * 3), 3));
    geometry.setAttribute('aAlong', new BufferAttribute(along, 1));
    geometry.setAttribute('aSide', new BufferAttribute(side, 1));
    geometry.setIndex(index);

    const material = new ShaderMaterial({
        uniforms: {
            uStart: { value: new Vector3() },
            uTravel: { value: new Vector3() },
            uHead: { value: 0 },
            uTrail: { value: 0 },
            uWidth: { value: WIDTH },
            uResolution: { value: new Vector2(1, 1) },
            uBrightness: { value: 0 },
        },
        vertexShader: /* glsl */ `
            attribute float aAlong;
            attribute float aSide;
            uniform vec3 uStart;
            uniform vec3 uTravel;
            uniform float uHead;
            uniform float uTrail;
            uniform float uWidth;
            uniform vec2 uResolution;
            varying float vAlong;
            varying float vSide;
            vec4 onSky(float s) {
                return projectionMatrix * modelViewMatrix * vec4(normalize(uStart + uTravel * s) * ${RADIUS.toFixed(1)}, 1.0);
            }
            void main() {
                float s = uHead - (1.0 - aAlong) * uTrail;
                vec4 here = onSky(s);
                vec4 ahead = onSky(s + 0.002);
                // Widened square to its path on the screen, a set number of pixels, tapering to the tail
                vec2 path = normalize((ahead.xy / ahead.w - here.xy / here.w) * uResolution);
                here.xy += vec2(-path.y, path.x) * aSide * uWidth * mix(0.3, 1.0, aAlong) / uResolution * 2.0 * here.w;
                vAlong = aAlong;
                vSide = aSide;
                gl_Position = here;
            }`,
        fragmentShader: /* glsl */ `
            uniform float uBrightness;
            varying float vAlong;
            varying float vSide;
            void main() {
                float light = exp(-vSide * vSide * 4.0) * pow(vAlong, 2.5) * uBrightness;
                // Blue-white along the tail, warming at the head
                gl_FragColor = vec4(mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.96, 0.9), vAlong) * light, 1.0);
            }`,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
    });

    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = -4;
    mesh.visible = false;

    const { uniforms } = material;
    const random = ([from, to]: number[]) => MathUtils.lerp(from, to, Math.random());
    let wait = random(FIRST);
    let age = -1;
    let arc = 0;
    const forward = new Vector3();
    const right = new Vector3();
    const up = new Vector3();

    /** Somewhere in the camera's view, falling at an angle. */
    const launch = (camera: Camera) => {
        camera.matrixWorld.extractBasis(right, up, forward);
        forward.negate();
        uniforms.uStart.value.copy(forward)
            .addScaledVector(right, random([-0.45, 0.45]))
            .addScaledVector(up, random([-0.05, 0.3]))
            .normalize();
        const angle = MathUtils.degToRad(random([200, 250]) + (Math.random() < 0.5 ? 0 : 110));
        const travel = uniforms.uTravel.value.copy(right).multiplyScalar(Math.cos(angle)).addScaledVector(up, Math.sin(angle));
        travel.addScaledVector(uniforms.uStart.value, -travel.dot(uniforms.uStart.value)).normalize();
        arc = random(ARC);
        uniforms.uTrail.value = arc * TRAIL;
        renderer.getDrawingBufferSize(uniforms.uResolution.value);
        uniforms.uWidth.value = WIDTH * renderer.getPixelRatio();
        age = 0;
    };

    return {
        mesh,

        /** Every frame. Only launched while `isOn` (the sky in view), but one under way finishes. */
        update(camera: Camera, delta: number, isOn: boolean) {
            mesh.position.copy(camera.position);
            if (age < 0) {
                mesh.visible = false;
                wait -= delta;
                if (wait > 0 || !isOn) return;
                wait = random(EVERY);
                launch(camera);
            }
            age += delta / DURATION;
            if (age >= 1) {
                age = -1;
                mesh.visible = false;
                return;
            }
            mesh.visible = true;
            // Speeding up a little as it burns, flaring then fading
            uniforms.uHead.value = arc * (age * 0.7 + age * age * 0.3);
            uniforms.uBrightness.value = 0.9 * MathUtils.smoothstep(age, 0, 0.15) * (1 - MathUtils.smoothstep(age, 0.55, 1));
        },

        dispose() {
            geometry.dispose();
            material.dispose();
        },
    };
};
