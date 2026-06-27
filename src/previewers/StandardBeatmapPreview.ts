import {StandardBeatmap, StandardRuleset} from "osu-standard-stable";
import StandardRenderer from "../renderers/StandardRenderer";
import BeatmapPreviewer, {BeatmapPreviewOptions} from "./BeatmapPreviewer";

export default class StandardBeatmapPreview extends BeatmapPreviewer<StandardBeatmap, StandardRenderer> {
    constructor(canvas: HTMLCanvasElement, options: BeatmapPreviewOptions = {}) {
        super(canvas, new StandardRuleset(), (ctx, beatmap) => new StandardRenderer(ctx, beatmap), options);
    }
}
