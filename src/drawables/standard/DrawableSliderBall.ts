import {SliderTick} from "osu-standard-stable";
import MathUtils from "../../utils/MathUtils";
import type {Slider} from "osu-standard-stable";
import type {Color4} from "osu-classes";
import DefaultAppearance, {StandardAppearance} from "../../internal/appearance/DefaultAppearance";

/** Canvas implementation of osu!'s Argon slider ball and follow circle. */
export class DrawableSliderBall {
    static readonly FOLLOW_AREA = 2.4;

    private static readonly BALL_FADE_IN_DURATION = 200;
    private static readonly BALL_FADE_OUT_DURATION = 50;
    private static readonly FOLLOW_FADE_IN_DURATION = 300;
    private static readonly FOLLOW_FADE_OUT_DURATION = 150;
    private static readonly FOLLOW_END_SCALE_DURATION = 300;
    private static readonly TICK_PULSE_OUT_DURATION = 40;
    private static readonly TICK_PULSE_IN_DURATION = 200;

    private readonly tickTimes: number[];

    constructor(private readonly slider: Slider, private readonly color: Color4, private readonly appearance: StandardAppearance = new DefaultAppearance()) {
        this.tickTimes = slider.nestedHitObjects
            .filter((nested): nested is SliderTick => nested instanceof SliderTick)
            .map((tick) => tick.startTime);
    }

    draw(ctx: CanvasRenderingContext2D, time: number): void {
        const {x, y, completion} = this.positionAt(time);

        this.appearance.sliderFollow(ctx, this.followOpacity(time), this.slider.radius, this.scale(time), this.color, x, y);
        this.appearance.sliderBall(ctx, this.opacity(time), this.slider.radius, this.color, x, y, this.iconScale(time), this.rotationAt(completion));
    }

    opacity(time: number): number {
        const {startTime, endTime} = this.slider;
        const fadeIn = DrawableSliderBall.easeOutQuint(MathUtils.clamp(
            (Math.min(time, endTime) - startTime) / DrawableSliderBall.BALL_FADE_IN_DURATION,
            0,
            1,
        ));

        if (time <= endTime) return fadeIn;

        const fadeOutProgress = MathUtils.clamp(
            (time - endTime) / DrawableSliderBall.BALL_FADE_OUT_DURATION,
            0,
            1,
        );

        return fadeIn * Math.pow(1 - fadeOutProgress, 5);
    }

    /** Returns the Argon follow-circle scale. */
    scale(time: number): number {
        const {startTime, endTime} = this.slider;
        const endScale = this.followScaleBeforeEnd(endTime);

        if (time <= endTime) return this.followScaleBeforeEnd(time);

        const endProgress = DrawableSliderBall.easeOutQuint(MathUtils.clamp(
            (time - endTime) / DrawableSliderBall.FOLLOW_END_SCALE_DURATION,
            0,
            1,
        ));

        return endScale + (1 - endScale) * endProgress;
    }

    private positionAt(time: number): {x: number; y: number; completion: number} {
        const {duration, startTime, spans, path, stackedStartPosition} = this.slider;
        const completion = MathUtils.clamp((time - startTime) / duration, 0, 1);
        const pathProgress = path.progressAt(completion, spans);
        const position = path.positionAt(pathProgress);

        return {
            x: stackedStartPosition.x + position.x,
            y: stackedStartPosition.y + position.y,
            completion,
        };
    }

    private rotationAt(completion: number): number {
        const {path, spans} = this.slider;

        if (path.distance <= 0) return 0;

        const checkDistance = 0.1 / path.distance;
        const fromCompletion = Math.min(1 - checkDistance, completion);
        const toCompletion = Math.min(1, completion + checkDistance);
        const from = path.positionAt(path.progressAt(fromCompletion, spans));
        const to = path.positionAt(path.progressAt(toCompletion, spans));
        const x = to.x - from.x;
        const y = to.y - from.y;

        if (Math.hypot(x, y) < 0.01) return 0;

        return Math.atan2(y, x);
    }

    private iconScale(time: number): number {
        const {startTime, endTime} = this.slider;
        const entranceProgress = MathUtils.clamp(
            (Math.min(time, endTime) - startTime) / DrawableSliderBall.BALL_FADE_IN_DURATION,
            0,
            1,
        );
        const entranceScale = DrawableSliderBall.easeOutElasticHalf(entranceProgress);

        if (time <= endTime) return entranceScale;

        const exitProgress = DrawableSliderBall.easeOutQuint(MathUtils.clamp(
            (time - endTime) / DrawableSliderBall.BALL_FADE_IN_DURATION,
            0,
            1,
        ));

        return entranceScale + (0.9 - entranceScale) * exitProgress;
    }

    private followOpacity(time: number): number {
        const {startTime, endTime} = this.slider;
        const fadeIn = DrawableSliderBall.easeOutQuint(MathUtils.clamp(
            (Math.min(time, endTime) - startTime) / DrawableSliderBall.FOLLOW_FADE_IN_DURATION,
            0,
            1,
        ));

        if (time <= endTime) return fadeIn;

        const fadeOutProgress = MathUtils.clamp(
            (time - endTime) / DrawableSliderBall.FOLLOW_FADE_OUT_DURATION,
            0,
            1,
        );

        return fadeIn * Math.pow(1 - fadeOutProgress, 5);
    }

    private followScaleBeforeEnd(time: number): number {
        const {startTime} = this.slider;
        const pressProgress = DrawableSliderBall.easeOutQuint(MathUtils.clamp(
            (time - startTime) / DrawableSliderBall.FOLLOW_FADE_IN_DURATION,
            0,
            1,
        ));
        let scale = 1 + (DrawableSliderBall.FOLLOW_AREA - 1) * pressProgress;
        const tickTime = this.latestTickAt(time);

        if (tickTime === undefined || scale < DrawableSliderBall.FOLLOW_AREA * 0.98) return scale;

        const elapsed = time - tickTime;
        const pulseScale = DrawableSliderBall.FOLLOW_AREA * 1.08;

        if (elapsed <= DrawableSliderBall.TICK_PULSE_OUT_DURATION) {
            const progress = DrawableSliderBall.easeOutQuint(
                elapsed / DrawableSliderBall.TICK_PULSE_OUT_DURATION,
            );
            scale = DrawableSliderBall.FOLLOW_AREA
                + (pulseScale - DrawableSliderBall.FOLLOW_AREA) * progress;
        } else if (elapsed <= DrawableSliderBall.TICK_PULSE_OUT_DURATION + DrawableSliderBall.TICK_PULSE_IN_DURATION) {
            const progress = DrawableSliderBall.easeOutQuint(
                (elapsed - DrawableSliderBall.TICK_PULSE_OUT_DURATION)
                / DrawableSliderBall.TICK_PULSE_IN_DURATION,
            );
            scale = pulseScale + (DrawableSliderBall.FOLLOW_AREA - pulseScale) * progress;
        }

        return scale;
    }

    private latestTickAt(time: number): number | undefined {
        for (let i = this.tickTimes.length - 1; i >= 0; i--) {
            if (this.tickTimes[i] <= time) return this.tickTimes[i];
        }

        return undefined;
    }

    private static easeOutQuint(progress: number): number {
        return 1 - Math.pow(1 - progress, 5);
    }

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
