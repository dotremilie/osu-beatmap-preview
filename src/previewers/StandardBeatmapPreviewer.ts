import {StandardBeatmap, StandardRuleset} from "osu-standard-stable";
import StandardBeatmapRenderer from "../renderers/StandardBeatmapRenderer";
import BeatmapPreviewer, {BeatmapPreviewOptions} from "./BeatmapPreviewer";

export default class StandardBeatmapPreviewer extends BeatmapPreviewer<StandardBeatmap, StandardBeatmapRenderer> {
    constructor(canvas: HTMLCanvasElement, options: BeatmapPreviewOptions = {}) {
        super(canvas, new StandardRuleset(), (ctx, beatmap) => new StandardBeatmapRenderer(ctx, beatmap), options);
    }

    protected override applyTransform(): void {
        const scale = Math.min(this.width / 640, this.height / 480);
        this.ctx.translate((this.width - 640 * scale) / 2, (this.height - 480 * scale) / 2);
        this.ctx.scale(scale, scale);
        super.applyTransform();
    }
}
