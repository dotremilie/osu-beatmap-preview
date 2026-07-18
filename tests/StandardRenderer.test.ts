import {describe, expect, it} from "vitest";
import {Color4} from "osu-classes";
import {StandardBeatmap} from "osu-standard-stable";
import StandardRenderer from "../src/renderers/StandardRenderer";

const DEFAULT_COLORS = [
    new Color4(0, 202, 0),
    new Color4(18, 124, 255),
    new Color4(242, 24, 57),
    new Color4(255, 192, 0),
];

function createBeatmap(comboColors?: Color4[]): StandardBeatmap {
    return {
        colors: comboColors === undefined ? {} : {comboColors},
        hitObjects: [],
    } as unknown as StandardBeatmap;
}

function createRenderer(beatmap: StandardBeatmap): StandardRenderer {
    return new StandardRenderer({} as CanvasRenderingContext2D, beatmap);
}

describe("StandardRenderer combo colors", () => {
    it("uses the default colors when the beatmap has no Colours section", () => {
        const beatmap = createBeatmap();

        expect(() => createRenderer(beatmap)).not.toThrow();
        expect(beatmap.colors.comboColors).toEqual(DEFAULT_COLORS);
    });

    it("uses the default colors when comboColors is empty", () => {
        const beatmap = createBeatmap([]);

        createRenderer(beatmap);

        expect(beatmap.colors.comboColors).toEqual(DEFAULT_COLORS);
    });

    it("preserves custom combo colors", () => {
        const customColors = [
            new Color4(12, 34, 56),
            new Color4(78, 90, 123),
        ];
        const beatmap = createBeatmap(customColors);

        createRenderer(beatmap);

        expect(beatmap.colors.comboColors).toBe(customColors);
        expect(beatmap.colors.comboColors).toEqual(customColors);
    });
});
