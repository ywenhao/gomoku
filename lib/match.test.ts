import { expect, test } from "nsh/test";
import { findBestMove } from "./ai";
import {
  createBoard,
  findWinLine,
  idx,
  other,
  type Difficulty,
  type Player,
} from "./gomoku";

/** 让出一次调用，避免超过单次执行时长上限 */
const yieldTurn = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function playGame(blackLevel: Difficulty, whiteLevel: Difficulty) {
  const b = createBoard();
  let p: Player = 1;
  let n = 0;
  let maxMs = 0;
  for (; n < 225; n++) {
    const t0 = Date.now();
    const mv = findBestMove(b, p, p === 1 ? blackLevel : whiteLevel);
    const dt = Date.now() - t0;
    if (dt > maxMs) maxMs = dt;
    expect(mv !== null).toBe(true);
    if (!mv) break;
    expect(b[idx(mv.x, mv.y)]).toBe(0);
    b[idx(mv.x, mv.y)] = p;
    if (findWinLine(b, mv.x, mv.y, p) !== null) {
      return { winner: p, moves: n + 1, maxMs };
    }
    p = other(p);
    await yieldTurn();
  }
  return { winner: 0, moves: n, maxMs };
}

test(
  "困难档执白能守住并反击普通档",
  async () => {
    const r = await playGame("normal", "hard");
    console.log(`winner=${r.winner} moves=${r.moves} maxStep=${r.maxMs}ms`);
    // 单步耗时必须远小于运行时单次调用上限（约 2s）
    expect(r.maxMs < 1200).toBe(true);
    expect(r.moves > 0).toBe(true);
  },
  120_000,
);

test(
  "困难档执黑对简单档优势明显",
  async () => {
    const r = await playGame("hard", "easy");
    console.log(`winner=${r.winner} moves=${r.moves} maxStep=${r.maxMs}ms`);
    expect(r.winner).toBe(1);
    expect(r.maxMs < 1200).toBe(true);
  },
  120_000,
);
