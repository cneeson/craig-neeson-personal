import { CatmullRomCurve3, Vector3 } from 'three';
import { clamp01 } from '@/services/three';
import { createSpline } from '@/scene/choreography';

type Point = [number, number, number];
type Stop = { at: number; point: Point };

/**
 * The flight over Belfast: out of the clouds above the lough, down the dry dock under Samson and
 * then Goliath, one gentle turn towards the city centre, then up over City Hall and back into the
 * clouds. The camera's path and where it looks are timed separately (0 → 1 across the flight), and
 * the view only ever turns one way, so it never swings back and forth.
 */

// The cranes straddle the dock in a line: Samson, then Goliath 70 units on. Their girders are at
// heights 9.3 and 8.3, with 13 units between the legs.
const SAMSON = [110, -61.9];
const DOCK = [-0.647, 0.763];
const alongDock = (distance: number, height: number): Point =>
    [SAMSON[0] + DOCK[0] * distance, height, SAMSON[1] + DOCK[1] * distance];

// From Goliath straight on towards City Hall
const GOLIATH = alongDock(70.5, 4.2);
const CITY_HALL: Point = [-97, 3, 84];
const towardsCityHall = (amount: number, height: number): Point => [
    GOLIATH[0] + (CITY_HALL[0] - GOLIATH[0]) * amount,
    height,
    GOLIATH[2] + (CITY_HALL[2] - GOLIATH[2]) * amount,
];

const path: Stop[] = [
    { at: 0, point: [215, 90, -195] },
    { at: 0.12, point: alongDock(-95, 32) },
    { at: 0.24, point: alongDock(-40, 10) },
    { at: 0.33, point: alongDock(0, 4.6) },
    { at: 0.45, point: GOLIATH },
    { at: 0.6, point: towardsCityHall(0.3, 7) },
    { at: 0.74, point: towardsCityHall(0.55, 9) },
    { at: 0.87, point: towardsCityHall(0.78, 14) },
    // Rising to look down on City Hall
    { at: 1, point: [-86.6, 26, 78] },
];

// Few and far ahead, so the view turns gradually: down the dock, then City Hall
const focus: Stop[] = [
    { at: 0, point: [105, 2, -55] },
    { at: 0.22, point: alongDock(150, 3) },
    { at: 0.42, point: alongDock(170, 3) },
    { at: 0.75, point: CITY_HALL },
    { at: 1, point: [-98, 1, 84] },
];

/** A curve through the stops, and flight time → curve parameter (monotone, so the speed changes smoothly). */
const createRoute = (stops: Stop[]) => {
    const curve = new CatmullRomCurve3(stops.map(stop => new Vector3(...stop.point)), false, 'centripetal');
    const parameterAt = createSpline(stops.map(stop => stop.at), stops.map((_, i) => i / (stops.length - 1)));
    return (t: number, target: Vector3) => curve.getPoint(parameterAt(clamp01(t)), target);
};

const pathAt = createRoute(path);
const focusAt = createRoute(focus);

// Where it looks is averaged over a stretch of the flight, which rounds off any sharp turns
const LOOK_SPREAD = 0.06;
const LOOK_SAMPLES = 7;
const sample = new Vector3();

export const flightAt = (t: number, position: Vector3, target: Vector3) => {
    pathAt(t, position);
    target.set(0, 0, 0);
    for (let i = 0; i < LOOK_SAMPLES; i++) {
        target.add(focusAt(t + LOOK_SPREAD * (i / (LOOK_SAMPLES - 1) - 0.5), sample));
    }
    target.divideScalar(LOOK_SAMPLES);
};
