import {DrawableManiaHitObject} from "./DrawableManiaHitObject";
import {Hold} from "osu-mania-stable";
import {Color4} from "osu-classes";

export class DrawableHoldNote extends DrawableManiaHitObject<Hold> {
    color: Color4;

    constructor(hitObject: Hold, color: Color4) {
        super(hitObject);
        this.color = color;
    }

    draw(ctx: CanvasRenderingContext2D, time: number) {
        throw new Error("Method not implemented.");
    }
}
