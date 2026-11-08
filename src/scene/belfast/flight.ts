import { CatmullRomCurve3, Vector3 } from 'three';
import { clamp01 } from '@/services/three';
import { createSpline } from '@/scene/choreography';

/**
 * The flight over Belfast: out of the clouds above the lough, down past Samson & Goliath, round
 * Titanic Belfast, across the Lagan by the Big Fish and the Albert Clock, then up over City Hall
 * and back into the clouds. Each stop is a camera position, where it looks, and when it gets there
 * (0 → 1 across the flight).
 */
const stops: { at: number; position: [number, number, number]; target: [number, number, number] }[] = [
    { at: 0, position: [215, 95, -230], target: [100, 0, -45] },
    { at: 0.07, position: [192, 40, -125], target: [96, 4, -42] },
    // In from the east, so the two cranes stand apart rather than one behind the other
    { at: 0.15, position: [150, 14, -64], target: [88, 6, -36] },
    { at: 0.24, position: [97, 7, -42], target: [66, 8, -14] },
    { at: 0.33, position: [82, 6, -34], target: [45, 3, -46] },
    // Round the front of Titanic Belfast, then turn west for the Lagan
    { at: 0.42, position: [54, 5, -24], target: [33, 2.5, -46] },
    { at: 0.5, position: [32, 5.5, -20], target: [28, 2, -48] },
    { at: 0.56, position: [12, 6, -16], target: [-24, 3, 6] },
    { at: 0.6, position: [-8, 6.5, 4], target: [-44, 2, 28] },
    { at: 0.68, position: [-30, 6.5, 22], target: [-62, 3, 38] },
    { at: 0.79, position: [-54, 8, 47], target: [-95, 3, 80] },
    { at: 0.88, position: [-74, 10, 64], target: [-97, 3, 82] },
    { at: 1, position: [-90, 26, 71], target: [-98, 1, 84] },
];

const positions = new CatmullRomCurve3(stops.map(stop => new Vector3(...stop.position)), false, 'centripetal');
const targets = new CatmullRomCurve3(stops.map(stop => new Vector3(...stop.target)), false, 'centripetal');

/** Flight time → curve parameter. A monotone spline, so the speed changes smoothly through each stop. */
const parameterAt = createSpline(stops.map(stop => stop.at), stops.map((_, i) => i / (stops.length - 1)));

export const flightAt = (t: number, position: Vector3, target: Vector3) => {
    const u = parameterAt(clamp01(t));
    positions.getPoint(u, position);
    targets.getPoint(u, target);
};
