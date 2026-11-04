import type Drawable from "../Drawable";
import {evaluateFollowPoint} from "../../internal/followpoints/FollowPoint";
import type {FollowPoint, FollowPointState} from "../../internal/followpoints/FollowPoint";

const CHEVRON_OUTLINE = "M285.476 272.971L91.132 467.314c-9.373 9.373-24.569 9.373-33.941 0l-22.667-22.667c-9.357-9.357-9.375-24.522-.04-33.901L188.505 256 34.484 101.255c-9.335-9.379-9.317-24.544.04-33.901l22.667-22.667c9.373-9.373 24.569-9.373 33.941 0L285.475 239.03c9.373 9.372 9.373 24.568.001 33.941z";

/** A single timed Argon follow point, drawn directly from its immutable geometry. */
export default class DrawableFollowPoint implements Drawable {
    private static outline?: Path2D;
    private readonly state: FollowPointState = {x: 0, y: 0, rotationRadians: 0, scale: 1, opacity: 0};

    constructor(public readonly point: FollowPoint) {}

    public draw(ctx: CanvasRenderingContext2D, time: number): void {
        if (!evaluateFollowPoint(this.point, time, this.state)) return;
        const point = this.state;
        DrawableFollowPoint.outline ??= new Path2D(CHEVRON_OUTLINE);
        ctx.save();
        try {
            ctx.translate(point.x, point.y);
            ctx.rotate(point.rotationRadians);
            ctx.scale(point.scale, point.scale);
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha *= point.opacity;
            ctx.shadowBlur = 0;
            // Centre the 12x8 composite; fit each 320x512 icon into its 8x8 box.
            ctx.translate(-6, -4);
            this.chevron(ctx, 0, true);
            this.chevron(ctx, 4, false);
        } finally {
            ctx.restore();
        }
    }

    private chevron(ctx: CanvasRenderingContext2D, offset: number, dimmed: boolean): void {
        ctx.save();
        try {
            const gradient = ctx.createLinearGradient(0, 0, 0, 8);
            gradient.addColorStop(0, "#FC618F");
            gradient.addColorStop(1, "#BB1A41");
            ctx.fillStyle = gradient;
            // Preserve the page behind the transparent canvas instead of painting an opaque dark tint.
            if (dimmed) ctx.globalAlpha *= 0.2;
            ctx.translate(offset + 1.5, 0);
            ctx.scale(8 / 512, 8 / 512);
            ctx.fill(DrawableFollowPoint.outline!);
        } finally {
            ctx.restore();
        }
    }
}
