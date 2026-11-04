import type {CursorState} from "../../internal/autoplay/StandardReplay";
import type {TrailSample} from "../../internal/autoplay/StandardCursor";

// TextureStore uses ScaleAdjust = 2: DisplayWidth = 10 / 2, while Argon
// additionally sets Scale = 0.8 / 2. Its final stamp diameter is therefore 2.
// Apply the same container scale to the local interval (DisplayWidth / 2.5 * 0.4).
const TRAIL_RADIUS = 1;
const TRAIL_SPACING = 0.32;
const TRAIL_ALPHA = 0.8;

/** Procedural cursor painting; receives evaluated geometry and animation only. */
export default class DrawableCursor {
    public draw(ctx: CanvasRenderingContext2D, cursor: CursorState, trail: readonly TrailSample[]): void {
        ctx.save();
        try {
            this.trail(ctx, trail);
            this.cursor(ctx, cursor);
        } finally {
            ctx.restore();
        }
    }

    private trail(ctx: CanvasRenderingContext2D, samples: readonly TrailSample[]): void {
        ctx.save();
        try {
            ctx.globalCompositeOperation = "lighter";
            ctx.shadowBlur = 0;
            let distanceToNextStamp = TRAIL_SPACING;
            for (let index = 1; index < samples.length; index++) {
                const previous = samples[index - 1];
                const current = samples[index];
                const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
                // Interpolate spatial stamps between the bounded 120 Hz samples.
                // Interpolate remaining lifetime before applying Argon's fade curve.
                const previousLifetime = Math.pow(previous.opacity, 0.25);
                const currentLifetime = Math.pow(current.opacity, 0.25);
                for (; distanceToNextStamp <= distance; distanceToNextStamp += TRAIL_SPACING) {
                    const progress = distanceToNextStamp / distance;
                    this.trailStamp(ctx,
                        previous.x + (current.x - previous.x) * progress,
                        previous.y + (current.y - previous.y) * progress,
                        previous.scale + (current.scale - previous.scale) * progress,
                        Math.pow(previousLifetime + (currentLifetime - previousLifetime) * progress, 4));
                }
                distanceToNextStamp -= distance;
            }
        } finally {
            ctx.restore();
        }
    }

    private trailStamp(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, opacity: number): void {
        const radius = TRAIL_RADIUS * scale;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        // Approximate the upstream texture's soft white alpha profile procedurally.
        const alpha = opacity * TRAIL_ALPHA;
        gradient.addColorStop(0, `rgba(255,255,255,${alpha * 0.65})`);
        gradient.addColorStop(0.25, `rgba(255,255,255,${alpha * 0.58})`);
        gradient.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.35})`);
        gradient.addColorStop(0.75, `rgba(255,255,255,${alpha * 0.1})`);
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    private cursor(ctx: CanvasRenderingContext2D, cursor: CursorState): void {
        const radius = 14 * cursor.scale;
        const borderWidth = 6 * cursor.scale;
        const gradient = ctx.createLinearGradient(0, cursor.y - radius, 0, cursor.y + radius);
        gradient.addColorStop(0, "#FC618F");
        gradient.addColorStop(1, "#BB1A41");
        ctx.fillStyle = "rgba(101,39,57,0.4)";
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = borderWidth;
        ctx.strokeStyle = gradient;
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, radius - borderWidth / 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 2 * cursor.scale;
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, radius - cursor.scale, 0, Math.PI * 2);
        ctx.stroke();

        // Argon only expands the outer ring; its centre remains at the base size.
        ctx.shadowColor = "rgba(171,255,255,0.4)";
        const transform = ctx.getTransform();
        ctx.shadowBlur = 20 * Math.hypot(transform.a, transform.b);
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, 2.8, 0, Math.PI * 2);
        ctx.fill();
    }
}
