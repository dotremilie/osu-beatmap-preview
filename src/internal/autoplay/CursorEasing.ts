export function outQuad(progress: number): number {
    return progress * (2 - progress);
}

/** osu!framework's OutElasticHalf, used by the Argon cursor's press animation. */
export function outElasticHalf(progress: number): number {
    const frequency = 2 * Math.PI / 0.3;
    const offset = 0.3 / 4;
    const endOffset = Math.pow(2, -10) * Math.sin((0.5 - offset) * frequency);
    return Math.pow(2, -10 * progress) * Math.sin((0.5 * progress - offset) * frequency)
        + 1 - endOffset * progress;
}

export function clamp01(progress: number): number {
    return Math.max(0, Math.min(1, progress));
}
