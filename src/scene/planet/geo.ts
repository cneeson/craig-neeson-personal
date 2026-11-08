import { MathUtils, Vector3 } from 'three';

/** Where the earth group sits in the scene (a unit sphere, spun about y by `sceneState.earthRotationY`). */
export const EARTH_POSITION = new Vector3(0, -1.1, 9.5);

const UP = new Vector3(0, 1, 0);

/** A point in the earth group's space, in the scene, with the planet spun by `rotationY`. */
export const earthToWorld = (point: Vector3, rotationY: number, target = new Vector3()) =>
    target.copy(point).applyAxisAngle(UP, rotationY).add(EARTH_POSITION);

/** The earth mesh's own turn within the earth group, which lines its texture up with the markers. */
export const EARTH_MESH_ROTATION = MathUtils.degToRad(300);

/**
 * A point on the planet (degrees), as a unit vector in the earth group's space: where three's sphere puts that
 * point of the equirectangular texture, turned with the earth mesh.
 */
export const onEarth = (lat: number, lon: number, target = new Vector3()) => {
    const phi = ((lon + 180) / 360) * Math.PI * 2;
    const theta = ((90 - lat) / 180) * Math.PI;
    return target
        .set(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta))
        .applyAxisAngle(UP, EARTH_MESH_ROTATION);
};

export const PLACES = {
    belfast: { lat: 54.597, lon: -5.93 },
    // The middle of Northern Ireland, which the clouds part around
    northernIreland: { lat: 54.62, lon: -6.75 },
    paris: { lat: 48.857, lon: 2.352 },
    boston: { lat: 42.36, lon: -71.06 },
    itasca: { lat: 41.975, lon: -88.007 },
} as const;
