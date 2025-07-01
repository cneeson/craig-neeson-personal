export const easeToTarget = (params: {
    current: number,
    target: number,
    elapsed: number,
    factor?: number
}) => {
    const { current, target, elapsed, factor = 0.1 } = params;
    const distanceToTarget = current - target;
    const easeOutQuad = (t: number) => t * (2 - t);
    const easedStep = easeOutQuad(elapsed * 0.01) * distanceToTarget * factor;

    // Prevents cases whereby the target is exceeded (which will mess up the render loop)
    // TODO: this doesn't actually seem to have fixed it
    if (distanceToTarget === 0 || Math.abs(distanceToTarget) < 0.0000001) {
        return target;
    }

    return current - easedStep;
};