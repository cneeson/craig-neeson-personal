import { MathUtils, Vector3 } from 'three';
import { clamp01, lerp } from '@/services/three';
import { createSpline, flightProgressAt, windows } from '@/scene/choreography';

/**
 * The walk through Belfast, timed to the beats (0 → 1 across the flight). Out of the clouds right under
 * Samson and Goliath on a wide lens, backing away from them as the lens narrows so they tower over the
 * reader; west over the water to the SSE Arena; across the Lagan by the Albert Clock and up over City Hall,
 * looking out north-west towards Coleraine and Antrim; down Adelaide Street over the roofs, looking back up
 * it past the offices; over to the Gasworks, looking south-east towards Paris; then north along the Lagan to
 * Lanyon Place and the railway bridge, and back up into the clouds.
 */

// Scene units (10 m): x east, z south, y the height above the ground. `at` is journey progress (see windows),
// `pitch` degrees above the horizon, and `heading` the compass bearing it faces (0 north, 90 east): if unset,
// it's taken from the path, looking back the way it came. `zoom` scales the field of view (1 is the usual lens).
// Placed from the tiles, not OSM: the cranes move along their dock.
interface Waypoint { at: number, x: number, z: number, y: number, pitch: number, heading?: number, zoom?: number }

const [cityFrom, cityTo] = windows.belfast;

const waypoints: Waypoint[] = [
    // Right under the cranes, where they're parked side by side at the end of the dock, looking up at them on a
    // wide lens, then backing away as it narrows (a dolly zoom), so they loom over the reader
    { at: cityFrom, x: 62, z: -3, y: 4.5, pitch: 22, heading: 52, zoom: 1.6 },
    { at: windows.belfastIntro[0], x: 58, z: 0, y: 3.5, pitch: 17, heading: 56, zoom: 1.5 },
    { at: windows.belfastIntro[1], x: 42, z: 7, y: 4.5, pitch: 7, heading: 64, zoom: 1 },
    // West over the water, still looking back at them
    { at: windows.craft[0], x: 33, z: 8, y: 6, pitch: 2, heading: 70 },
    { at: windows.craft[1], x: 20, z: 7, y: 8, pitch: -3, heading: 80 },
    // Round the SSE Arena, looking back at the gig poster on its west side
    { at: windows.skills[0], x: -10, z: 4, y: 5, pitch: 1, heading: 95 },
    { at: windows.skills[1], x: -21, z: 6, y: 6, pitch: 0, heading: 92 },
    // Over the Lagan by the Albert Clock, rising up over City Hall to look out north-west
    { at: windows.rewind[0], x: -45, z: 30, y: 12, pitch: -8 },
    { at: windows.rewind[1], x: -88, z: 74, y: 28, pitch: -6, heading: 330 },
    // Coleraine, then Antrim, through the telescope
    { at: windows.coleraine[0], x: -95, z: 82, y: 34, pitch: 0, heading: 321.8 },
    { at: windows.coleraine[1], x: -96, z: 83, y: 35, pitch: 0, heading: 321.8 },
    { at: windows.antrim[0], x: -96.5, z: 84, y: 35, pitch: 0, heading: 304.2 },
    { at: windows.antrim[1], x: -96, z: 86, y: 33, pitch: -2, heading: 304.2 },
    // Down to Adelaide Street, backing down it just over the roofs (the tiles melt any lower), looking back up
    // it towards City Hall: at Adelaide Exchange (Liberty IT) on the right, then Flax House (Flexera) on the left
    { at: windows.liberty[0], x: -85.6, z: 133, y: 7, pitch: -11, heading: 14 },
    { at: windows.liberty[1], x: -85.4, z: 136, y: 6.8, pitch: -10, heading: 12 },
    { at: windows.flexera[0], x: -85.2, z: 139, y: 6.6, pitch: -11, heading: 353 },
    { at: windows.flexera[1], x: -85.2, z: 142, y: 6.6, pitch: -10, heading: 355 },
    // Over the Gasworks, looking down at Ormeau Business Park (Locate a Locum), then back from it as the arc
    // to Paris (Ankorstore) sets off south-east
    { at: windows.locum[0], x: -70, z: 143, y: 7, pitch: -12, heading: 132 },
    { at: windows.locum[1], x: -69, z: 142, y: 8, pitch: -12, heading: 134 },
    { at: windows.ankorstore[0], x: -80, z: 152, y: 11, pitch: 3, heading: 97 },
    { at: windows.ankorstore[1], x: -83, z: 157, y: 13, pitch: 5, heading: 101 },
    // North along the Lagan to Lanyon Place (Ocula, at Formation Works), watching the train set off over the
    // railway bridge, then climbing away
    { at: windows.ocula[0], x: -24, z: 56, y: 7, pitch: -4, heading: 163 },
    { at: windows.ocula[1], x: -26, z: 38, y: 10, pitch: -7, heading: 167 },
    { at: cityTo - 0.02, x: -28, z: 24, y: 24, pitch: -18 },
    { at: cityTo, x: -30, z: 6, y: 70, pitch: -38 },
];

const knots = waypoints.map(point => flightProgressAt(point.at));
const [xAt, yAt, zAt, pitchAt, zoomAt] = (['x', 'y', 'z', 'pitch', 'zoom'] as const)
    .map(key => createSpline(knots, waypoints.map(point => point[key] ?? 1)));

/** Looking back the way it came at waypoint `i`, from the next waypoint to the previous one (radians). */
const pathHeading = (i: number) => {
    const [behind, ahead] = [waypoints[Math.max(0, i - 1)], waypoints[Math.min(waypoints.length - 1, i + 1)]];
    return Math.atan2(behind.x - ahead.x, ahead.z - behind.z);
};

// Unwrapped, so the camera turns the short way between waypoints
const headings = waypoints.reduce<number[]>((turned, point, i) => {
    const heading = point.heading === undefined ? pathHeading(i) : MathUtils.degToRad(point.heading);
    const previous = turned[i - 1] ?? heading;
    turned.push(previous + MathUtils.euclideanModulo(heading - previous + Math.PI, Math.PI * 2) - Math.PI);
    return turned;
}, []);
const headingAt = createSpline(knots, headings);

/** Where the camera looks at the start and end of the flight (radians), which the dive and climb match. */
export const FLIGHT_ENDS = {
    start: { heading: headingAt(0), pitch: MathUtils.degToRad(waypoints[0].pitch) },
    end: { heading: headingAt(1), pitch: MathUtils.degToRad(waypoints[waypoints.length - 1].pitch) },
};

export const flightAt = (t: number, position: Vector3, target: Vector3) => {
    const time = clamp01(t);
    position.set(xAt(time), yAt(time), zAt(time));
    const [heading, pitch] = [headingAt(time), MathUtils.degToRad(pitchAt(time))];
    target.set(Math.sin(heading) * Math.cos(pitch), Math.sin(pitch), -Math.cos(heading) * Math.cos(pitch))
        .multiplyScalar(50)
        .add(position);
};

/** The city camera's field of view at `t`: wider on portrait screens, which are narrow across. */
export const cityFovAt = (t: number, aspect: number) =>
    Math.min(100, lerp(50, 64, clamp01((1 - aspect) / 0.55)) * zoomAt(clamp01(t)));
