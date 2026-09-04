export default abstract class Renderer {
    protected ctx: CanvasRenderingContext2D;

    protected constructor(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
    }

    /**
     * Renders the frame for the given time.
     */
    public abstract render(time: number): void;
}
