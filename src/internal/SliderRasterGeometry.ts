import type {Vector2} from "osu-classes";
interface Bounds { x: number; y: number; width: number; height: number; }
interface SliderGeometry { pathRadius: number; innerPathRadius: number; padding: number; }
interface VisibleRaster extends Bounds { pixelWidth: number; pixelHeight: number; offsetX: number; offsetY: number; }

export function sliderGeometry(radius: number): SliderGeometry {
    const diameter = radius * 2;
    const borderThickness = (diameter * 2) * (2 / 58);
    const pathRadius = ((diameter * 2) - borderThickness * 4) / 2;
    return {pathRadius, innerPathRadius: pathRadius - borderThickness * 2, padding: pathRadius / 2 + 2};
}

export function visibleRaster(ctx: CanvasRenderingContext2D, position: Vector2, points: readonly Vector2[], padding: number): VisibleRaster | undefined {
    const bounds = pathBounds(position, points, padding);
    const transform = ctx.getTransform();
    const determinant = transform.a * transform.d - transform.b * transform.c;
    if (!Number.isFinite(determinant) || determinant === 0) return;

    // Intersect the path with the canvas in local coordinates before allocating.
    // Aspire sliders may extend tens of thousands of pixels off the playfield.
    const visiblePoints = [
        [0, 0], [ctx.canvas.width, 0],
        [0, ctx.canvas.height], [ctx.canvas.width, ctx.canvas.height],
    ].map(([x, y]) => ({
        x: (transform.d * (x - transform.e) - transform.c * (y - transform.f)) / determinant,
        y: (transform.a * (y - transform.f) - transform.b * (x - transform.e)) / determinant,
    }));
    const right = Math.min(bounds.x + bounds.width, Math.ceil(Math.max(...visiblePoints.map(point => point.x))));
    const bottom = Math.min(bounds.y + bounds.height, Math.ceil(Math.max(...visiblePoints.map(point => point.y))));
    bounds.x = Math.max(bounds.x, Math.floor(Math.min(...visiblePoints.map(point => point.x))));
    bounds.y = Math.max(bounds.y, Math.floor(Math.min(...visiblePoints.map(point => point.y))));
    bounds.width = right - bounds.x;
    bounds.height = bottom - bounds.y;
    if (bounds.width <= 0 || bounds.height <= 0) return;

    // The transform includes both playfield scale and device pixel ratio.
    const pixelWidth = Math.ceil(bounds.width * Math.max(1, Math.hypot(transform.a, transform.b)));
    const pixelHeight = Math.ceil(bounds.height * Math.max(1, Math.hypot(transform.c, transform.d)));
    return {...bounds, pixelWidth, pixelHeight, offsetX: position.x - bounds.x, offsetY: position.y - bounds.y};
}

function pathBounds(
    position: Vector2,
    points: readonly Vector2[],
    padding: number,
): Bounds {
    let minX = position.x;
    let minY = position.y;
    let maxX = position.x;
    let maxY = position.y;

    for (const point of points) {
        minX = Math.min(minX, position.x + point.x);
        minY = Math.min(minY, position.y + point.y);
        maxX = Math.max(maxX, position.x + point.x);
        maxY = Math.max(maxY, position.y + point.y);
    }

    const x = Math.floor(minX - padding);
    const y = Math.floor(minY - padding);
    const right = Math.ceil(maxX + padding);
    const bottom = Math.ceil(maxY + padding);

    return {
        x,
        y,
        width: Math.max(1, right - x),
        height: Math.max(1, bottom - y),
    };
}
