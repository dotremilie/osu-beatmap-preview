import DefaultAppearance, {StandardAppearance} from "../../internal/appearance/DefaultAppearance";
import {DrawableStandardHitObject} from "./DrawableStandardHitObject";
import {SliderRepeat, SliderTick} from "osu-standard-stable";
import type {Slider} from "osu-standard-stable";
import {Color4} from "osu-classes";
import SliderPathRasterCache from "./SliderPathRasterCache";
import {DrawableSliderBody} from "./DrawableSliderBody";
import {DrawableSliderHead} from "./DrawableSliderHead";
import {DrawableSliderBall} from "./DrawableSliderBall";
import {DrawableSliderRepeat} from "./DrawableSliderRepeat";
import {DrawableSliderTick} from "./DrawableSliderTick";

export class DrawableSlider extends DrawableStandardHitObject<Slider> {
    color: Color4;

    readonly sliderBody: DrawableSliderBody;
    readonly sliderHead: DrawableSliderHead;
    readonly sliderBall: DrawableSliderBall;
    readonly sliderTicks: DrawableSliderTick[];
    readonly sliderRepeats: DrawableSliderRepeat[];

    constructor(hitObject: Slider, color: Color4, hidden = false, rasterCache = new SliderPathRasterCache(), appearance: StandardAppearance = new DefaultAppearance()) {
        super(hitObject, hidden);
        this.color = color;

        const accentColor = new Color4(color.red / 4, color.green / 4, color.blue / 4);
        const borderColor = new Color4(color.red, color.green, color.blue);

        this.sliderBody = new DrawableSliderBody(hitObject, accentColor, borderColor, hidden, undefined, rasterCache, appearance);
        this.sliderHead = new DrawableSliderHead(hitObject, color, hidden, appearance);
        this.sliderBall = new DrawableSliderBall(hitObject, color, appearance);
        this.sliderTicks = hitObject.nestedHitObjects
            .filter((nested): nested is SliderTick => nested instanceof SliderTick)
            .map(tick => new DrawableSliderTick(tick, color, hidden, appearance));
        this.sliderRepeats = hitObject.nestedHitObjects
            .filter((nested): nested is SliderRepeat => nested instanceof SliderRepeat)
            .map(repeat => new DrawableSliderRepeat(repeat, hitObject, color, hidden, appearance));
    }

    draw(ctx: CanvasRenderingContext2D, time: number): void {
        this.sliderBody.draw(ctx, time);
        this.sliderTicks.forEach((tick) => tick.draw(ctx, time));
        this.sliderRepeats.forEach((repeat) => repeat.draw(ctx, time));
        this.sliderBall.draw(ctx, time);
        this.sliderHead.draw(ctx, time);
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

