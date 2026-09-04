import {StandardBeatmap, StandardRuleset} from "osu-standard-stable";
import StandardBeatmapRenderer from "../renderers/StandardBeatmapRenderer";
import BeatmapPreviewer, {BeatmapPreviewOptions} from "./BeatmapPreviewer";

export default class StandardBeatmapPreviewer extends BeatmapPreviewer<StandardBeatmap, StandardBeatmapRenderer> {
    constructor(canvas: HTMLCanvasElement, options: BeatmapPreviewOptions = {}) {
        super(canvas, new StandardRuleset(), (ctx, beatmap) => new StandardBeatmapRenderer(ctx, beatmap), options);
    }
}
