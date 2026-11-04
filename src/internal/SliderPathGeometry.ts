import type {Vector2} from "osu-classes";
interface PathRectangle { x: number; y: number; width: number; height: number; }
interface PathStrokeGeometry { pathRadius: number; innerPathRadius: number; padding: number; }
interface PathDrawRegion extends PathRectangle { pixelWidth: number; pixelHeight: number; offsetX: number; offsetY: number; }
export interface VertexBounds { minX: number; minY: number; maxX: number; maxY: number; }

export function sliderGeometry(radius: number): PathStrokeGeometry {
    const diameter = radius * 2;
    const borderThickness = (diameter * 2) * (2 / 58);
    const pathRadius = ((diameter * 2) - borderThickness * 4) / 2;
    return {pathRadius, innerPathRadius: pathRadius - borderThickness * 2, padding: pathRadius / 2 + 2};
}

export function getPathDrawRegion(ctx: CanvasRenderingContext2D, position: Vector2, points: readonly Vector2[], padding: number,
                                        localBounds = getVertexBounds(points)): PathDrawRegion | undefined {
    const bounds = pathBounds(position, localBounds, padding);
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

export function getVertexBounds(points: readonly Vector2[]): VertexBounds {
    let minX = 0;
    let minY = 0;
    let maxX = 0;
    let maxY = 0;

    for (const point of points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
    }

    return {minX, minY, maxX, maxY};
}

function pathBounds(position: Vector2, localBounds: VertexBounds, padding: number): PathRectangle {
    const x = Math.floor(position.x + localBounds.minX - padding);
    const y = Math.floor(position.y + localBounds.minY - padding);
    const right = Math.ceil(position.x + localBounds.maxX + padding);
    const bottom = Math.ceil(position.y + localBounds.maxY + padding);

    return {
        x,
        y,
        width: Math.max(1, right - x),
        height: Math.max(1, bottom - y),
    };
}
