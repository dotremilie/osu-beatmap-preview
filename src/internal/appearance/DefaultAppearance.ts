import type {Color4} from "osu-classes";
import type {Vector2} from "osu-classes";
import type {RasterAppearance, SliderPathRasterContext} from "../../drawables/standard/SliderPathRasterCache";
import sliderPathPainter from "./SliderPathPainter";
import MathUtils from "../../utils/MathUtils";
import {DrawableSpinnerDisc} from "./SpinnerDisc";

/** Procedural painting only: all geometry and animation state are supplied by views. */
export default class DefaultAppearance {
    private readonly disc = new DrawableSpinnerDisc();

    public circle(ctx: CanvasRenderingContext2D, position: {x: number; y: number}, circleSize: number, color: Color4, opacity: number, comboNumber?: string): void {
        if (opacity <= 0) return;
        const {x, y} = position;

        const borderThickness = (circleSize * 2) * (2 / 58);
        const gradientThickness = borderThickness * 2.5;
        const outerGradientSize = (circleSize * 2) - borderThickness * 4;
        const innerGradientSize = outerGradientSize - gradientThickness * 2;
        const innerFillSize = innerGradientSize - gradientThickness * 2;

        ctx.lineWidth = borderThickness;
        ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, circleSize, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = `rgba(${color.red},${color.green},${color.blue},${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, outerGradientSize / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(${color.red / 1.5},${color.green / 1.5},${color.blue / 1.5},${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, innerGradientSize / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(${color.red / 4},${color.green / 4},${color.blue / 4},${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, innerFillSize / 2, 0, Math.PI * 2);
        ctx.fill();

        if (comboNumber !== undefined) {
            ctx.font = `700 ${circleSize * 0.7}px "Torus"`;
            ctx.textBaseline = "alphabetic";
            ctx.textAlign = "center";
            ctx.fillStyle = `rgba(255,255,255,${opacity})`;
            const bounds = ctx.measureText(comboNumber);
            ctx.fillText(
                comboNumber,
                x + (bounds.actualBoundingBoxLeft - bounds.actualBoundingBoxRight) / 2,
                y + (bounds.actualBoundingBoxAscent - bounds.actualBoundingBoxDescent) / 2,
            );
        }
    }

    public repeatEdge(ctx: CanvasRenderingContext2D, radius: number, offsetProgress: number): void {
        const borderThickness = radius * 4 / 58;
        const gradientThickness = borderThickness * 2.5;
        const edgeRadius = (radius * 2 - borderThickness * 4) / 2;
        const sideOffset = -radius * 12 / 64 * offsetProgress;

        ctx.save();
        try {
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
        } finally {
            ctx.restore();
        }
    }

    public repeatMain(ctx: CanvasRenderingContext2D, radius: number, scale: number, color: Color4): void {
        const unit = radius / 64;
        const width = 40 * unit * scale;
        const height = 20 * unit * scale;
        const lineHalfWidth = (width - height) / 2;

        ctx.save();
        try {

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
            ctx.strokeStyle = `rgb(${color.red / 4},${color.green / 4},${color.blue / 4})`;

            for (const centreX of [-3, 3]) {
                ctx.beginPath();
                ctx.moveTo((centreX - 2.5) * iconScale, -5 * iconScale);
                ctx.lineTo((centreX + 2.5) * iconScale, 0);
                ctx.lineTo((centreX - 2.5) * iconScale, 5 * iconScale);
                ctx.stroke();
            }
        } finally {
            ctx.restore();
        }
    }

    public sliderFollow(
        ctx: CanvasRenderingContext2D,
        opacity: number,
        radius: number,
        followScale: number,
        color: Color4,
        x: number,
        y: number,
    ): void {

        if (opacity <= 0) return;

        const followRadius = radius * followScale;
        const borderThickness = 4 * (radius / 64) * followScale;
        const gradient = ctx.createLinearGradient(0, y - followRadius, 0, y + followRadius);

        gradient.addColorStop(0, `rgb(${color.red},${color.green},${color.blue})`);
        gradient.addColorStop(1, `rgb(${color.red / 1.5},${color.green / 1.5},${color.blue / 1.5})`);

        ctx.save();
        try {
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha *= opacity;

            ctx.beginPath();
            ctx.arc(x, y, Math.max(0, followRadius - borderThickness / 2), 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.globalAlpha *= 0.3;
            ctx.fill();

            ctx.globalAlpha /= 0.3;
            ctx.lineWidth = borderThickness;
            ctx.strokeStyle = gradient;
            ctx.stroke();
        } finally {
            ctx.restore();
        }
    }

    public sliderBall(
        ctx: CanvasRenderingContext2D,
        opacity: number,
        radius: number,
        color: Color4,
        x: number,
        y: number,
        iconScale: number,
        rotation: number,
    ): void {

        if (opacity <= 0) return;

        const objectScale = radius / 64;
        const baseBorderThickness = 128 * (2 / 58);
        const borderThickness = baseBorderThickness * 2.5 * objectScale;
        const ballRadius = ((128 - baseBorderThickness * 4) / 2) * objectScale;
        const gradient = ctx.createLinearGradient(0, y - ballRadius, 0, y + ballRadius);

        gradient.addColorStop(0, `rgb(${color.red},${color.green},${color.blue})`);
        gradient.addColorStop(1, `rgb(${color.red / 1.5},${color.green / 1.5},${color.blue / 1.5})`);

        ctx.save();
        try {
            ctx.globalAlpha *= opacity;

            ctx.beginPath();
            ctx.arc(x, y, ballRadius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(x, y, Math.max(0, ballRadius - borderThickness / 2), 0, Math.PI * 2);
            ctx.lineWidth = borderThickness;
            ctx.strokeStyle = "rgb(255,255,255)";
            ctx.stroke();

            this.sliderBallIcon(ctx, x, y, objectScale, iconScale, rotation);
        } finally {
            ctx.restore();
        }
    }

    private sliderBallIcon(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        objectScale: number,
        iconScale: number,
        rotation: number,
    ): void {

        if (iconScale <= 0) return;

        const width = 48 * 0.6 * objectScale * iconScale;
        const height = 48 * 0.8 * objectScale * iconScale;

        ctx.save();
        try {
            ctx.translate(x, y);
            ctx.rotate(rotation);
            ctx.beginPath();
            ctx.moveTo(-width * 0.18, -height * 0.32);
            ctx.lineTo(width * 0.18, 0);
            ctx.lineTo(-width * 0.18, height * 0.32);
            ctx.lineWidth = 8 * objectScale * iconScale;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.strokeStyle = "rgb(255,255,255)";
            ctx.stroke();
        } finally {
            ctx.restore();
        }
    }

    public spinnerCentre(ctx: CanvasRenderingContext2D, scale: number, tracking: number): void {
        const diameter = MathUtils.lerp(tracking, 80, 40);

        ctx.save();
        try {
            ctx.scale(scale, scale);
            ctx.strokeStyle = "white";

            for (const [size, thickness] of [[diameter * 0.8, 10], [diameter, 3]]) {
                ctx.beginPath();
                ctx.arc(0, 0, Math.max(0, (size - thickness) / 2), 0, Math.PI * 2);
                ctx.lineWidth = thickness;
                ctx.stroke();
            }
        } finally {
            ctx.restore();
        }
    }

    public approachCircle(ctx: CanvasRenderingContext2D, position: {x: number; y: number}, radius: number, color: Color4, opacity: number, projectedRadius: number): void {
        if (opacity <= 0) return;
        ctx.lineWidth = radius * 0.09;
        ctx.strokeStyle = `rgba(${color.red},${color.green},${color.blue},${opacity})`;
        ctx.beginPath();
        ctx.arc(position.x, position.y, projectedRadius, 0, Math.PI * 2);
        ctx.stroke();
    }

    public marker(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: Color4, lineWidth: number): void {
        ctx.strokeStyle = `rgb(${color.red},${color.green},${color.blue})`;
        ctx.fillStyle = `rgb(${color.red / 4},${color.green / 4},${color.blue / 4})`;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    public tick(ctx: CanvasRenderingContext2D, position: {x:number; y:number}, diameter: number, borderThickness: number, color: Color4, opacity: number): void {
        ctx.save();
        try {
            ctx.globalAlpha *= opacity;
            ctx.beginPath();
            ctx.arc(position.x, position.y, Math.max(0, (diameter - borderThickness) / 2), 0, Math.PI * 2);
            ctx.lineWidth = borderThickness;
            ctx.strokeStyle = `rgb(${color.red},${color.green},${color.blue})`;
            ctx.stroke();
        } finally {
            ctx.restore();
        }
    }

    public sliderPath(ctx: SliderPathRasterContext, points: readonly Vector2[], appearance: RasterAppearance): void {
        const {x, y, pathRadius, innerPathRadius, borderStyle, bodyStyle} = appearance;
        sliderPathPainter.draw(ctx, points, x, y, pathRadius, innerPathRadius, borderStyle, bodyStyle);
    }

    public spinnerDisc(ctx: CanvasRenderingContext2D, progress: number, rotation: number, tracking: number, completion: number): void {
        this.disc.draw(ctx, progress, rotation, tracking, completion);
    }

}
export type StandardAppearance = Pick<DefaultAppearance,
    "circle" | "repeatEdge" | "repeatMain" | "sliderFollow" | "sliderBall" | "approachCircle" | "marker" | "tick" | "spinnerDisc" | "spinnerCentre" | "sliderPath">;
