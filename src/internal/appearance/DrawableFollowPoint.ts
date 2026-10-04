// Argon appearance adapted from ppy/osu. Copyright (c) ppy Pty Ltd.
// https://github.com/ppy/osu/blob/master/osu.Game.Rulesets.Osu/Skinning/Argon/ArgonFollowPoint.cs
// Chevron outline: Font Awesome Free 5.15.4, Fonticons, Inc., CC BY 4.0.
// https://github.com/FortAwesome/Font-Awesome/blob/5.x/svgs/solid/chevron-right.svg
import type {FollowPointState} from "../followpoints/FollowPoint";

const CHEVRON_OUTLINE = "M285.476 272.971L91.132 467.314c-9.373 9.373-24.569 9.373-33.941 0l-22.667-22.667c-9.357-9.357-9.375-24.522-.04-33.901L188.505 256 34.484 101.255c-9.335-9.379-9.317-24.544.04-33.901l22.667-22.667c9.373-9.373 24.569-9.373 33.941 0L285.475 239.03c9.373 9.372 9.373 24.568.001 33.941z";

/** Paints evaluated geometry; owns no gameplay models or backing surfaces. */
export default class DrawableFollowPoint {
    private outline?: Path2D;

    public draw(ctx: CanvasRenderingContext2D, point: FollowPointState): void {
        if (point.opacity <= 0) return;
        this.outline ??= new Path2D(CHEVRON_OUTLINE);
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

    public dispose(): void { this.outline = undefined; }

    private chevron(ctx: CanvasRenderingContext2D, offset: number, dark: boolean): void {
        ctx.save();
        try {
            const gradient = ctx.createLinearGradient(0, 0, 0, 8);
            gradient.addColorStop(0, dark ? "rgb(50.4,19.4,28.6)" : "#FC618F");
            gradient.addColorStop(1, dark ? "rgb(37.4,5.2,13)" : "#BB1A41");
            ctx.fillStyle = gradient;
            ctx.translate(offset + 1.5, 0);
            ctx.scale(8 / 512, 8 / 512);
            ctx.fill(this.outline!);
        } finally {
            ctx.restore();
        }
    }
}
