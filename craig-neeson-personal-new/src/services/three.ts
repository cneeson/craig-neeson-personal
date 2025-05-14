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

    return current - easedStep;
};