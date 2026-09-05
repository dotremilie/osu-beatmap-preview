import {Circle} from "osu-standard-stable";
import {Color4, Vector2} from "osu-classes";
import {DrawableStandardHitObject} from "./DrawableStandardHitObject";
import {DrawableApproachCircle} from "./DrawableApproachCircle";

export class DrawableCircle extends DrawableStandardHitObject<Circle> {
    color: Color4;

    approachCircle: DrawableApproachCircle;

    constructor(hitObject: Circle, color: Color4, hidden = false) {
        super(hitObject, hidden);
        this.color = color;
        this.approachCircle = new DrawableApproachCircle(this);
    }

    draw(ctx: CanvasRenderingContext2D, time: number) {
        this.drawAt(ctx, this.hitObject.stackedStartPosition, this.hitObject.radius * this.scale(time), this.opacity(time));
    }

    /** Draws the circle at an explicit position and size, independent of playback animation. */
    drawAt(ctx: CanvasRenderingContext2D, position: Vector2, circleSize: number, opacity = 1, showCombo = true): void {
        const {x, y} = position;

        const borderThickness = (circleSize * 2) * (2 / 58);
        const gradientThickness = borderThickness * 2.5;
        const outerGradientSize = (circleSize * 2) - borderThickness * 4;
        const innerGradientSize = outerGradientSize - gradientThickness * 2;
        const innerFillSize = innerGradientSize - gradientThickness * 2;

        ctx.lineWidth = borderThickness;
        ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, circleSize, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = `rgba(${this.color.red},${this.color.green},${this.color.blue},${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, outerGradientSize / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(${this.color.red / 1.5},${this.color.green / 1.5},${this.color.blue / 1.5},${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, innerGradientSize / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(${this.color.red / 4},${this.color.green / 4},${this.color.blue / 4},${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, innerFillSize / 2, 0, Math.PI * 2);
        ctx.fill();

        if (showCombo) {
            ctx.font = `700 ${circleSize * 0.7}px "Torus"`;
            ctx.textBaseline = 'alphabetic';
            ctx.textAlign = 'center';
            ctx.fillStyle = `rgba(255,255,255,${opacity})`;
            const comboNumber = (this.hitObject.currentComboIndex + 1).toString();
            const bounds = ctx.measureText(comboNumber);
            ctx.fillText(
                comboNumber,
                x + (bounds.actualBoundingBoxLeft - bounds.actualBoundingBoxRight) / 2,
                y + (bounds.actualBoundingBoxAscent - bounds.actualBoundingBoxDescent) / 2,
            );
        }
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

