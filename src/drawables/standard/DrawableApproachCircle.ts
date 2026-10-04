import {DrawableCircle} from "./DrawableCircle";

export class DrawableApproachCircle {
    APPROACH_CIRCLE_SIZE = 4;

    drawableCircle: DrawableCircle;

    constructor(hitObject: DrawableCircle) {
        this.drawableCircle = hitObject;
    }

    draw(ctx: CanvasRenderingContext2D, time: number): void {
        const {radius, stackedStartPosition} = this.drawableCircle.hitObject;
        const {x, y} = stackedStartPosition;

        const opacity = this.opacity(time);
        if (opacity <= 0) return;
        const scale = this.scale(time);

        this.drawableCircle.appearance.approachCircle(ctx, {x, y}, radius, this.drawableCircle.color, opacity, radius * (1 + this.APPROACH_CIRCLE_SIZE * scale));
    }

    opacity(time: number): number {
        if (this.drawableCircle.hidden) {
            return 0;
        }

        let opacity = 0;

        if (time <= this.drawableCircle.hitObject.startTime) {
            opacity = this.drawableCircle.opacity(time);
        }

        return opacity;
    }

    scale(time: number): number {
        return Math.max(0, this.drawableCircle.hitObject.startTime - time) / this.drawableCircle.hitObject.timePreempt;
    }
}
