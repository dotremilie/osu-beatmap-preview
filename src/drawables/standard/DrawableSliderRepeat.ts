import {DrawableStandardHitObject} from "./DrawableStandardHitObject";
import {Slider, SliderRepeat} from "osu-standard-stable";
import {DrawableSlider} from "./DrawableSlider";
import {CIRCLE_BORDER_WIDTH} from "../../renderers/StandardRenderer";

export class DrawableSliderRepeat extends DrawableStandardHitObject<SliderRepeat> {
    get slider(): Slider {
        return this.drawableSlider?.hitObject;
    }

    protected get drawableSlider() {
        return this.parentHitObject as DrawableSlider;
    }

    private animDuration: number;

    constructor(hitObject: SliderRepeat) {
        super(hitObject);
        this.animDuration = Math.min(300, hitObject.spanDuration)
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

    opacity(time: number): number {
        let opacity = super.opacity(time);

        if (this.hitObject.repeatIndex > 0) {
            opacity = Math.min(1, Math.max(0, 1 - (time - this.hitObject.startTime) / this.animDuration));
        }

        return opacity;
    }
}
