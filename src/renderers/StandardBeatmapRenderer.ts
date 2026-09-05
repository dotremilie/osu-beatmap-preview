import {Circle, Slider, Spinner, StandardBeatmap, StandardHitObject} from "osu-standard-stable";
import {ModBitwise} from "osu-classes";
import {DrawableSpinner} from "../drawables/standard/DrawableSpinner";
import {DrawableCircle} from "../drawables/standard/DrawableCircle";
import {DrawableSlider} from "../drawables/standard/DrawableSlider";
import BeatmapRenderer from "./BeatmapRenderer";
import {DrawableStandardHitObject} from "../drawables/standard/DrawableStandardHitObject";
import {getStandardComboColors} from "../utils/StandardComboColors";
import TimeIntervalIndex from "../utils/TimeIntervalIndex";
import {releaseSliderPathCache} from "../drawables/standard/SliderPathRasterCache";

export const CIRCLE_BORDER_WIDTH = 0.15;

export default class StandardBeatmapRenderer extends BeatmapRenderer<StandardBeatmap, DrawableStandardHitObject<StandardHitObject>> {
    private readonly intervalIndex: TimeIntervalIndex;
    private readonly visibleIndices: number[] = [];

    constructor(ctx: CanvasRenderingContext2D, beatmap: StandardBeatmap) {
        super(ctx, beatmap);

        this.intervalIndex = new TimeIntervalIndex(this.drawableHitObjects.map(object => ({
            startTime: object.hitObject.startTime - object.hitObject.timePreempt,
            endTime: (object instanceof DrawableSlider || object instanceof DrawableSpinner
                ? object.hitObject.endTime : object.hitObject.startTime) + object.HIT_DURATION,
        })));
    }

    protected initializeDrawableHitObjects(): void {
        const comboColors = getStandardComboColors(this.beatmap);

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

    public resize(width: number, height: number): void {
        releaseSliderPathCache(this.ctx);
    }

    public dispose(): void {
        releaseSliderPathCache(this.ctx);
    }

    public render(time: number): void {
        time = time * this.beatmap.difficulty.clockRate;
        this.intervalIndex.query(time, time, this.visibleIndices);

        for (const index of this.visibleIndices) {
            this.drawableHitObjects[index].draw(this.ctx, time);
        }

        for (const index of this.visibleIndices) {
            const object = this.drawableHitObjects[index];
            if (object instanceof DrawableSlider) {
                object.sliderHead.approachCircle.draw(this.ctx, time);
            }

            if (object instanceof DrawableCircle) {
                object.approachCircle.draw(this.ctx, time);
            }
        }
    }
}
