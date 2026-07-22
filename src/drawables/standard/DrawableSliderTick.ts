import type {Slider, SliderTick} from "osu-standard-stable";
import {DrawableStandardHitObject} from "./DrawableStandardHitObject";
import {DrawableSlider} from "./DrawableSlider";

/** Canvas implementation of osu!'s Argon slider score point. */
export class DrawableSliderTick extends DrawableStandardHitObject<SliderTick> {
    static readonly ANIM_DURATION = 150;
    static readonly APPEAR_SCALE_DURATION = DrawableSliderTick.ANIM_DURATION * 4;
    static readonly ARGON_SIZE = 12;
    static readonly ARGON_BORDER_THICKNESS = 3;

    get slider(): Slider {
        return this.drawableSlider.hitObject;
    }

    protected get drawableSlider(): DrawableSlider {
        return this.parentHitObject as DrawableSlider;
    }

    draw(ctx: CanvasRenderingContext2D, time: number): void {
        const opacity = this.opacity(time);

        if (opacity <= 0) return;

        const {radius, stackedStartPosition} = this.hitObject;
        const scale = this.scale(time);
        const objectScale = radius / 64;
        const diameter = DrawableSliderTick.ARGON_SIZE * objectScale * scale;
        const borderThickness = DrawableSliderTick.ARGON_BORDER_THICKNESS * objectScale * scale;

        ctx.save();
        ctx.globalAlpha *= opacity;
        ctx.beginPath();
        ctx.arc(
            stackedStartPosition.x,
            stackedStartPosition.y,
            Math.max(0, (diameter - borderThickness) / 2),
            0,
            Math.PI * 2,
        );
        ctx.lineWidth = borderThickness;
        ctx.strokeStyle = `rgb(${this.drawableSlider.color.red},${this.drawableSlider.color.green},${this.drawableSlider.color.blue})`;
        ctx.stroke();
        ctx.restore();
    }

    opacity(time: number): number {
        const fadeInStart = this.hitObject.startTime - this.hitObject.timePreempt;
        const fadeIn = DrawableStandardHitObject.clamp01(
            (time - fadeInStart) / DrawableSliderTick.ANIM_DURATION,
        );

        if (this.hidden && time <= this.hitObject.startTime) {
            const fadeOutDuration = Math.min(
                Math.max(0, this.hitObject.timePreempt - DrawableSliderTick.ANIM_DURATION),
                1000,
            );
            const fadeOutStart = this.hitObject.startTime - fadeOutDuration;
            const hiddenFade = 1 - DrawableStandardHitObject.clamp01(
                (time - fadeOutStart) / Math.max(1, fadeOutDuration),
            );

            return Math.min(fadeIn, hiddenFade);
        }

        if (time <= this.hitObject.startTime) return fadeIn;

        const hitProgress = DrawableStandardHitObject.clamp01(
            (time - this.hitObject.startTime) / DrawableSliderTick.ANIM_DURATION,
        );

        return fadeIn * Math.pow(1 - hitProgress, 5);
    }

    scale(time: number): number {
        const appearanceScale = this.appearanceScaleAt(Math.min(time, this.hitObject.startTime));

        if (time <= this.hitObject.startTime) return appearanceScale;

        const hitProgress = DrawableStandardHitObject.clamp01(
            (time - this.hitObject.startTime) / DrawableSliderTick.ANIM_DURATION,
        );
        const easedProgress = hitProgress * (2 - hitProgress);

        return appearanceScale + (1.5 - appearanceScale) * easedProgress;
    }

    private appearanceScaleAt(time: number): number {
        const animationStart = this.hitObject.startTime - this.hitObject.timePreempt;
        const progress = DrawableStandardHitObject.clamp01(
            (time - animationStart) / DrawableSliderTick.APPEAR_SCALE_DURATION,
        );

        return 0.5 + DrawableSliderTick.easeOutElasticHalf(progress) * 0.5;
    }

    /** Mirrors osu!framework's Easing.OutElasticHalf. */
    private static easeOutElasticHalf(progress: number): number {
        const elasticConst = 2 * Math.PI / 0.3;
        const elasticConst2 = 0.3 / 4;
        const elasticOffsetHalf = Math.pow(2, -10)
            * Math.sin((0.5 - elasticConst2) * elasticConst);

        return Math.pow(2, -10 * progress)
            * Math.sin((0.5 * progress - elasticConst2) * elasticConst)
            + 1
            - elasticOffsetHalf * progress;
    }
}
