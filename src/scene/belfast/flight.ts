import { MathUtils, Vector3 } from 'three';
import { clamp01, lerp } from '@/services/three';
import { createSpline } from '@/scene/choreography';

/**
 * The flight over Belfast, flown backwards: the camera looks back the way it came, turning naturally as
 * the path bends. It drops out of the clouds just short of Samson and Goliath, backs down between their legs,
 * then low over the SSE Arena, across the Lagan by the Dargan (rail) Bridge, over the weir and on over the city
 * centre, rising back up into the clouds (0 → 1 across the flight).
 */

// Scene units (10 m): x east, z south, y the height above the ground, pitch in degrees above the horizon.
// `pace` slows the stretch arriving at a waypoint. Placed from the tiles, not OSM: the cranes move along their dock.
const waypoints: { x: number, z: number, y: number, pitch: number, pace?: number }[] = [
    // In the clouds over the end of the dock, tilted down to match the glide in from orbit
    { x: 80, z: -27, y: 16, pitch: -20 },
    // Under the cranes, parked side by side at the end of the dock, looking up a little at their girders.
    // Sinking down to them slowly, so the clouds have cleared before the camera passes under.
    { x: 69, z: -13, y: 5, pitch: 4, pace: 0.25 },
    { x: 65, z: -8.5, y: 5, pitch: 4 },
    // Over the SSE Arena
    { x: 5, z: 2, y: 7, pitch: -6 },
    // Across the Lagan beside the M3 and Dargan bridges, then over the weir
    { x: -35, z: 13, y: 3.5, pitch: -4 },
    { x: -42, z: 40, y: 4.5, pitch: -6 },
    // Over the city centre, then climbing away into the clouds
    { x: -97, z: 84, y: 14, pitch: -20 },
    { x: -150, z: 140, y: 75, pitch: -38 },
];

// Spaced by the distance between waypoints (over its pace), so the speed stays fairly even
const distances = waypoints.map((point, i) => (i === 0 ? 0 : Math.hypot(
    point.x - waypoints[i - 1].x, point.y - waypoints[i - 1].y, point.z - waypoints[i - 1].z,
) / (point.pace ?? 1)));
const total = distances.reduce((sum, distance) => sum + distance, 0);
let travelled = 0;
const knots = distances.map(distance => (travelled += distance) / total);
const [xAt, yAt, zAt, pitchAt] = (['x', 'y', 'z', 'pitch'] as const)
    .map(key => createSpline(knots, waypoints.map(point => point[key])));

/** How far either side along the flight the facing is taken from, which smooths out the turns. */
const TURN_SPAN = 0.08;

/**
 * The compass bearing the camera faces at `t`: back along the path, from a little way ahead of it
 * to a little way behind.
 */
const headingAt = (t: number) => {
    const [ahead, behind] = [clamp01(t + TURN_SPAN), clamp01(t - TURN_SPAN)];
    return Math.atan2(xAt(behind) - xAt(ahead), zAt(ahead) - zAt(behind));
};

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

/** The city camera's field of view: wider on portrait screens, which are narrow across. */
export const cityFovFor = (aspect: number) => lerp(50, 64, clamp01((1 - aspect) / 0.55));
