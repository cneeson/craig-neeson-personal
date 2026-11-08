import { MathUtils, Vector3 } from 'three';
import { clamp01, lerp } from '@/services/three';
import { createSpline } from '@/scene/choreography';

/**
 * The flight over Belfast, flown backwards: the camera always faces north-east, out towards the lough,
 * while it travels south-west. It drops out of the clouds over the dry dock and backs down it, under
 * Samson and Goliath between their legs, then winds low past Titanic Belfast, over the Lagan at the Big Fish
 * and over City Hall, before rising back up into the clouds (0 → 1 across the flight).
 */

/**
 * The compass bearing the camera faces. The cranes line up along it exactly, at right angles to their
 * girders. The dive from the planet turns to it as it tilts up (see `diveTowardsHome` in PlanetScene).
 */
export const HEADING = MathUtils.degToRad(40);
const forward = { x: Math.sin(HEADING), z: -Math.cos(HEADING) };

// Scene units (10 m): x east, z south, y the height above the ground, pitch in degrees above the horizon
const waypoints: { x: number, z: number, y: number, pitch: number }[] = [
    // In the clouds, out along the dry dock
    { x: 126, z: -81, y: 30, pitch: -8 },
    // Backing down the dock over the ship in it
    { x: 85, z: -33, y: 9, pitch: -2 },
    // Under the cranes, parked side by side at the end of the dock (in the tiles; OSM has Samson further
    // up), looking up a little to see their girders go overhead
    { x: 69, z: -13, y: 5, pitch: 4 },
    { x: 65, z: -8.5, y: 5, pitch: 4 },
    { x: 55, z: 4, y: 5.5, pitch: 0 },
    // Sideways round the dock beside Titanic Belfast
    { x: 22, z: -28, y: 7, pitch: -4 },
    // Low over the Lagan at the Big Fish
    { x: -38, z: 37, y: 3.5, pitch: -6 },
    // Over City Hall, then climbing away into the clouds
    { x: -97, z: 84, y: 10, pitch: -18 },
    { x: -150, z: 140, y: 75, pitch: -38 },
];

// Spaced by the distance between waypoints, so the speed stays fairly even
const distances = waypoints.map((point, i) => (i === 0 ? 0 : Math.hypot(
    point.x - waypoints[i - 1].x, point.y - waypoints[i - 1].y, point.z - waypoints[i - 1].z,
)));
const total = distances.reduce((sum, distance) => sum + distance, 0);
let travelled = 0;
const knots = distances.map(distance => (travelled += distance) / total);
const [xAt, yAt, zAt, pitchAt] = (['x', 'y', 'z', 'pitch'] as const)
    .map(key => createSpline(knots, waypoints.map(point => point[key])));

/** Where the camera looks at the start and end of the flight, in radians above the horizon. */
export const FLIGHT_PITCH = {
    start: MathUtils.degToRad(waypoints[0].pitch),
    end: MathUtils.degToRad(waypoints[waypoints.length - 1].pitch),
};

export const flightAt = (t: number, position: Vector3, target: Vector3) => {
    const time = clamp01(t);
    position.set(xAt(time), yAt(time), zAt(time));
    const pitch = MathUtils.degToRad(pitchAt(time));
    target.set(forward.x * Math.cos(pitch), Math.sin(pitch), forward.z * Math.cos(pitch))
        .multiplyScalar(50)
        .add(position);
};

/** The city camera's field of view: wider on portrait screens, which are narrow across. */
export const cityFovFor = (aspect: number) => lerp(50, 64, clamp01((1 - aspect) / 0.55));
