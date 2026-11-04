/** A beatmap-time drawable on the playfield canvas. */
export default interface Drawable {
    draw(ctx: CanvasRenderingContext2D, time: number): void;
}
