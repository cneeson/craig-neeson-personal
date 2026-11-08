/**
 * Which Belfast the flythrough shows: Google's photorealistic 3D tiles by day, or the hand-built
 * night city (no API key in the build, the reader has asked to save data, or the tiles failed).
 * `?city=night` forces the night city, for testing.
 */
export const GOOGLE_MAPS_API_KEY = process.env.VUE_APP_GOOGLE_MAPS_API_KEY ?? '';

const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
const forced = new URLSearchParams(location.search).get('city');

export type CityMode = 'photo' | 'night';

/** Mutable: drops to 'night' if the tiles can't load (see belfast-photo.vue). */
export const city: { mode: CityMode } = {
    mode: GOOGLE_MAPS_API_KEY && !saveData && forced !== 'night' ? 'photo' : 'night',
};
