import type {Color4, SliderPath, Vector2} from "osu-classes";
import {getSliderPathRaster, SliderPathRasterContext} from "./SliderPathRasterCache";

/** Draws the static geometry and colours of a slider path. */
export class DrawableSliderPath {
    static readonly ARGON_PRO_BODY_ALPHA = 0.92;

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
        points: readonly Vector2[] = this.path.path,
    ): void {
        if (opacity <= 0) return;

        const diameter = radius * 2;
        const borderThickness = (diameter * 2) * (2 / 58);
        const outerGradientSize = (diameter * 2) - borderThickness * 4;
        const pathRadius = outerGradientSize / 2;
        const innerPathRadius = pathRadius - borderThickness * 2;
        const padding = pathRadius / 2 + 2;
        const bounds = DrawableSliderPath.bounds(position, points, padding);
        const transform = ctx.getTransform();
        const determinant = transform.a * transform.d - transform.b * transform.c;
        if (!Number.isFinite(determinant) || determinant === 0) return;

        // Intersect the path with the canvas in local coordinates before allocating.
        // Aspire sliders may extend tens of thousands of pixels off the playfield.
        const visiblePoints = [
            [0, 0], [ctx.canvas.width, 0],
            [0, ctx.canvas.height], [ctx.canvas.width, ctx.canvas.height],
        ].map(([x, y]) => ({
            x: (transform.d * (x - transform.e) - transform.c * (y - transform.f)) / determinant,
            y: (transform.a * (y - transform.f) - transform.b * (x - transform.e)) / determinant,
        }));
        const right = Math.min(bounds.x + bounds.width, Math.ceil(Math.max(...visiblePoints.map(point => point.x))));
        const bottom = Math.min(bounds.y + bounds.height, Math.ceil(Math.max(...visiblePoints.map(point => point.y))));
        bounds.x = Math.max(bounds.x, Math.floor(Math.min(...visiblePoints.map(point => point.x))));
        bounds.y = Math.max(bounds.y, Math.floor(Math.min(...visiblePoints.map(point => point.y))));
        bounds.width = right - bounds.x;
        bounds.height = bottom - bounds.y;
        if (bounds.width <= 0 || bounds.height <= 0) return;

        const x = position.x - bounds.x;
        const y = position.y - bounds.y;
        // The transform includes both the playfield scale and device pixel ratio.
        const pixelWidth = Math.ceil(bounds.width * Math.max(1, Math.hypot(transform.a, transform.b)));
        const pixelHeight = Math.ceil(bounds.height * Math.max(1, Math.hypot(transform.c, transform.d)));
        const borderStyle = DrawableSliderPath.rgba(this.borderColor, opacity);
        const bodyStyle = DrawableSliderPath.rgba(this.accentColor, opacity * this.bodyAlpha);
        const buffer = getSliderPathRaster(ctx, this, {
            width: bounds.width,
            height: bounds.height,
            pixelWidth,
            pixelHeight,
            key: [x, y, pathRadius, innerPathRadius, borderStyle, bodyStyle],
            points,
        }, bufferContext => {
            this.drawPath(bufferContext, points, x, y, pathRadius, innerPathRadius, borderStyle, bodyStyle);
        });

        if (buffer) ctx.drawImage(buffer, bounds.x, bounds.y, bounds.width, bounds.height);
    }

    private drawPath(
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
        bufferContext.restore();
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

    private static bounds(
        position: Vector2,
        points: readonly Vector2[],
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
