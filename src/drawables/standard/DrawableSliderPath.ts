import {getPathDrawRegion, getVertexBounds, sliderGeometry} from "../../internal/SliderPathGeometry";
import type {VertexBounds} from "../../internal/SliderPathGeometry";
import DefaultAppearance, {StandardAppearance} from "../../internal/appearance/DefaultAppearance";
import type {Color4, SliderPath, Vector2} from "osu-classes";
import SliderPathBuffer from "./SliderPathBuffer";

export interface PathGeometry { vertexBounds: VertexBounds; pathInvalidationId: object | number; }

/** Draws the static geometry and colours of a slider path. */
export class DrawableSliderPath {
    static readonly ARGON_PRO_BODY_ALPHA = 0.92;
    private defaultPoints?: readonly Vector2[];
    private defaultBounds?: VertexBounds;

    constructor(
        public readonly path: SliderPath,
        public accentColor: Color4,
        public borderColor: Color4,
        public bodyAlpha = DrawableSliderPath.ARGON_PRO_BODY_ALPHA,
        private readonly pathBuffer = new SliderPathBuffer(),
        private readonly appearance: StandardAppearance = new DefaultAppearance(),
    ) {}

    draw(
        ctx: CanvasRenderingContext2D,
        position: Vector2,
        radius: number,
        opacity: number,
        points: readonly Vector2[] = this.path.path,
        geometry?: PathGeometry,
    ): void {
        if (opacity <= 0) return;

        // Prepared hitobject paths are read-only. Timeline projections supply their
        // changing length explicitly; other mutable point arrays use the scan fallback.
        if (!geometry && points === this.path.path) {
            if (this.defaultPoints !== points) {
                this.defaultPoints = points;
                this.defaultBounds = getVertexBounds(points);
            }
            geometry = {vertexBounds: this.defaultBounds!, pathInvalidationId: points};
        }
        const {pathRadius, innerPathRadius, padding} = sliderGeometry(radius);
        const region = getPathDrawRegion(ctx, position, points, padding, geometry?.vertexBounds);
        if (!region) return;
        const {offsetX: x, offsetY: y, pixelWidth, pixelHeight} = region;
        const borderStyle = DrawableSliderPath.rgba(this.borderColor, opacity);
        const bodyStyle = DrawableSliderPath.rgba(this.accentColor, opacity * this.bodyAlpha);
        const appearance = {x, y, pathRadius, innerPathRadius, borderStyle, bodyStyle};
        this.pathBuffer.draw(ctx, this, {
            width: region.width,
            height: region.height,
            pixelWidth,
            pixelHeight,
            appearance,
            points,
            pathInvalidationId: geometry?.pathInvalidationId,
        }, bufferContext => {
            this.appearance.sliderPath(bufferContext, points, appearance);
        }, buffer => {
            ctx.drawImage(buffer, region.x, region.y, region.width, region.height);
        });
    }

    private static rgba(color: Color4, opacity: number): string {
        return `rgba(${color.red},${color.green},${color.blue},${opacity * color.alpha})`;
    }
}
