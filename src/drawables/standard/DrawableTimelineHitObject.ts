import {Color4, SliderPath, Vector2} from "osu-classes";
import {Slider, SliderRepeat, Spinner, StandardHitObject} from "osu-standard-stable";
import MathUtils from "../../utils/MathUtils";
import TimelineViewport from "../../utils/TimelineViewport";
import {DrawableCircle} from "./DrawableCircle";
import {DrawableSliderHead} from "./DrawableSliderHead";
import {DrawableSliderBody} from "./DrawableSliderBody";
import {DrawableSliderPath} from "./DrawableSliderPath";

/** Projects existing drawable visuals onto playback time without modifying their hitobjects. */
export class DrawableTimelineHitObject {
    public readonly startTime: number;
    public readonly endTime: number;
    private readonly markerTimes: number[];
    private readonly head: DrawableCircle;
    private readonly sliderBody?: DrawableSliderBody;
    private readonly spinnerBody?: DrawableSliderPath;
    private readonly position = new Vector2(0, 0);
    private readonly bodyPoints = [new Vector2(0, 0), new Vector2(0, 0)];

    constructor(
        private readonly hitObject: StandardHitObject,
        color: Color4,
        clockRate: number,
    ) {
        this.startTime = hitObject.startTime / clockRate;
        this.endTime = (hitObject instanceof Slider || hitObject instanceof Spinner
            ? hitObject.endTime
            : hitObject.startTime) / clockRate;

        const repeats = hitObject instanceof Slider
            ? hitObject.nestedHitObjects.filter(object => object instanceof SliderRepeat)
            : [];
        this.markerTimes = [...repeats.map(object => object.startTime / clockRate), this.endTime];
        const displayColor = hitObject instanceof Spinner ? new Color4(160, 160, 160) : color;
        this.head = hitObject instanceof Slider
            ? new DrawableSliderHead(hitObject, displayColor)
            : new DrawableCircle(hitObject, displayColor);

        const accentColor = new Color4(displayColor.red / 4, displayColor.green / 4, displayColor.blue / 4);
        if (hitObject instanceof Slider) {
            this.sliderBody = new DrawableSliderBody(hitObject, accentColor, displayColor, false, 1);
        } else if (hitObject instanceof Spinner) {
            this.spinnerBody = new DrawableSliderPath(new SliderPath(), accentColor, displayColor, 1);
        }
    }

    public draw(ctx: CanvasRenderingContext2D, time: number, viewport: TimelineViewport, width: number, y: number): void {
        ctx.globalAlpha = 1;
        this.drawBody(ctx, time, viewport, width, y);
        this.drawHead(ctx, time, viewport, width, y);
    }

    private drawBody(ctx: CanvasRenderingContext2D, time: number, viewport: TimelineViewport, width: number, y: number): void {
        if (this.endTime <= this.startTime) return;

        const startX = viewport.positionAtTime(this.startTime, time, width);
        const endX = viewport.positionAtTime(this.endTime, time, width);
        const radius = viewport.objectRadius;
        if (startX - radius > width || endX + radius < 0) return;

        // Bound paths even when a long object spans far beyond a zoomed view.
        const left = Math.max(-radius * 2, startX);
        const right = Math.min(width + radius * 2, endX);

        this.position.x = left;
        this.position.y = y;
        this.bodyPoints[1].x = right - left;
        if (this.sliderBody) {
            this.sliderBody.drawAt(ctx, this.position, radius, 1, this.bodyPoints);
        } else {
            this.spinnerBody?.draw(ctx, this.position, radius, 1, this.bodyPoints);
        }

        for (const markerTime of this.markerTimes) {
            const markerRadius = radius * (markerTime === this.endTime ? 0.45 : 0.25);
            const x = viewport.positionAtTime(markerTime, time, width);
            if (x < -markerRadius || x > width + markerRadius) continue;

            this.drawMarker(ctx, x, y, markerRadius, radius * 2 / 13);
        }

        if (this.hitObject instanceof Spinner) {
            ctx.fillStyle = "#ddd";
            ctx.font = `${radius * 10 / 13}px "Torus", sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("Spin", MathUtils.clamp((startX + endX) / 2, 16, width - 16), y);
        }
    }

    private drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, lineWidth: number): void {
        const {red, green, blue} = this.head.color;
        ctx.strokeStyle = `rgb(${red},${green},${blue})`;
        ctx.fillStyle = `rgb(${red / 4},${green / 4},${blue / 4})`;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    private drawHead(ctx: CanvasRenderingContext2D, time: number, viewport: TimelineViewport, width: number, y: number): void {
        const startX = viewport.positionAtTime(this.startTime, time, width);
        const radius = viewport.objectRadius;
        if (startX < -radius || startX > width + radius) return;

        this.position.x = startX;
        this.position.y = y;
        this.head.drawAt(ctx, this.position, radius, 1, !(this.hitObject instanceof Spinner));
    }
}
