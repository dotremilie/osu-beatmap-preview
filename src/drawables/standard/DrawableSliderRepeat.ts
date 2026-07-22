import type {Slider, SliderRepeat} from "osu-standard-stable";
import {DrawableStandardHitObject} from "./DrawableStandardHitObject";
import {DrawableSlider} from "./DrawableSlider";

/**
 * Canvas implementation of osu!'s Argon reverse arrow.
 *
 * The original consists of a pulsing capsule and double-chevron layered over
 * `repeat-edge-piece`. The edge piece is reproduced with canvas gradients so
 * rendering does not depend on loading a skin texture.
 */
export class DrawableSliderRepeat extends DrawableStandardHitObject<SliderRepeat> {
    private static readonly LOOP_DURATION = 300;
    private static readonly MOVE_OUT_DURATION = 35;
    private static readonly MOVE_IN_DURATION = 250;
    private static readonly FADE_IN_DURATION = 150;

    private readonly animDuration: number;

    get slider(): Slider {
        return this.drawableSlider.hitObject;
    }

    protected get drawableSlider(): DrawableSlider {
        return this.parentHitObject as DrawableSlider;
    }

    constructor(hitObject: SliderRepeat, hidden = false) {
        super(hitObject, hidden);
        this.animDuration = Math.min(300, hitObject.spanDuration);
    }

    draw(ctx: CanvasRenderingContext2D, time: number): void {
        const opacity = this.opacity(time);

        if (opacity <= 0) return;

        const {radius, stackedStartPosition} = this.hitObject;
        const pulse = this.pulseAt(time);
        const hitScale = this.scale(time);

        ctx.save();
        ctx.translate(stackedStartPosition.x, stackedStartPosition.y);
        ctx.rotate(this.rotation());
        ctx.scale(hitScale, hitScale);
        ctx.globalAlpha *= opacity;

        this.drawEdgePiece(ctx, radius, pulse.sideOffset);
        this.drawMainPiece(ctx, radius, pulse.mainScale);

        ctx.restore();
    }

    opacity(time: number): number {
        const fadeInStart = this.hitObject.startTime - this.hitObject.timePreempt;
        const fadeInDuration = this.hitObject.repeatIndex > 0
            ? Math.min(this.hitObject.spanDuration, DrawableSliderRepeat.FADE_IN_DURATION)
            : DrawableSliderRepeat.FADE_IN_DURATION;
        const fadeInOpacity = DrawableStandardHitObject.clamp01(
            (time - fadeInStart) / Math.max(1, fadeInDuration),
        );

        if (time <= this.hitObject.startTime) return fadeInOpacity;
        if (this.hidden) return 0;

        const fadeOutProgress = DrawableStandardHitObject.clamp01(
            (time - this.hitObject.startTime) / Math.max(1, this.animDuration),
        );

        // Easing.Out in osu!framework is an out-quadratic easing.
        return fadeInOpacity * (1 - DrawableSliderRepeat.easeOut(fadeOutProgress));
    }

    scale(time: number): number {
        if (time <= this.hitObject.startTime) return 1;

        const progress = DrawableStandardHitObject.clamp01(
            (time - this.hitObject.startTime) / Math.max(1, this.animDuration),
        );

        return 1 + DrawableSliderRepeat.easeOut(progress) * 0.5;
    }

    private pulseAt(time: number): {mainScale: number; sideOffset: number} {
        const animationStartTime = this.hitObject.startTime - this.hitObject.timePreempt;
        const loopTime = ((time - animationStartTime) % DrawableSliderRepeat.LOOP_DURATION
            + DrawableSliderRepeat.LOOP_DURATION) % DrawableSliderRepeat.LOOP_DURATION;

        let progress: number;

        if (loopTime < DrawableSliderRepeat.MOVE_OUT_DURATION) {
            progress = DrawableSliderRepeat.easeOut(loopTime / DrawableSliderRepeat.MOVE_OUT_DURATION);

            return {
                mainScale: 1 + progress * 0.3,
                sideOffset: progress,
            };
        }

        progress = DrawableSliderRepeat.easeOut(DrawableStandardHitObject.clamp01(
            (loopTime - DrawableSliderRepeat.MOVE_OUT_DURATION) / DrawableSliderRepeat.MOVE_IN_DURATION,
        ));

        return {
            mainScale: 1.3 - progress * 0.3,
            sideOffset: 1 - progress,
        };
    }

    /** Returns the angle of the slider path pointing inward from this repeat. */
    private rotation(): number {
        const path = this.slider.path.path;

        if (path.length < 2) return 0;

        const isRepeatAtEnd = this.hitObject.repeatIndex % 2 === 0;
        const start = isRepeatAtEnd ? path.length - 1 : 0;
        const direction = isRepeatAtEnd ? -1 : 1;
        const origin = path[start];

        for (let i = start + direction; i >= 0 && i < path.length; i += direction) {
            const x = path[i].x - origin.x;
            const y = path[i].y - origin.y;

            if (Math.abs(x) > Number.EPSILON || Math.abs(y) > Number.EPSILON) {
                return Math.atan2(y, x);
            }
        }

        return 0;
    }

    /** Draws the Argon repeat-edge-piece using canvas gradients. */
    private drawEdgePiece(ctx: CanvasRenderingContext2D, radius: number, offsetProgress: number): void {
        const borderThickness = radius * 4 / 58;
        const gradientThickness = borderThickness * 2.5;
        const edgeRadius = (radius * 2 - borderThickness * 4) / 2;
        const sideOffset = -radius * 12 / 64 * offsetProgress;

        ctx.save();
        ctx.translate(sideOffset, 0);

        // The source texture only contains the left side of the circular edge.
        ctx.beginPath();
        ctx.rect(-edgeRadius, -edgeRadius, edgeRadius, edgeRadius * 2);
        ctx.clip();

        ctx.beginPath();
        ctx.arc(0, 0, edgeRadius, 0, Math.PI * 2);
        const fill = ctx.createLinearGradient(-edgeRadius, 0, 0, 0);
        fill.addColorStop(0, "rgba(255,255,255,0.5)");
        fill.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = fill;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, 0, edgeRadius - gradientThickness / 2, 0, Math.PI * 2);
        ctx.lineWidth = gradientThickness;
        ctx.strokeStyle = "rgba(255,255,255,1)";
        ctx.stroke();

        ctx.restore();
    }

    private drawMainPiece(ctx: CanvasRenderingContext2D, radius: number, scale: number): void {
        const unit = radius / 64;
        const width = 40 * unit * scale;
        const height = 20 * unit * scale;
        const lineHalfWidth = (width - height) / 2;

        ctx.save();

        // A round-capped line is the canvas equivalent of Argon's 40x20 Circle.
        ctx.beginPath();
        ctx.moveTo(-lineHalfWidth, 0);
        ctx.lineTo(lineHalfWidth, 0);
        ctx.lineCap = "round";
        ctx.lineWidth = height;
        ctx.strokeStyle = "rgba(255,255,255,1)";
        ctx.stroke();

        const iconScale = unit * scale;
        ctx.lineWidth = 2.5 * iconScale;
        ctx.lineCap = "butt";
        ctx.lineJoin = "miter";
        ctx.strokeStyle = `rgb(${this.drawableSlider.color.red / 4},${this.drawableSlider.color.green / 4},${this.drawableSlider.color.blue / 4})`;

        for (const centreX of [-3, 3]) {
            ctx.beginPath();
            ctx.moveTo((centreX - 2.5) * iconScale, -5 * iconScale);
            ctx.lineTo((centreX + 2.5) * iconScale, 0);
            ctx.lineTo((centreX - 2.5) * iconScale, 5 * iconScale);
            ctx.stroke();
        }

        ctx.restore();
    }

    private static easeOut(progress: number): number {
        return progress * (2 - progress);
    }
}
