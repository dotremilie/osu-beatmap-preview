import Renderer from "./Renderer";

export default abstract class BeatmapRenderer<TBeatmap, THitObject> extends Renderer {
    protected beatmap: TBeatmap;
    protected drawableHitObjects: THitObject[] = [];

    get getBeatmap(): Readonly<TBeatmap> {
        return this.beatmap;
    }

    constructor(ctx: CanvasRenderingContext2D, beatmap: TBeatmap) {
        super(ctx);

        this.beatmap = beatmap;
        this.initializeDrawableHitObjects();
    }

    /**
     * Initializes drawable hit objects for the specific renderer.
     */
    protected abstract initializeDrawableHitObjects(): void;
}
