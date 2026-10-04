import type {Vector2} from "osu-classes";
import type {SliderPathRasterContext} from "../../drawables/standard/SliderPathRasterCache";
class SliderPathPainter {
    public draw(
        bufferContext: SliderPathRasterContext,
        points: readonly Vector2[],
        x: number,
        y: number,
        pathRadius: number,
        innerPathRadius: number,
        borderStyle: string,
        bodyStyle: string,
    ): void {
        bufferContext.save();
        try {
            bufferContext.lineJoin = "round";
            bufferContext.lineCap = "round";

            this.tracePath(bufferContext, points, x, y);
            bufferContext.lineWidth = pathRadius;
            bufferContext.strokeStyle = borderStyle;
            bufferContext.stroke();

            // Remove the opaque centre of the border before adding the translucent
            // body. Doing this on a buffer preserves anything already on the main canvas.
            bufferContext.globalCompositeOperation = "destination-out";
            this.tracePath(bufferContext, points, x, y);
            bufferContext.lineWidth = innerPathRadius;
            bufferContext.strokeStyle = "rgba(0,0,0,1)";
            bufferContext.stroke();

            bufferContext.globalCompositeOperation = "source-over";
            this.tracePath(bufferContext, points, x, y);
            bufferContext.lineWidth = innerPathRadius;
            bufferContext.strokeStyle = bodyStyle;
            bufferContext.stroke();
        } finally {
            bufferContext.restore();
        }
    }
    private tracePath(
        ctx: SliderPathRasterContext,
        points: readonly Vector2[],
        x: number,
        y: number,
    ): void {
        ctx.beginPath();
        ctx.moveTo(x, y);

        for (const point of points) {
            ctx.lineTo(x + point.x, y + point.y);
        }
    }
}
export default new SliderPathPainter();
