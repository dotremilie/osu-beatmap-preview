import {StandardHitObject} from "osu-standard-stable";
import DrawableHitObject from "../DrawableHitObject";

/**
 * Abstract class representing a drawable standard hit object.
 *
 * @template T - The type of the hit object, extending {@link StandardHitObject}.
 */
export abstract class DrawableStandardHitObject<T extends StandardHitObject> extends DrawableHitObject<T> {
    static readonly HIDDEN_FADE_OUT_DURATION_MULTIPLIER = 0.3;

    HIT_FACTOR = 1.33;
    HIT_DURATION = 150;

    parentHitObject?: DrawableStandardHitObject<StandardHitObject>;

    constructor(hitObject: T, public readonly hidden = false) {
        super(hitObject);
    }

    opacity(time: number): number {
        return this.fadeInOpacity(time);
    };

    protected fadeInOpacity(time: number): number {
        const fadeInStartTime = this.hitObject.startTime - this.hitObject.timePreempt;

        return DrawableStandardHitObject.clamp01((time - fadeInStartTime) / this.hitObject.timeFadeIn);
    }

    protected hiddenOpacity(
        time: number,
        fadeStartTime = this.hitObject.startTime - this.hitObject.timePreempt + this.hitObject.timeFadeIn,
        fadeDuration = this.hitObject.timePreempt * DrawableStandardHitObject.HIDDEN_FADE_OUT_DURATION_MULTIPLIER,
    ): number {
        return Math.min(
            this.fadeInOpacity(time),
            1 - DrawableStandardHitObject.clamp01((time - fadeStartTime) / Math.max(1, fadeDuration)),
        );
    }

    protected fadeOutOpacity(time: number, fadeStartTime: number, fadeDuration = this.HIT_DURATION): number {
        return 1 - DrawableStandardHitObject.clamp01((time - fadeStartTime) / Math.max(1, fadeDuration));
    }

    scale(time: number): number {
        if (time <= this.hitObject.startTime) return 1;

        const t = (time - this.hitObject.startTime) / this.HIT_DURATION;
        return 1 - t + t * this.HIT_FACTOR;
    };

    protected static clamp01(value: number): number {
        return Math.max(0, Math.min(1, value));
    }

    x() {
        return this.hitObject.stackedStartPosition.x;
    }

    y() {
        return this.hitObject.stackedStartPosition.y;
    }

    abstract draw(ctx: CanvasRenderingContext2D, time: number): void;
}
