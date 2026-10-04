import type {IBeatmap} from "osu-classes";
import {StandardRuleset} from "osu-standard-stable";
import BeatmapPreparation, {BeatmapLoaderOptions} from "../internal/BeatmapPreparation";
import {assertPreparedBeatmap, createPreparedBeatmap, PreparedBeatmap} from "./PreparedBeatmap";
export type {BeatmapLoaderOptions} from "../internal/BeatmapPreparation";

/** Prepares standard maps once for attachment to independent views. */
export default class BeatmapLoader {
    private readonly preparation = new BeatmapPreparation(new StandardRuleset());
    public loadBeatmapText(text: string, options: BeatmapLoaderOptions = {}): PreparedBeatmap {
        return createPreparedBeatmap(this.preparation.loadBeatmapText(text, options));
    }
    public loadBeatmap(beatmap: Readonly<IBeatmap> | PreparedBeatmap, options: BeatmapLoaderOptions = {}): PreparedBeatmap {
        if ("beatmap" in beatmap) {
            assertPreparedBeatmap(beatmap);
            return createPreparedBeatmap(this.preparation.loadBeatmap(beatmap.beatmap, options));
        }
        return createPreparedBeatmap(this.preparation.loadBeatmap(beatmap, options));
    }
}
