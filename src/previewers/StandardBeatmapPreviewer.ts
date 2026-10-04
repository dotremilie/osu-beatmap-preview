import StandardBeatmapRenderer from "../renderers/StandardBeatmapRenderer";
import BeatmapPreviewer, {BeatmapPreviewOptions} from "./BeatmapPreviewer";
import {standardPlayfieldProjection} from "../internal/Projections";

export interface StandardBeatmapPreviewOptions extends BeatmapPreviewOptions {
    autoplay?: boolean;
    cursorTrail?: boolean;
}

export default class StandardBeatmapPreviewer extends BeatmapPreviewer<StandardBeatmapRenderer> {
    private readonly configuration: {autoplay: boolean; cursorTrail: boolean};

    constructor(canvas: HTMLCanvasElement, options: StandardBeatmapPreviewOptions = {}) {
        const configuration = {autoplay: options.autoplay ?? false, cursorTrail: options.cursorTrail ?? true};
        super(canvas, (ctx, prepared) => new StandardBeatmapRenderer(ctx, prepared, configuration), standardPlayfieldProjection(options.offset), options);
        this.configuration = configuration;
    }

    public get autoplay(): boolean { return this.configuration.autoplay; }
    public set autoplay(enabled: boolean) {
        this.configuration.autoplay = enabled;
        if (this.attachedRenderer) this.attachedRenderer.autoplay = enabled;
    }

    public get cursorTrail(): boolean { return this.configuration.cursorTrail; }
    public set cursorTrail(enabled: boolean) {
        this.configuration.cursorTrail = enabled;
        if (this.attachedRenderer) this.attachedRenderer.cursorTrail = enabled;
    }
}
