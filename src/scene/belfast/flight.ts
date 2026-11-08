import { MathUtils, Vector3 } from 'three';
import { clamp01, lerp } from '@/services/three';
import { createSpline } from '@/scene/choreography';

/**
 * The flight over Belfast: one straight sweep north-east, never turning. Out of the clouds over the
 * south of the city, down past City Hall to skim the Lagan at the Big Fish, past Titanic Belfast with
 * the cranes off to the right, then up and out over the lough. Only the height and the tilt of the
 * view change (0 → 1 across the flight).
 */

/** The compass bearing of the flight. The dive into the clouds banks round to it (see PlanetScene). */
export const HEADING = MathUtils.degToRad(45);
const forward = { x: Math.sin(HEADING), z: -Math.cos(HEADING) };

// City Hall, the Big Fish and Titanic Belfast all sit within 20 m of this line; this point is midway
// between City Hall and Titanic Belfast
const CENTRE = { x: -32, z: 19.25 };
const [START, END] = [-260, 260];

// A sweep down and back up again, symmetrical about the river
const heightAt = createSpline([0, 0.15, 0.32, 0.5, 0.68, 0.85, 1], [90, 50, 20, 12, 20, 50, 95]);
// Degrees below the horizon: steep where it meets the dive at either end, nearly level when low
const pitchAt = createSpline([0, 0.2, 0.4, 0.6, 0.8, 1], [-38.7, -24, -13, -13, -24, -38.7]);

export const flightAt = (t: number, position: Vector3, target: Vector3) => {
    const time = clamp01(t);
    // Steady over the ground, so the speed carries on from the dive without stopping
    const distance = lerp(START, END, time);
    position.set(CENTRE.x + forward.x * distance, heightAt(time), CENTRE.z + forward.z * distance);
    const pitch = MathUtils.degToRad(pitchAt(time));
    target.set(forward.x * Math.cos(pitch), Math.sin(pitch), forward.z * Math.cos(pitch))
        .multiplyScalar(50)
        .add(position);
};

/** The city camera's field of view: wider on portrait screens, which are narrow across. */
export const cityFovFor = (aspect: number) => lerp(50, 64, clamp01((1 - aspect) / 0.55));
