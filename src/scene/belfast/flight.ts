import { MathUtils, Vector3 } from 'three';
import { clamp01, lerp } from '@/services/three';
import { createSpline } from '@/scene/choreography';

/**
 * The flight over Belfast: one straight sweep north, never turning, the same way the camera faces over
 * the planet. Out of the clouds over the south of the city, down along the Lagan with City Hall off to the
 * left, skimming the river past the Big Fish, then up past Titanic Belfast and the cranes on the right and
 * out towards the lough. Only the height and the tilt of the view change (0 → 1 across the flight).
 */

/**
 * The compass bearing of the flight: north, as the camera dives in from the planet (within a few degrees),
 * so it never turns between the planet and the city. See `diveTowardsHome` in PlanetScene.
 */
export const HEADING = 0;
const forward = { x: Math.sin(HEADING), z: -Math.cos(HEADING) };

// Over the Lagan, which runs north from Ormeau Bridge to the Big Fish; this point is just past the Big Fish,
// where the flight is lowest. City Hall is 600 m to the left, Titanic Belfast 700 m to the right. The ends
// are hidden in the clouds, so the flight runs well beyond what's seen of it.
const CENTRE = { x: -35, z: 25 };
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
