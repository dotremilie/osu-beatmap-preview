import Renderer from "./Renderer";
import {assertPreparedBeatmap, PreparedBeatmap} from "../loaders/PreparedBeatmap";

export default abstract class BeatmapRenderer<TDrawable> extends Renderer {
    protected constructor(
        ctx: CanvasRenderingContext2D,
        protected readonly prepared: PreparedBeatmap,
        protected readonly drawableHitObjects: readonly TDrawable[],
    ) {
        super(ctx);
        assertPreparedBeatmap(prepared);
    }
    public get beatmap(): PreparedBeatmap["beatmap"] { return this.prepared.beatmap; }
}
