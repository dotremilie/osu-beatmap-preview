import MathUtils from "../../utils/MathUtils";

/** Procedural counterparts of ArgonSpinnerRingArc, ProgressArc and Ticks. */
export class DrawableSpinnerDisc {
    private static readonly RADIUS = 192;
    private static readonly RING_RADIUS = DrawableSpinnerDisc.RADIUS - 8;
    private static readonly TICKS = Array.from({length: 25}, (_, index) => {
        const angle = index / 25 * Math.PI * 2;
        const radius = DrawableSpinnerDisc.RING_RADIUS * 0.75;

        return {x: Math.sin(angle) * radius, y: Math.cos(angle) * radius, rotation: -angle - Math.PI * 2 / 3};
    });

    draw(
        ctx: CanvasRenderingContext2D,
        progress: number,
        rotation: number,
        tracking: number,
        completion: number,
    ): void {
        this.drawGlow(ctx, progress, tracking);
        this.drawTicks(ctx, rotation);

        const ringRadius = DrawableSpinnerDisc.RING_RADIUS;
        const sweep = MathUtils.lerp(completion, 0.31, 0.5) * Math.PI * 2;
        const thickness = ringRadius * MathUtils.lerp(completion, 0.02, 0.044);

        ctx.strokeStyle = "white";
        this.drawArc(ctx, ringRadius, thickness, -Math.PI / 2, sweep);
        this.drawArc(ctx, ringRadius, thickness, Math.PI / 2, sweep);
        this.drawProgress(ctx, progress, completion);
    }

    private drawGlow(ctx: CanvasRenderingContext2D, progress: number, tracking: number): void {
        const scale = MathUtils.lerp(progress, 0.1, 0.98);
        const radius = DrawableSpinnerDisc.RING_RADIUS * scale;
        const outerRadius = (DrawableSpinnerDisc.RING_RADIUS + 40) * scale;
        const gradient = ctx.createRadialGradient(0, 0, radius, 0, 0, outerRadius);
        const alpha = MathUtils.lerp(tracking, 0.2, 0.4);

        gradient.addColorStop(0, `rgba(252,97,143,${alpha})`);
        gradient.addColorStop(0.3, `rgba(252,97,143,${alpha * 0.4})`);
        gradient.addColorStop(1, "rgba(252,97,143,0)");

        ctx.beginPath();
        ctx.arc(0, 0, outerRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    }

    private drawTicks(ctx: CanvasRenderingContext2D, rotation: number): void {
        ctx.save();
        ctx.rotate(rotation);
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        const transform = ctx.getTransform();
        ctx.shadowColor = "rgba(255,255,255,0.2)";
        // Canvas shadows use device pixels rather than the current transform.
        ctx.shadowBlur = 30 * Math.hypot(transform.a, transform.b);

        for (const tick of DrawableSpinnerDisc.TICKS) {
            ctx.save();
            ctx.translate(tick.x, tick.y);
            ctx.rotate(tick.rotation);

            // A 30x5 hollow capsule, with an inward 2px border.
            ctx.beginPath();
            ctx.moveTo(-12.5, -1.5);
            ctx.lineTo(12.5, -1.5);
            ctx.arc(12.5, 0, 1.5, -Math.PI / 2, Math.PI / 2);
            ctx.lineTo(-12.5, 1.5);
            ctx.arc(-12.5, 0, 1.5, Math.PI / 2, Math.PI * 1.5);
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
        }

        ctx.restore();
    }

    private drawProgress(ctx: CanvasRenderingContext2D, progress: number, completion: number): void {
        const radius = DrawableSpinnerDisc.RADIUS;
        const thickness = radius * 0.12;
        const sweep = 0.15 * Math.PI * 2;

        ctx.save();
        ctx.globalAlpha *= 1 - completion;

        for (const angle of [0, Math.PI]) {
            if (progress < 1) {
                ctx.strokeStyle = "rgba(255,255,255,0.25)";
                this.drawArc(ctx, radius, thickness, angle, sweep);
            }

            if (progress <= 0) continue;

            const x = Math.cos(angle) * (radius - thickness / 2);
            const glow = ctx.createRadialGradient(x, 0, 0, x, 0, 70);
            glow.addColorStop(0, `rgba(171,255,255,${0.5 * progress})`);
            glow.addColorStop(1, "rgba(171,255,255,0)");
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(x, 0, 70, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = "white";
            this.drawArc(ctx, radius, thickness, angle, sweep * progress * (1 - completion));
        }

        ctx.restore();
    }

    private drawArc(
        ctx: CanvasRenderingContext2D,
        radius: number,
        thickness: number,
        angle: number,
        sweep: number,
    ): void {
        if (sweep <= 0) return;

        ctx.beginPath();
        ctx.arc(0, 0, radius - thickness / 2, angle - sweep / 2, angle + sweep / 2);
        ctx.lineWidth = thickness;
        ctx.lineCap = "round";
        ctx.stroke();
    }
}
