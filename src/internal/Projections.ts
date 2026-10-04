import type {Offset} from "../previewers/BeatmapPreviewer";
import type {CanvasProjection} from "./CanvasSurface";

export function standardPlayfieldProjection(offset: Offset = {x: 64, y: 48}): CanvasProjection {
    return (ctx, width, height) => {
        const scale = Math.min(width / 640, height / 480);
        ctx.translate((width - 640 * scale) / 2, (height - 480 * scale) / 2);
        ctx.scale(scale, scale);
        ctx.translate(offset.x, offset.y);
    };
}
export const timelineProjection: CanvasProjection = () => {};
