import { Positionable, Vector2 } from "@survive-the-night/game-server";
import { GameState } from "../state";

export interface Animation {
  duration: number;
  frames: {
    [k: number]: Vector2;
  };
}

export interface Animatable {
  getAnimation(): Animation;
}

export interface Renderable {
  render: (ctx: CanvasRenderingContext2D, gameState: GameState) => void;
}

export interface IClientEntity {}

export function getFrameIndex(
  startedAt: number,
  animation: {
    frames: number;
    duration: number;
  }
) {
  const { duration, frames } = animation;
  const elapsed = Date.now() - startedAt;
  const cyclePosition = elapsed % duration;
  const frameLength = duration / frames;
  const currentFrame = Math.floor(cyclePosition / frameLength);
  return currentFrame;
}

export function animate(startedAt: number, position: Vector2, animation: Animation): Vector2 {
  const { duration, frames } = animation;
  const currentProgress = (((Date.now() - startedAt) % duration) * 100) / duration;
  const framesSteps = Object.keys(frames).map((it) => Number.parseInt(it, 10));
  let currentFrameIdx = framesSteps.length - 1;

  for (let i = framesSteps.length - 1; i >= 0; i--) {
    if (currentProgress > framesSteps[i]) {
      currentFrameIdx = i;
      break;
    }
  }

  const nextFrameIdx = currentFrameIdx === framesSteps.length - 1 ? 0 : currentFrameIdx + 1;
  const currentFrameStep = framesSteps[currentFrameIdx];
  const nextFrameStep = framesSteps[nextFrameIdx];
  const { x: x0, y: y0 } = frames[currentFrameStep];
  const { x: x1, y: y1 } = frames[nextFrameStep];

  const frameLength =
    currentFrameStep > nextFrameStep
      ? 100 - currentFrameStep + nextFrameStep
      : nextFrameStep - currentFrameStep;

  const frameProgress = (currentProgress - currentFrameStep) / frameLength;

  return {
    x: position.x + x0 + (x1 - x0) * frameProgress,
    y: position.y + y0 + (y1 - y0) * frameProgress,
  };
}

export function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  position: Vector2,
  health: number,
  maxHealth: number
) {
  const healthBarWidth = 16;
  const healthBarHeight = 2;
  const healthBarY = position.y - healthBarHeight - 2;

  ctx.fillStyle = "#ff0000";
  ctx.fillRect(position.x, healthBarY, healthBarWidth, healthBarHeight);

  ctx.fillStyle = "#00ff00";
  const healthPercentage = health / maxHealth;
  ctx.fillRect(position.x, healthBarY, healthBarWidth * healthPercentage, healthBarHeight);
}
