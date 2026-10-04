import {IBeatmap, Ruleset} from "osu-classes";
import {BeatmapDecoder} from "osu-parsers";

export interface BeatmapLoaderOptions { mods?: number; }

/** Ruleset-specific preparation without canvas or rendering state. */
export default class BeatmapPreparation<TRuleset extends Ruleset> {
    private readonly decoder = new BeatmapDecoder();
    constructor(private readonly ruleset: TRuleset) {}

    public loadBeatmapText(text: string, options: BeatmapLoaderOptions = {}): ReturnType<TRuleset["applyToBeatmapWithMods"]> {
        return this.loadBeatmap(this.decoder.decodeFromString(text), options);
    }

    public loadBeatmap(beatmap: Readonly<IBeatmap>, options: BeatmapLoaderOptions = {}): ReturnType<TRuleset["applyToBeatmapWithMods"]> {
        const source = beatmap.base ?? beatmap;
        const workingBeatmap = source.clone();
        // Conversion may share geometry and follow base references. Keep both isolated.
        workingBeatmap.base = undefined;
        const mods = this.ruleset.createModCombination(options.mods ?? 0);
        const result = this.ruleset.applyToBeatmapWithMods(workingBeatmap, mods) as ReturnType<TRuleset["applyToBeatmapWithMods"]>;
        result.base = source;
        return result;
    }
}
