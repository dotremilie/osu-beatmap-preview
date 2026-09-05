import {Color4} from "osu-classes";
import {StandardBeatmap} from "osu-standard-stable";

export function getStandardComboColors(beatmap: StandardBeatmap): Color4[] {
    if (!beatmap.colors.comboColors?.length) {
        return [
            new Color4(0, 202, 0),
            new Color4(18, 124, 255),
            new Color4(242, 24, 57),
            new Color4(255, 192, 0),
        ];
    }

    return beatmap.colors.comboColors;
}
