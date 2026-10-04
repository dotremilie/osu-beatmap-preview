import {sliderGeometry, visibleRaster} from "../../internal/SliderRasterGeometry";
import DefaultAppearance, {StandardAppearance} from "../../internal/appearance/DefaultAppearance";
import type {Color4, SliderPath, Vector2} from "osu-classes";
import SliderPathRasterCache from "./SliderPathRasterCache";

/** Draws the static geometry and colours of a slider path. */
export class DrawableSliderPath {
    static readonly ARGON_PRO_BODY_ALPHA = 0.92;

    constructor(
        public readonly path: SliderPath,
        public accentColor: Color4,
        public borderColor: Color4,
        public bodyAlpha = DrawableSliderPath.ARGON_PRO_BODY_ALPHA,
        private readonly rasterCache = new SliderPathRasterCache(),
        private readonly appearance: StandardAppearance = new DefaultAppearance(),
    ) {}

    draw(
        ctx: CanvasRenderingContext2D,
        position: Vector2,
        radius: number,
        opacity: number,
        points: readonly Vector2[] = this.path.path,
    ): void {
        if (opacity <= 0) return;

        const {pathRadius, innerPathRadius, padding} = sliderGeometry(radius);
        const raster = visibleRaster(ctx, position, points, padding);
        if (!raster) return;
        const {offsetX: x, offsetY: y, pixelWidth, pixelHeight} = raster;
        const borderStyle = DrawableSliderPath.rgba(this.borderColor, opacity);
        const bodyStyle = DrawableSliderPath.rgba(this.accentColor, opacity * this.bodyAlpha);
        const appearance = {x, y, pathRadius, innerPathRadius, borderStyle, bodyStyle};
        const buffer = this.rasterCache.get(ctx, this, {
            width: raster.width,
            height: raster.height,
            pixelWidth,
            pixelHeight,
            appearance,
            points,
        }, bufferContext => {
            this.appearance.sliderPath(bufferContext, points, appearance);
        });

        if (buffer) ctx.drawImage(buffer, raster.x, raster.y, raster.width, raster.height);
    }

    private static rgba(color: Color4, opacity: number): string {
        return `rgba(${color.red},${color.green},${color.blue},${opacity * color.alpha})`;
    }
}
