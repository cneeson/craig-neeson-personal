import { bounds } from './geo';

/** Road centrelines, flattened for transfer from the worker: `meta` holds (class, first point, point count) per road. */
export interface Roads {
    points: Float32Array;
    meta: Uint32Array;
}

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

// Per road class (major, minor, service): a wide soft glow, then a bright core, in px at 4096
const styles = [
    { glow: 16, glowAlpha: 0.16, core: 3, coreAlpha: 0.95 },
    { glow: 8, glowAlpha: 0.1, core: 1.6, coreAlpha: 0.55 },
    { glow: 0, glowAlpha: 0, core: 1.1, coreAlpha: 0.25 },
];

/**
 * Draws the street network as glowing lines, for the ground texture. Same mapping as ground.png:
 * the canvas covers `bounds`, with the north edge at the top.
 */
export const drawRoads = (context: Context2D, roads: Roads, size: number) => {
    const scale = size / 4096;
    const toX = (x: number) => ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * size;
    const toY = (z: number) => ((z - bounds.minZ) / (bounds.maxZ - bounds.minZ)) * size;

    context.fillStyle = '#000';
    context.fillRect(0, 0, size, size);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.globalCompositeOperation = 'lighter';

    const trace = (roadClass: number) => {
        context.beginPath();
        for (let r = 0; r < roads.meta.length; r += 3) {
            if (roads.meta[r] !== roadClass) continue;
            const [first, count] = [roads.meta[r + 1], roads.meta[r + 2]];
            for (let i = 0; i < count; i++) {
                const [x, y] = [toX(roads.points[(first + i) * 2]), toY(roads.points[(first + i) * 2 + 1])];
                if (i === 0) context.moveTo(x, y);
                else context.lineTo(x, y);
            }
        }
    };

    // Minor roads first so the major ones glow over them
    for (let roadClass = styles.length - 1; roadClass >= 0; roadClass--) {
        const style = styles[roadClass];
        trace(roadClass);
        if (style.glow) {
            context.strokeStyle = `rgba(255, 140, 50, ${style.glowAlpha})`;
            context.lineWidth = style.glow * scale;
            context.stroke();
        }
        context.strokeStyle = `rgba(255, 214, 150, ${style.coreAlpha})`;
        context.lineWidth = Math.max(1, style.core * scale);
        context.stroke();
    }
};
