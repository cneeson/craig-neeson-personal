import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { clamp01, lerp, smoothstep } from '@/services/three';

/**
 * The camera's framings over Belfast, and the stops of each part of the site (see director.ts).
 *
 * Scene units (10 m): x east, z south, y the height above the ground. `pitch` is degrees above the horizon,
 * `heading` the compass bearing it faces (0 north, 90 east), and `zoom` scales the field of view (1 is the usual
 * lens). Placed from the tiles, not OSM: the cranes move along their dock.
 */
export interface Pose { x: number, y: number, z: number, pitch: number, heading: number, zoom: number }
export type ShotPose = Omit<Pose, 'zoom'> & { zoom?: number };

export interface Shot {
    /** Where the camera arrives. */
    pose: ShotPose;
    /** Where it drifts on to while it's held there, over `driftFor` seconds, so the city never sits still. */
    drift?: Partial<ShotPose>;
    driftFor?: number;
    /** A framing that moves with the time (s) instead, such as the hover over the city. */
    at?: (time: number) => Pose;
}

const withZoom = (pose: ShotPose): Pose => ({ zoom: 1, ...pose });

/** `to` as a heading (degrees) the short way round from `from`, so turning between them never goes the long way. */
export const nearestHeading = (from: number, to: number) => from + MathUtils.euclideanModulo(to - from + 180, 360) - 180;

/** Where a shot's camera is `held` seconds after arriving, at `time` (s). */
export const poseOf = (shot: Shot, held: number, time: number): Pose => {
    if (shot.at) return shot.at(time);
    const pose = withZoom(shot.pose);
    if (!shot.drift) return pose;
    const t = smoothstep(clamp01(held / (shot.driftFor ?? 14)));
    const to = { ...pose, ...shot.drift };
    return {
        x: lerp(pose.x, to.x, t), y: lerp(pose.y, to.y, t), z: lerp(pose.z, to.z, t),
        pitch: lerp(pose.pitch, to.pitch, t), heading: lerp(pose.heading, nearestHeading(pose.heading, to.heading), t), zoom: lerp(pose.zoom, to.zoom, t),
    };
};

/**
 * The hover over the city: high over the south of the centre, looking north across it to the docks and the
 * lough, sweeping slowly from side to side rather than circling, so the tiles it needs barely change.
 */
const HOVER = { centre: new Vector3(-30, 0, 20), radius: 130, height: 62, bearing: 205, sweep: 26, period: 140 };
const hoverAt = (time: number): Pose => {
    const bearing = HOVER.bearing + HOVER.sweep * Math.sin((time / HOVER.period) * Math.PI * 2);
    const radians = MathUtils.degToRad(bearing);
    const [x, z] = [HOVER.centre.x + Math.sin(radians) * HOVER.radius, HOVER.centre.z - Math.cos(radians) * HOVER.radius];
    return { x, y: HOVER.height, z, pitch: -19, heading: MathUtils.euclideanModulo(bearing + 180, 360), zoom: 1 };
};

export const shots = {
    /** Out of the clouds, right under the cranes on a wide lens, where the glide from orbit ends. */
    arrival: { pose: { x: 62, z: -3, y: 4.5, pitch: 22, heading: 52, zoom: 1.6 } },
    home: { pose: hoverAt(0), at: hoverAt },

    // About: under the H&W cranes, backing away from them as the lens narrows (a dolly zoom) so they loom over
    // the reader, then west over the water, still looking back at them
    hello: {
        pose: { x: 58, z: 0, y: 3.5, pitch: 17, heading: 56, zoom: 1.5 },
        drift: { x: 44, z: 6.5, y: 4.5, pitch: 8, heading: 63, zoom: 1.05 },
        driftFor: 12,
    },
    craft: {
        pose: { x: 33, z: 8, y: 6, pitch: 2, heading: 70 },
        drift: { x: 20, z: 7, y: 8, pitch: -3, heading: 80 },
    },

    // Experience: high over the south-west of the centre, with all the offices in view, then each in turn
    overview: {
        pose: { x: -160, z: 215, y: 95, pitch: -24, heading: 38 },
        drift: { x: -150, z: 205, heading: 42 },
        driftFor: 30,
    },
    // Up over City Hall, looking out through the telescope at Coleraine, then Antrim
    coleraine: { pose: { x: -95, z: 82, y: 34, pitch: 0, heading: 321.8 }, drift: { x: -96, z: 83, y: 35 } },
    antrim: { pose: { x: -96.5, z: 84, y: 35, pitch: 0, heading: 304.2 }, drift: { x: -96, z: 86, y: 33, pitch: -2 } },
    // Backing down Adelaide Street just over the roofs (the tiles melt any lower), looking back up it towards City
    // Hall: Adelaide Exchange (Liberty IT) on the right, then Flax House (Flexera) on the left
    liberty: { pose: { x: -85.6, z: 133, y: 7, pitch: -11, heading: 14 }, drift: { x: -85.4, z: 136, y: 6.8, pitch: -10, heading: 12 } },
    flexera: { pose: { x: -85.2, z: 139, y: 6.6, pitch: -11, heading: 353 }, drift: { x: -85.2, z: 142, y: 6.8, pitch: -10, heading: 1 } },
    // Over the Gasworks, looking down at Ormeau Business Park (Locate a Locum), then back from it as the arc to Paris
    // (Ankorstore) sets off south-east
    locum: { pose: { x: -75, z: 145, y: 7, pitch: -12, heading: 127 }, drift: { x: -74, z: 144, y: 8, pitch: -12, heading: 134 } },
    ankorstore: { pose: { x: -80, z: 152, y: 11, pitch: 3, heading: 104 }, drift: { x: -79, z: 148, y: 14, pitch: 4, heading: 116 } },
    // Lanyon Place (Ocula, at Formation Works), watching the train set off over the railway bridge
    ocula: { pose: { x: -24, z: 56, y: 7, pitch: -4, heading: 163 }, drift: { x: -26, z: 38, y: 10, pitch: -7, heading: 167 }, driftFor: 20 },

    // Skills: across the water from the Titanic Quarter, round the SSE Arena to the gig poster, then over the Lagan
    // looking up at the Obel and the Big Fish
    docks: {
        pose: { x: -60, z: -20, y: 22, pitch: -6, heading: 72 },
        drift: { x: -54, z: -22, y: 23, heading: 70 },
        driftFor: 20,
    },
    arena: { pose: { x: -10, z: 4, y: 5, pitch: 1, heading: 95 }, drift: { x: -21, z: 6, y: 6, pitch: 0, heading: 92 } },
    lagan: {
        pose: { x: -5, z: 60, y: 14, pitch: -6, heading: 300 },
        drift: { x: -8, z: 62, y: 15, heading: 302 },
        driftFor: 20,
    },
} satisfies Record<string, Shot>;

export type ShotName = keyof typeof shots;

/** Where the camera looks as the glide from orbit hands over to the city, and as the climb back out sets off. */
export const CITY_ENDS = {
    start: { heading: MathUtils.degToRad(shots.arrival.pose.heading), pitch: MathUtils.degToRad(shots.arrival.pose.pitch) },
    end: { heading: MathUtils.degToRad(174), pitch: MathUtils.degToRad(-38) },
};

/** The city camera's field of view: wider on portrait screens, which are narrow across. */
export const cityFov = (zoom: number, aspect: number) => Math.min(100, lerp(50, 64, clamp01((1 - aspect) / 0.55)) * zoom);

/** How far (degrees) portrait screens look further down, so the city fills the screen above the panels. */
const PORTRAIT_TILT = -9;

const target = new Vector3();
/** Puts `camera` at `pose` (with its lens, for `aspect`). */
export const placeCamera = (camera: PerspectiveCamera, pose: Pose, aspect: number) => {
    const fov = cityFov(pose.zoom, aspect);
    if (camera.fov !== fov || camera.aspect !== aspect) {
        [camera.fov, camera.aspect] = [fov, aspect];
        camera.updateProjectionMatrix();
    }
    const tilt = PORTRAIT_TILT * clamp01((1 - aspect) / 0.55);
    const [heading, pitch] = [MathUtils.degToRad(pose.heading), MathUtils.degToRad(pose.pitch + tilt)];
    camera.position.set(pose.x, pose.y, pose.z);
    target.set(Math.sin(heading) * Math.cos(pitch), Math.sin(pitch), -Math.cos(heading) * Math.cos(pitch)).add(camera.position);
    camera.lookAt(target);
};
