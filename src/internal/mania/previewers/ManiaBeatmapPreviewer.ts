import BeatmapPreviewer, {BeatmapPreviewOptions} from "../../../previewers/BeatmapPreviewer";
import {ManiaBeatmap, ManiaRuleset} from "osu-mania-stable"
import ManiaRenderer from "../renderers/ManiaRenderer";

export default class ManiaBeatmapPreviewer extends BeatmapPreviewer<ManiaBeatmap, ManiaRenderer> {
    constructor(canvas: HTMLCanvasElement, options: BeatmapPreviewOptions = {}) {
        super(canvas, new ManiaRuleset(), (ctx, beatmap) => new ManiaRenderer(ctx, beatmap), options);
    }
}
