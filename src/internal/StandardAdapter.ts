import DefaultAppearance from "./appearance/DefaultAppearance";
import {Circle, Slider, Spinner, StandardHitObject} from "osu-standard-stable";
import {ModBitwise} from "osu-classes";
import {assertPreparedBeatmap, PreparedBeatmap} from "../loaders/PreparedBeatmap";
import {getStandardComboColors} from "../utils/StandardComboColors";
import {DrawableCircle} from "../drawables/standard/DrawableCircle";
import {DrawableSlider} from "../drawables/standard/DrawableSlider";
import {DrawableSpinner} from "../drawables/standard/DrawableSpinner";
import {DrawableStandardHitObject} from "../drawables/standard/DrawableStandardHitObject";
import {DrawableTimelineHitObject} from "../drawables/standard/DrawableTimelineHitObject";
import SliderPathBuffer from "../drawables/standard/SliderPathBuffer";

export function createPlayfieldObjects(prepared: PreparedBeatmap, pathBuffer: SliderPathBuffer): DrawableStandardHitObject<StandardHitObject>[] {
    assertPreparedBeatmap(prepared);
    const appearance = new DefaultAppearance();
    const colors = getStandardComboColors(prepared.beatmap);
    const hidden = prepared.beatmap.mods.has(ModBitwise.Hidden);
    return prepared.beatmap.hitObjects.flatMap<DrawableStandardHitObject<StandardHitObject>>(object => {
        const color = colors[object.comboIndexWithOffsets % colors.length];
        if (object instanceof Spinner) return [new DrawableSpinner(object, hidden, appearance)];
        if (object instanceof Slider) return [new DrawableSlider(object, color, hidden, pathBuffer, appearance)];
        if (object instanceof Circle) return [new DrawableCircle(object, color, hidden, appearance)];
        return [];
    });
}

export function createTimelineEntries(prepared: PreparedBeatmap, pathBuffer: SliderPathBuffer): DrawableTimelineHitObject[] {
    assertPreparedBeatmap(prepared);
    const appearance = new DefaultAppearance();
    const colors = getStandardComboColors(prepared.beatmap);
    return prepared.beatmap.hitObjects.map(object => new DrawableTimelineHitObject(
        object, colors[object.comboIndexWithOffsets % colors.length], prepared.clockRate, pathBuffer, appearance,
    ));
}
