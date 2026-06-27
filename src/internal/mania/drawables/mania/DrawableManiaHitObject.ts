import DrawableHitObject from "../../../../drawables/DrawableHitObject";
import {ManiaHitObject} from "osu-mania-stable";

export abstract class DrawableManiaHitObject<T extends ManiaHitObject> extends DrawableHitObject<T> {
    opacity(time: number): number {
        return 1;
    };

    scale(time: number): number {
        return 1;
    };

    x(time: number) {
        return 1;
    }

    y(time: number) {
        return 1;
    }

    abstract draw(ctx: CanvasRenderingContext2D, time: number): void;
}
