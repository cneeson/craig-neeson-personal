// Coarse pointer is a better proxy for "phone/tablet GPU" than touch support:
// plenty of touchscreen laptops have a fine pointer and a capable GPU.
export const isMobile = window.matchMedia('(pointer: coarse)').matches

export const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Rendering budget per device class. Post-processing cost scales with pixel count,
// so capping the pixel ratio is the single biggest win on high-DPI phones.
export const quality = isMobile
  ? {
      dpr: Math.min(window.devicePixelRatio, 1.5),
      textureDir: 'textures/earth/low-res/',
      sphereSegments: 64,
      starCounts: [300, 1500, 4000],
      godRays: false,
      canvasBlur: 16,
    }
  : {
      dpr: Math.min(window.devicePixelRatio, 2),
      textureDir: 'textures/earth/',
      sphereSegments: 96,
      starCounts: [500, 3000, 12000],
      godRays: true,
      canvasBlur: 32,
    }
