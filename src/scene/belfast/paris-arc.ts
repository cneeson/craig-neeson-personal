import { AdditiveBlending, CatmullRomCurve3, Color, Mesh, ShaderMaterial, TubeGeometry, Vector3 } from 'three';

/** Ormeau Business Park in the Gasworks, where Locate a Locum was, and the way to Paris from Belfast (about 140°, so south-east). */
const FROM = new Vector3(-61.2, 1.2, 159.7);
const TOWARDS = new Vector3(Math.sin(2.44), 0, -Math.cos(2.44));

const along = (distance: number, height: number) => FROM.clone().addScaledVector(TOWARDS, distance).setY(height);

/**
 * An arc of light from the Gasworks up and away south-east over the horizon, towards Paris, for the years
 * working remotely for Ankorstore. Drawn on as it's shown, in scene units (10 m), kept well inside the sky.
 */
export const createParisArc = () => {
    const curve = new CatmullRomCurve3([FROM, along(25, 22), along(90, 55), along(220, 70), along(420, 25)]);
    const geometry = new TubeGeometry(curve, 160, 0.22, 8);
    const material = new ShaderMaterial({
        uniforms: { uColor: { value: new Color('#88b8f2') }, uDraw: { value: 0 }, uOpacity: { value: 0 } },
        vertexShader: /* glsl */ `
            varying float vAlong;
            void main() {
                vAlong = uv.x;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 uColor;
            uniform float uDraw;
            uniform float uOpacity;
            varying float vAlong;
            void main() {
                if (vAlong > uDraw) discard;
                float head = exp(-(uDraw - vAlong) * 30.0) * (1.0 - smoothstep(0.97, 1.0, uDraw));
                gl_FragColor = vec4(uColor * (1.1 + head * 2.5), uOpacity * (0.75 + head * 0.25));
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
    });
    const mesh = new Mesh(geometry, material);
    mesh.visible = false;
    mesh.frustumCulled = false;

    return {
        object: mesh,
        /** Every frame, with how far it's drawn and its opacity (0 → 1), and whether the city is shown. */
        update(draw: number, opacity: number, isInCity: boolean) {
            mesh.visible = isInCity && opacity > 0.001;
            if (!mesh.visible) return;
            material.uniforms.uDraw.value = 1 - (1 - draw) ** 2;
            material.uniforms.uOpacity.value = opacity;
        },
        dispose() {
            geometry.dispose();
            material.dispose();
        },
    };
};
