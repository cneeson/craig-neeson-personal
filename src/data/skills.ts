import { Vector3 } from 'three';

export interface Skill {
    name: string;
    /** Its logo (public/images/skills), if it has one. */
    icon?: string;
    /** The skills stop it's shown at (see director.ts). */
    stop: 'docks' | 'lagan';
    /** The landmark it stands over, in scene units (10 m: x east, y up, z south), from OpenStreetMap. */
    at: Vector3;
}

export const skills: Skill[] = [
    // Across the water from the Titanic Quarter
    { name: 'TypeScript', icon: 'ts', stop: 'docks', at: new Vector3(64.4, 11.5, -8.1) }, // Goliath
    { name: 'Vue', icon: 'vue', stop: 'docks', at: new Vector3(33, 4.6, -45.6) }, // Titanic Belfast
    { name: 'React', icon: 'react', stop: 'docks', at: new Vector3(24.8, 2, -26) }, // SS Nomadic
    { name: 'JavaScript', icon: 'js', stop: 'docks', at: new Vector3(64.1, 4.2, -77.4) }, // Titanic Studios
    { name: 'Nuxt', icon: 'nuxt', stop: 'docks', at: new Vector3(2, 3.5, -7.2) }, // W5, in the Odyssey
    // Over the Lagan, looking up at the old town
    { name: 'Three.js', icon: 'threejs', stop: 'lagan', at: new Vector3(-41.9, 9.6, 14.9) }, // The Obel
    { name: 'GSAP', stop: 'lagan', at: new Vector3(-43, 1.4, 27.9) }, // The Big Fish
    { name: 'Node', icon: 'node', stop: 'lagan', at: new Vector3(-50.2, 4.5, 26) }, // Custom House
    { name: 'HTML', icon: 'html', stop: 'lagan', at: new Vector3(-60.4, 4.8, 34.7) }, // Albert Memorial Clock
    { name: 'CSS', icon: 'css', stop: 'lagan', at: new Vector3(-87.7, 8.5, 16.6) }, // St Anne's Cathedral
    { name: 'Tailwind', icon: 'tailwind', stop: 'lagan', at: new Vector3(-36, 1.8, 33) }, // The Lagan Weir
];

export const iconUrl = (icon: string) => `${process.env.BASE_URL}images/skills/${icon}.svg`;
