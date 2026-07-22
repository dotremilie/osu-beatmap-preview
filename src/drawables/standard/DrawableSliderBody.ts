import {Slider} from "osu-standard-stable";
import {Color4} from "osu-classes";
import {DrawableStandardHitObject} from "./DrawableStandardHitObject";
import {DrawableSliderPath} from "./DrawableSliderPath";

export class DrawableSliderBody extends DrawableStandardHitObject<Slider> {
    readonly sliderPath: DrawableSliderPath;

    get accentColor(): Color4 {
        return this.sliderPath.accentColor;
    }

    set accentColor(color: Color4) {
        this.sliderPath.accentColor = color;
    }

    get borderColor(): Color4 {
        return this.sliderPath.borderColor;
    }

    set borderColor(color: Color4) {
        this.sliderPath.borderColor = color;
    }

    get bodyAlpha(): number {
        return this.sliderPath.bodyAlpha;
    }

    set bodyAlpha(alpha: number) {
        this.sliderPath.bodyAlpha = alpha;
    }

    constructor(
        hitObject: Slider,
        accentColor: Color4 = new Color4(255, 255, 255),
        borderColor: Color4 = new Color4(255, 255, 255),
        hidden = false,
        bodyAlpha = DrawableSliderPath.ARGON_PRO_BODY_ALPHA,
    ) {
        super(hitObject, hidden);
        this.sliderPath = new DrawableSliderPath(hitObject.path, accentColor, borderColor, bodyAlpha);
    }

    draw(ctx: CanvasRenderingContext2D, time: number): void {
        this.sliderPath.draw(
            ctx,
            this.hitObject.stackedStartPosition,
            this.hitObject.radius,
            this.opacity(time),
        );
    }

    opacity(time: number): number {
        if (this.hidden) {
            const fadeStartTime = this.hitObject.startTime - this.hitObject.timePreempt + this.hitObject.timeFadeIn;

            return this.hiddenOpacity(time, fadeStartTime, this.hitObject.endTime - fadeStartTime);
        }

        let opacity = super.opacity(time);

        if (time > this.hitObject.endTime) {
            opacity = this.fadeOutOpacity(time, this.hitObject.endTime);
        }

        return opacity;
    }
}

