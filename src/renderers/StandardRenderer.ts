import {Circle, Slider, Spinner, StandardBeatmap, StandardHitObject} from "osu-standard-stable";
import {Color4, ModBitwise} from "osu-classes";
import {DrawableSpinner} from "../drawables/standard/DrawableSpinner";
import {DrawableCircle} from "../drawables/standard/DrawableCircle";
import {DrawableSlider} from "../drawables/standard/DrawableSlider";
import RulesetRenderer from "./Renderer";
import {DrawableStandardHitObject} from "../drawables/standard/DrawableStandardHitObject";

export const CIRCLE_BORDER_WIDTH = 0.15;

export default class StandardRenderer extends RulesetRenderer<StandardBeatmap, DrawableStandardHitObject<StandardHitObject>> {
    protected readonly DEFAULT_COLORS =  [
        new Color4(0, 202, 0),
        new Color4(18, 124, 255),
        new Color4(242, 24, 57),
        new Color4(255, 192, 0),
    ];

    protected initializeDrawableHitObjects(): void {
        if (this.beatmap.colors.comboColors.length === 0) {
            this.beatmap.colors.comboColors = this.DEFAULT_COLORS;
        }

        const {comboColors} = this.beatmap.colors;
        const hidden = this.beatmap.mods?.has(ModBitwise.Hidden) ?? false;

        this.beatmap.hitObjects.forEach((object) => {
            const color = comboColors[object.comboIndexWithOffsets % comboColors.length];

            if (object instanceof Spinner) {
                this.drawableHitObjects.push(new DrawableSpinner(object, hidden));
            } else if (object instanceof Slider) {
                this.drawableHitObjects.push(new DrawableSlider(object, color, hidden));
            } else if (object instanceof Circle) {
                this.drawableHitObjects.push(new DrawableCircle(object, color, hidden));
            }
        });

    }

    public render(time: number): void {
        time = time * this.beatmap.difficulty.clockRate;

        const hitObjects = this.drawableHitObjects.filter(object => {
            if (time < object.hitObject.startTime - object.hitObject.timePreempt) return false;

            if (object instanceof DrawableSlider || object instanceof DrawableSpinner) {
                return time <= object.hitObject.endTime + object.HIT_DURATION;
            }

            return time <= object.hitObject.startTime + object.HIT_DURATION;
        }).reverse();

        hitObjects.forEach(object => object.draw(this.ctx, time));

        hitObjects.forEach((object) => {
            if (object instanceof DrawableSlider) {
                object.sliderHead.approachCircle.draw(this.ctx, time);
            }

            if (object instanceof DrawableCircle) {
                object.approachCircle.draw(this.ctx, time);
            }
        });
    }
}
