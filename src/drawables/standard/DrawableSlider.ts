import {DrawableStandardHitObject} from "./DrawableStandardHitObject";
import {Slider} from "osu-standard-stable";
import {Color4} from "osu-classes";
import {DrawableSliderBody} from "./DrawableSliderBody";
import {DrawableSliderHead} from "./DrawableSliderHead";
import {DrawableSliderBall} from "./DrawableSliderBall";

export class DrawableSlider extends DrawableStandardHitObject<Slider> {
    color: Color4;

    sliderBody: DrawableSliderBody;
    sliderHead: DrawableSliderHead;
    sliderBall: DrawableSliderBall;
    //sliderRepeat: DrawableSliderRepeat;
    //sliderTail: DrawableSliderTail;

    constructor(hitObject: Slider, color: Color4, hidden = false) {
        super(hitObject, hidden);
        this.color = color;

        const accentColor = new Color4(color.red / 4, color.green / 4, color.blue / 4);
        const borderColor = new Color4(color.red, color.green, color.blue);

        this.sliderBody = new DrawableSliderBody(hitObject, accentColor, borderColor, hidden);
        this.sliderHead = new DrawableSliderHead(hitObject, color, hidden);
        this.sliderBall = new DrawableSliderBall(this);
        //this.sliderRepeat = new DrawableSliderRepeat(hitObject, color);
        //this.sliderTail = new DrawableSliderTail(hitObject, color);
    }

    draw(ctx: CanvasRenderingContext2D, time: number) {
        this.sliderBody.draw(ctx, time);
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

