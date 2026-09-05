import {Spinner} from "osu-standard-stable";
import MathUtils from "../../utils/MathUtils";
import {DrawableStandardHitObject} from "./DrawableStandardHitObject";
import {DrawableSpinnerDisc} from "./DrawableSpinnerDisc";

/**
 * Canvas adaptation of osu!lazer's Argon spinner.
 * https://github.com/ppy/osu/blob/master/osu.Game.Rulesets.Osu/Skinning/Argon/ArgonSpinnerDisc.cs
 *
 * As with slider tracking, the preview assumes a successful play. Elapsed time
 * drives completion instead of player input; every animation supports seeking.
 */
export class DrawableSpinner extends DrawableStandardHitObject<Spinner> {
    private static readonly FADE_OUT_DURATION = 240;
    private static readonly END_SCALE_DURATION = 320;

    private readonly disc = new DrawableSpinnerDisc();

    constructor(hitObject: Spinner, hidden = false) {
        super(hitObject, hidden);
        this.HIT_DURATION = hidden
            ? Math.max(DrawableSpinner.FADE_OUT_DURATION,
                hitObject.timePreempt * DrawableStandardHitObject.HIDDEN_FADE_OUT_DURATION_MULTIPLIER)
            : DrawableSpinner.FADE_OUT_DURATION;
    }

    draw(ctx: CanvasRenderingContext2D, time: number): void {
        const opacity = this.opacity(time);
        const discScale = this.scale(time);

        if (opacity <= 0 || discScale <= 0) return;

        const {startTime, endTime, stackedStartPosition} = this.hitObject;
        const elapsed = Math.max(0, Math.min(time, endTime) - startTime);
        const tracking = 1 - Math.pow(0.985, elapsed);
        const completion = 1 - Math.pow(0.5, Math.max(0, time - endTime) / 40);

        ctx.save();
        ctx.translate(stackedStartPosition.x, stackedStartPosition.y);
        ctx.globalAlpha *= opacity;

        ctx.save();
        ctx.scale(discScale, discScale);
        this.disc.draw(ctx, this.progress(time), this.rotation(time), tracking, completion);
        ctx.restore();

        this.drawCentre(ctx, this.entranceScale(Math.min(time, endTime), 0.3, 0.8), tracking);
        ctx.restore();
    }

    opacity(time: number): number {
        if (time < this.hitObject.startTime - this.hitObject.timePreempt / 2) return 0;

        // Argon's entrance is driven by scale. Hidden keeps the body visible
        // during the spinner, then uses its own fade duration after the end.
        const duration = this.hidden
            ? this.hitObject.timePreempt * DrawableStandardHitObject.HIDDEN_FADE_OUT_DURATION_MULTIPLIER
            : DrawableSpinner.FADE_OUT_DURATION;

        return this.fadeOutOpacity(time, this.hitObject.endTime, duration);
    }

    scale(time: number): number {
        const {endTime} = this.hitObject;
        const entranceScale = this.entranceScale(Math.min(time, endTime), 0.2, 1);

        if (time <= endTime) return entranceScale;

        const progress = DrawableStandardHitObject.clamp01(
            (time - endTime) / DrawableSpinner.END_SCALE_DURATION,
        );

        return MathUtils.lerp(progress * (2 - progress), entranceScale, 1.2);
    }

    private progress(time: number): number {
        const {startTime, endTime} = this.hitObject;

        if (endTime <= startTime) return time >= endTime ? 1 : 0;

        return DrawableStandardHitObject.clamp01((time - startTime) / (endTime - startTime));
    }

    private rotation(time: number): number {
        const {startTime, endTime, timePreempt} = this.hitObject;
        const duration = Math.max(0, endTime - startTime);
        const ambientProgress = DrawableStandardHitObject.clamp01(
            (Math.min(time, endTime) - startTime + timePreempt / 2) / Math.max(1, timePreempt + duration),
        );
        const endProgress = DrawableStandardHitObject.clamp01(
            (time - endTime) / DrawableSpinner.END_SCALE_DURATION,
        );
        // One full turn per required spin, plus Argon's slow ambient rotation.
        const spins = Math.max(0, this.hitObject.spinsRequired);
        const degrees = 25 * duration / 2000 * ambientProgress + 360 * spins * this.progress(time)
            + 180 * endProgress;

        return degrees * Math.PI / 180;
    }

    private entranceScale(time: number, initialScale: number, fullScale: number): number {
        const {startTime, timePreempt} = this.hitObject;

        if (timePreempt <= 0) return time < startTime ? 0 : fullScale;

        if (time < startTime) {
            const progress = DrawableStandardHitObject.clamp01(
                (time - startTime + timePreempt / 2) / (timePreempt / 4),
            );
            return initialScale * (1 - Math.pow(1 - progress, 5));
        }

        const progress = DrawableStandardHitObject.clamp01((time - startTime) / (timePreempt / 2));
        return MathUtils.lerp(1 - Math.pow(1 - progress, 5), initialScale, fullScale);
    }

    private drawCentre(ctx: CanvasRenderingContext2D, scale: number, tracking: number): void {
        const diameter = MathUtils.lerp(tracking, 80, 40);

        ctx.save();
        ctx.scale(scale, scale);
        ctx.strokeStyle = "white";

        for (const [size, thickness] of [[diameter * 0.8, 10], [diameter, 3]]) {
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(0, (size - thickness) / 2), 0, Math.PI * 2);
            ctx.lineWidth = thickness;
            ctx.stroke();
        }

        ctx.restore();
    }
}
