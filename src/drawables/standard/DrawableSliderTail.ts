import {DrawableStandardHitObject} from "./DrawableStandardHitObject";
import {Slider, SliderTail} from "osu-standard-stable";
import {DrawableSlider} from "./DrawableSlider";
import {CIRCLE_BORDER_WIDTH} from "../../renderers/StandardRenderer";

export class DrawableSliderTail extends DrawableStandardHitObject<SliderTail> {
    get slider(): Slider {
        return this.drawableSlider?.hitObject;
    }

    protected get drawableSlider() {
        return this.parentHitObject as DrawableSlider;
    }

    constructor(hitObject: SliderTail) {
        super(hitObject);
    }

    draw(ctx: CanvasRenderingContext2D, time: number) {
        const {radius, stackedStartPosition} = this.hitObject;
        const {x, y} = stackedStartPosition;

        const opacity = this.opacity(time);

        ctx.lineWidth = radius * CIRCLE_BORDER_WIDTH;
        ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
        ctx.fillStyle = `rgba(${this.drawableSlider.color.red},${this.drawableSlider.color.green},${this.drawableSlider.color.blue},${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
}
