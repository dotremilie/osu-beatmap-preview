import type {Color4, SliderPath, Vector2} from "osu-classes";

type SliderPathBuffer = HTMLCanvasElement | OffscreenCanvas;
type SliderPathBufferContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Draws the static geometry and colours of a slider path. */
export class DrawableSliderPath {
    static readonly ARGON_PRO_BODY_ALPHA = 0.92;

    private buffer?: SliderPathBuffer;
    private bufferContext?: SliderPathBufferContext;

    constructor(
        public readonly path: SliderPath,
        public accentColor: Color4,
        public borderColor: Color4,
        public bodyAlpha = DrawableSliderPath.ARGON_PRO_BODY_ALPHA,
    ) {}

    draw(
        ctx: CanvasRenderingContext2D,
        position: Vector2,
        radius: number,
        opacity: number,
    ): void {
        if (opacity <= 0) return;

        const diameter = radius * 2;
        const borderThickness = (diameter * 2) * (2 / 58);
        const outerGradientSize = (diameter * 2) - borderThickness * 4;
        const pathRadius = outerGradientSize / 2;
        const innerPathRadius = pathRadius - borderThickness * 2;
        const points = this.path.path;
        const padding = pathRadius / 2 + 2;
        const bounds = DrawableSliderPath.bounds(position, points, padding);
        const bufferContext = this.prepareBuffer(ctx, bounds.width, bounds.height);

        if (!bufferContext || !this.buffer) return;

        const x = position.x - bounds.x;
        const y = position.y - bounds.y;

        bufferContext.save();
        bufferContext.lineJoin = "round";
        bufferContext.lineCap = "round";

        this.tracePath(bufferContext, points, x, y);
        bufferContext.lineWidth = pathRadius;
        bufferContext.strokeStyle = DrawableSliderPath.rgba(this.borderColor, opacity);
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
        bufferContext.strokeStyle = DrawableSliderPath.rgba(
            this.accentColor,
            opacity * this.bodyAlpha,
        );
        bufferContext.stroke();
        bufferContext.restore();

        ctx.drawImage(this.buffer, bounds.x, bounds.y);
    }

    private prepareBuffer(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
    ): SliderPathBufferContext | null {
        if (!this.buffer) {
            if (typeof OffscreenCanvas !== "undefined") {
                this.buffer = new OffscreenCanvas(width, height);
            } else {
                const canvas = ctx.canvas as HTMLCanvasElement;
                const ownerDocument = canvas?.ownerDocument;

                if (!ownerDocument) return null;

                this.buffer = ownerDocument.createElement("canvas");
            }

            this.bufferContext = this.buffer.getContext("2d") as SliderPathBufferContext | null ?? undefined;
        }

        if (!this.bufferContext) return null;

        if (this.buffer.width !== width) this.buffer.width = width;
        if (this.buffer.height !== height) this.buffer.height = height;

        this.bufferContext.clearRect(0, 0, width, height);
        this.bufferContext.globalCompositeOperation = "source-over";

        return this.bufferContext;
    }

    private tracePath(
        ctx: SliderPathBufferContext,
        points: Vector2[],
        x: number,
        y: number,
    ): void {
        ctx.beginPath();
        ctx.moveTo(x, y);

        for (const point of points) {
            ctx.lineTo(x + point.x, y + point.y);
        }
    }

    private static bounds(
        position: Vector2,
        points: Vector2[],
        padding: number,
    ): {x: number; y: number; width: number; height: number} {
        let minX = position.x;
        let minY = position.y;
        let maxX = position.x;
        let maxY = position.y;

        for (const point of points) {
            minX = Math.min(minX, position.x + point.x);
            minY = Math.min(minY, position.y + point.y);
            maxX = Math.max(maxX, position.x + point.x);
            maxY = Math.max(maxY, position.y + point.y);
        }

        const x = Math.floor(minX - padding);
        const y = Math.floor(minY - padding);
        const right = Math.ceil(maxX + padding);
        const bottom = Math.ceil(maxY + padding);

        return {
            x,
            y,
            width: Math.max(1, right - x),
            height: Math.max(1, bottom - y),
        };
    }

    private static rgba(color: Color4, opacity: number): string {
        return `rgba(${color.red},${color.green},${color.blue},${opacity * color.alpha})`;
    }
}
