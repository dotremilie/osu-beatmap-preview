import DefaultAppearance, {StandardAppearance} from "../../internal/appearance/DefaultAppearance";
import {Circle} from "osu-standard-stable";
import {Color4, Vector2} from "osu-classes";
import {DrawableStandardHitObject} from "./DrawableStandardHitObject";
import {DrawableApproachCircle} from "./DrawableApproachCircle";

export class DrawableCircle extends DrawableStandardHitObject<Circle> {
    color: Color4;

    approachCircle: DrawableApproachCircle;

    constructor(hitObject: Circle, color: Color4, hidden = false, public readonly appearance: StandardAppearance = new DefaultAppearance()) {
        super(hitObject, hidden);
        this.color = color;
        this.approachCircle = new DrawableApproachCircle(this);
    }

    draw(ctx: CanvasRenderingContext2D, time: number): void {
        const opacity = this.opacity(time);
        if (opacity <= 0) return;
        this.drawAt(ctx, this.hitObject.stackedStartPosition, this.hitObject.radius * this.scale(time), opacity);
    }

    /** Draws the circle at an explicit position and size, independent of playback animation. */
    drawAt(ctx: CanvasRenderingContext2D, position: Vector2, circleSize: number, opacity = 1, showCombo = true): void {
        this.appearance.circle(ctx, position, circleSize, this.color, opacity,
            showCombo ? String(this.hitObject.currentComboIndex + 1) : undefined);
    }

    opacity(time: number): number {
        if (this.hidden) {
            return this.hiddenOpacity(time);
        }

        let opacity = super.opacity(time);

        if (time > this.hitObject.startTime) {
            opacity = this.fadeOutOpacity(time, this.hitObject.startTime);
        }

        return opacity;
    }
}

