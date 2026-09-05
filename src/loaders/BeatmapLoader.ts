import {IBeatmap, Ruleset} from "osu-classes";
import {BeatmapDecoder} from "osu-parsers";

export interface BeatmapLoaderOptions {
    mods?: number;
}

/** Prepares beatmaps independently of any canvas or renderer. */
export default class BeatmapLoader<TRuleset extends Ruleset> {
    private readonly decoder = new BeatmapDecoder();

    constructor(private readonly ruleset: TRuleset) {}

    public loadBeatmapText(osuText: string, options: BeatmapLoaderOptions = {}): Readonly<ReturnType<TRuleset["applyToBeatmapWithMods"]>> {
        return this.loadBeatmap(this.decoder.decodeFromString(osuText), options);
    }

    /** Externally prepared maps need an unmodified base to replace their existing mods. */
    public loadBeatmap(beatmap: Readonly<IBeatmap>, options: BeatmapLoaderOptions = {}): Readonly<ReturnType<TRuleset["applyToBeatmapWithMods"]>> {
        const mods = this.ruleset.createModCombination(options.mods ?? 0);
        // Start from the decoded source so replacing mods cannot compound difficulty changes.
        const source = beatmap.base ?? beatmap;
        const workingBeatmap = source.clone();
        // Converters can share geometry with their input and follow its base reference.
        // Apply mods to an isolated copy while retaining the pristine source for later loads.
        workingBeatmap.base = undefined;
        const appliedBeatmap = this.ruleset.applyToBeatmapWithMods(workingBeatmap, mods) as ReturnType<TRuleset["applyToBeatmapWithMods"]>;
        appliedBeatmap.base = source;
        return appliedBeatmap;
    }
}
