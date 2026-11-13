import {
    BoxGeometry, BufferAttribute, BufferGeometry, CatmullRomCurve3, Color, CylinderGeometry, IUniform, MathUtils, Mesh,
    PlaneGeometry, ShaderMaterial, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CLOUD_SHADE_GLSL, CLOUD_SHADOW_GLSL, cloudShadowUniforms, photoUniforms } from './photo-materials';

/**
 * Belfast City (George Best) Airport's runway, 04/22, from OpenStreetMap: its 22 threshold at the north-east end
 * and its 04 threshold at the south-west, x, z in scene units (10 m). The height is the tarmac's, from the tiles.
 */
const THRESHOLD_22 = new Vector3(326, 0.1, -230.4);
const THRESHOLD_04 = new Vector3(222, 0.1, -81.4);

/**
 * The take-off: down runway 22 towards the south-west, lifting off two thirds of the way along, then climbing out in
 * a right turn onto west, which brings it towards the reader (looking east past the cranes in the craft beat) over
 * the cranes and on overhead, then on west, climbing away until it's lost in the haze several kilometres out (see
 * FADES_FROM). Steeper, tighter and lower than a real departure, so it reads. x, height, z in scene units.
 */
const LIFT_OFF = new Vector3().lerpVectors(THRESHOLD_22, THRESHOLD_04, 0.65);
const PATH = new CatmullRomCurve3([
    THRESHOLD_22, LIFT_OFF, new Vector3(222, 4, -81.4), new Vector3(195, 9, -48), new Vector3(165, 13, -25),
    new Vector3(130, 16, -12), new Vector3(95, 18, -5), new Vector3(60, 20, -2), new Vector3(25, 22, -2),
    new Vector3(-15, 24, -5), new Vector3(-60, 26, -12), new Vector3(-120, 29, -22), new Vector3(-200, 33, -36),
    new Vector3(-320, 39, -55), new Vector3(-480, 47, -80), new Vector3(-700, 58, -115),
], false, 'centripetal');
const PATH_LENGTH = PATH.getLength();
const ROLL = THRESHOLD_22.distanceTo(LIFT_OFF);
/** How far along the path it is when it's passing over the reader, beside the cranes (scene units). */
const OVERHEAD = 372;
/** How far along the path it starts to fade into the haze, so it's gone by the end, wherever it's seen from. */
const FADES_FROM = PATH_LENGTH - 300;

/**
 * When it lifts off and when it's overhead (seconds into each flight, see update), passing over the cranes. It
 * rolls from a standstill, speeding up to its climbing speed by the lift-off.
 */
const LIFTS_OFF = 24;
const PASSES_OVER = 40;
/** Scene units a second. */
const CLIMB_SPEED = (OVERHEAD - ROLL) / (PASSES_OVER - LIFTS_OFF);
const ROLLS_FROM = LIFTS_OFF - (2 * ROLL) / CLIMB_SPEED;

/** Bigger than an A320, about the size of a 757, so it reads against the sky. */
const SCALE = 1.6;

/** How high the middle of the fuselage sits above the wheels. */
const RIDE_HEIGHT = 0.3;

// An Airbus A320, in scene units: 37.6 m long, a 35.8 m span, 4 m across the fuselage. Along +x, wings along z.
const LENGTH = 3.76;
const RADIUS = 0.2;
const NOSE = 0.42;
const TAIL_CONE = 0.95;

const WHITE = '#f1f2f4';
const BELLY = '#b9bec6';
const TAIL = '#00845a';
const ENGINE = '#d9dce0';
const INTAKE = '#2a2d31';
const GEAR = '#3a3c40';
const LAMP = '#fff4dc';

/** Each vertex's colour and how it's drawn: 0 lit, 1 a landing light (a glowing billboard round `position`). */
const colored = (geometry: BufferGeometry, color: string, glow = 0) => {
    const part = geometry.index ? geometry.toNonIndexed() : geometry;
    part.deleteAttribute('normal');
    part.deleteAttribute('uv');
    const linear = new Color(color).convertSRGBToLinear();
    const count = part.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) linear.toArray(colors, i * 3);
    part.setAttribute('color', new BufferAttribute(colors, 3));
    part.setAttribute('glow', new BufferAttribute(new Float32Array(count).fill(glow), 1));
    if (!part.attributes.corner) part.setAttribute('corner', new BufferAttribute(new Float32Array(count * 2), 2));
    return part;
};

/** A box from x0 to x1 along the plane, y0 to y1, `halfWidth` either side. */
const box = (x0: number, x1: number, y0: number, y1: number, halfWidth: number) =>
    new BoxGeometry(x1 - x0, y1 - y0, halfWidth * 2).translate((x0 + x1) / 2, (y0 + y1) / 2, 0);

/** A cylinder along x from x0 to x1, its radius going from r0 to r1, eight-sided like everything else here. */
const tube = (x0: number, x1: number, r0: number, r1: number) =>
    new CylinderGeometry(r1, r0, x1 - x0, 8).rotateZ(-Math.PI / 2).translate((x0 + x1) / 2, 0, 0);

/**
 * A tapered, swept slab: a wing, tailplane or fin. `root` and `tip` are where its leading edge starts and ends;
 * the chord runs back (-x) from there. The thickness is across the slab: y, or z if it's `upright`.
 */
const panel = (root: Vector3, tip: Vector3, rootChord: number, tipChord: number, thickness: number, upright = false) => {
    const geometry = new BoxGeometry(1, 1, 1).translate(0.5, 0, 0.5);
    const position = geometry.attributes.position;
    const point = new Vector3();
    for (let i = 0; i < position.count; i++) {
        const [chordwise, across, spanwise] = [position.getX(i), position.getY(i), position.getZ(i)];
        point.lerpVectors(root, tip, spanwise);
        point.x -= chordwise * MathUtils.lerp(rootChord, tipChord, spanwise);
        if (upright) point.z += across * thickness;
        else point.y += across * thickness;
        position.setXYZ(i, point.x, point.y, point.z);
    }
    return geometry;
};

/** A landing light: a square that the vertex shader turns to face the camera, at `centre`. */
const lamp = (centre: Vector3) => {
    const geometry = colored(new PlaneGeometry(0, 0).translate(centre.x, centre.y, centre.z), LAMP, 1);
    geometry.setAttribute('corner', new BufferAttribute(new Float32Array([-1, 1, -1, -1, 1, 1, -1, -1, 1, -1, 1, 1]), 2));
    return geometry;
};

const createAirliner = () => {
    const parts: BufferGeometry[] = [];
    const [front, back] = [LENGTH / 2, -LENGTH / 2];

    // Fuselage: the nose, a long white tube with a grey fairing where the wings meet it, and the tail cone
    parts.push(colored(tube(front - NOSE, front, RADIUS, 0.04), WHITE));
    parts.push(colored(tube(back + TAIL_CONE, front - NOSE, RADIUS, RADIUS), WHITE));
    parts.push(colored(box(-0.6, 0.7, -0.22, -0.08, 0.17), BELLY));
    const cone = tube(back, back + TAIL_CONE, 0.05, RADIUS);
    // Keep its top level with the fuselage's, so it tapers from below
    const position = cone.attributes.position;
    for (let i = 0; i < position.count; i++) {
        const radius = MathUtils.lerp(0.05, RADIUS, (position.getX(i) - back) / TAIL_CONE);
        position.setY(i, position.getY(i) + RADIUS - radius);
    }
    parts.push(colored(cone, WHITE));

    // Wings, swept back 25°, low on the fuselage with a little dihedral
    for (const side of [-1, 1]) {
        parts.push(colored(panel(new Vector3(0.5, -0.12, 0), new Vector3(-0.32, 0.02, side * 1.79), 0.75, 0.17, 0.05), WHITE));
        parts.push(colored(panel(new Vector3(back + 0.62, 0.06, 0), new Vector3(back + 0.28, 0.08, side * 0.63), 0.42, 0.16, 0.03), WHITE));

        // An engine under each wing, its pylon and dark intake
        const z = side * 0.58;
        const nacelle = colored(tube(0.18, 0.62, 0.1, 0.1).translate(0, -0.2, z), ENGINE);
        parts.push(nacelle, colored(box(0.25, 0.55, -0.12, -0.08, 0.015).translate(0, 0, z), ENGINE));
        parts.push(colored(tube(0.62, 0.625, 0.085, 0.085).translate(0, -0.2, z), INTAKE));

        // Main gear, down for landing
        parts.push(colored(box(-0.12, 0.02, -RIDE_HEIGHT, -0.12, 0.03).translate(0, 0, side * 0.22), GEAR));
    }
    // Nose gear
    parts.push(colored(box(front - 0.55, front - 0.48, -RIDE_HEIGHT, -0.15, 0.025), GEAR));

    // The fin, in the airline's colour
    parts.push(colored(panel(new Vector3(back + 0.72, RADIUS * 0.8, 0), new Vector3(back + 0.2, 0.86, 0), 0.62, 0.28, 0.035, true), TAIL));

    // Landing lights in the wing roots, and the taxi light on the nose gear
    for (const side of [-1, 1]) parts.push(lamp(new Vector3(0.42, -0.12, side * 0.3)));
    parts.push(lamp(new Vector3(front - 0.5, -0.22, 0)));
    return mergeGeometries(parts);
};

/** How far along the path it is `time` seconds in: speeding up evenly down the runway, then climbing steadily. */
const distanceAt = (time: number) => {
    if (time < LIFTS_OFF) return (CLIMB_SPEED * (time - ROLLS_FROM) ** 2) / (2 * (LIFTS_OFF - ROLLS_FROM));
    return ROLL + CLIMB_SPEED * (time - LIFTS_OFF);
};

/** How far it banks (radians) per radian of turn per unit of path, and the most it banks. */
const BANKING = 60;
const MAX_BANK = MathUtils.degToRad(28);

/**
 * An airliner taking off from runway 22 at Belfast City Airport: a hand-built A320 in white with a green tail, wheels
 * down and landing lights on. It rolls down the runway behind the cranes at the end of the intro, lifts off and
 * climbs across the sky in a banked turn through the craft beat, moved by the scroll (see PATH). The
 * landing lights are billboards that never shrink below a few pixels, bright enough for the bloom, so the plane
 * reads from a long way out. Unlit apart from a little shading from the sun, like the tiles.
 */
export const createPlane = (sun: IUniform<Vector3>) => {
    const geometry = createAirliner();
    const material = new ShaderMaterial({
        uniforms: { uSun: sun, uFade: { value: 1 }, ...photoUniforms, ...cloudShadowUniforms },
        vertexShader: /* glsl */ `
            attribute vec3 color;
            attribute float glow;
            attribute vec2 corner;
            varying vec3 vColor;
            varying float vGlow;
            varying vec2 vCorner;
            varying vec3 vWorld;
            void main() {
                vColor = color;
                vGlow = glow;
                vCorner = corner;
                vec4 world = modelMatrix * vec4(position, 1.0);
                vWorld = world.xyz;
                // Lights are drawn a little towards the camera, in front of the wing they sit in
                if (glow > 0.5) world.xyz += normalize(cameraPosition - world.xyz) * 0.3;
                gl_Position = projectionMatrix * viewMatrix * world;
                if (glow > 0.5) {
                    // Brightest seen from ahead, as the lights point forwards
                    vec3 forward = normalize(mat3(modelMatrix) * vec3(1.0, 0.0, 0.0));
                    float beam = smoothstep(-0.3, 0.8, dot(forward, normalize(cameraPosition - world.xyz)));
                    vGlow = 1.0 + beam;
                    // 1.2 m across, but never less than a few pixels
                    float size = max(0.06 * projectionMatrix[1][1] / gl_Position.w, 0.0015 + 0.0015 * beam);
                    gl_Position.xy += corner * size * vec2(projectionMatrix[0][0] / projectionMatrix[1][1], 1.0)
                        * gl_Position.w;
                }
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 uSun;
            uniform vec3 uFogColor;
            uniform float uFogDensity;
            uniform float uFade;
            varying vec3 vColor;
            varying float vGlow;
            varying vec2 vCorner;
            varying vec3 vWorld;
            ${CLOUD_SHADOW_GLSL}
            void main() {
                float distance = length(cameraPosition - vWorld);
                // Lost in the haze at the end of its flight (uFade, 1 → 0)
                float haze = max(1.0 - exp(-pow(distance * uFogDensity, 2.0)), 1.0 - uFade);
                if (vGlow > 0.5) {
                    // A round light, over the bloom's threshold but not by much, that cuts through the haze until it fades
                    if (dot(vCorner, vCorner) > 1.0) discard;
                    vec3 light = vColor * (0.45 + 0.55 * vGlow) * (1.0 - 0.5 * haze);
                    gl_FragColor = vec4(mix(uFogColor, light, uFade), 1.0);
                    return;
                }
                vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
                float sunlit = cloudShadow(vWorld.xz);
                float light = 0.75 + 0.35 * max(dot(n, uSun), 0.0) * sunlit + 0.1 * n.y;
                vec3 color = vColor * light * mix(${CLOUD_SHADE_GLSL}, vec3(1.0), sunlit);
                gl_FragColor = vec4(mix(color, uFogColor, haze), 1.0);
            }
        `,
    });

    const mesh = new Mesh(geometry, material);
    mesh.visible = false;
    // Far longer than the plane once a light is drawn at a few pixels across
    mesh.frustumCulled = false;
    mesh.scale.setScalar(SCALE);
    const [position, ahead, tangent, next] = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
    const yawOf = (direction: Vector3) => Math.atan2(-direction.z, direction.x);

    return {
        object: mesh,

        /** Every frame while the city is shown, with the seconds into this flight. */
        update(time: number) {
            const distance = distanceAt(time);
            // Waiting at the end of the runway, too far off to notice, until it rolls; gone once it's turned away
            mesh.visible = time > ROLLS_FROM && distance < PATH_LENGTH;
            if (!mesh.visible) return;
            material.uniforms.uFade.value = 1 - MathUtils.smoothstep(distance, FADES_FROM, PATH_LENGTH);
            const u = distance / PATH_LENGTH;
            PATH.getPointAt(u, position);
            PATH.getTangentAt(u, tangent);
            PATH.getTangentAt(Math.min(1, u + 0.01), next);
            ahead.copy(tangent).setY(0).normalize();
            mesh.position.copy(position);
            mesh.position.y = Math.max(position.y, THRESHOLD_22.y) + RIDE_HEIGHT * SCALE;
            // Banked into the turn (right wing down as it turns right), and nose up as it rotates and climbs
            const turn = MathUtils.euclideanModulo(yawOf(next) - yawOf(tangent) + Math.PI, Math.PI * 2) - Math.PI;
            const bank = MathUtils.clamp((-turn / (0.01 * PATH_LENGTH)) * BANKING, -MAX_BANK, MAX_BANK);
            const rotating = MathUtils.smoothstep(distance, ROLL - 8, ROLL + 4);
            const climb = Math.atan2(tangent.y, Math.hypot(tangent.x, tangent.z));
            mesh.rotation.set(bank, yawOf(ahead), climb + MathUtils.degToRad(6) * rotating, 'YZX');
        },

        dispose() {
            geometry.dispose();
            material.dispose();
        },
    };
};
