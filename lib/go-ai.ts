/**
 * 围棋 AI：气、提子、打吃与位置价值启发式。
 *
 * 四档强度：
 * - 简单：在合法点里随机挑，常下出松散的棋。
 * - 普通：优先提子、救被打吃的棋，兼顾角边。
 * - 困难：取启发式最高分，避免自紧气与填自己的眼。
 * - 地狱：再向前看一手对手的最佳应手，并做提子/打吃战术过滤。
 *
 * 全部为纯计算，不读写全局状态。
 */

import type { Difficulty, Player } from "./gomoku";
import {
  goGroup,
  goNeighbors,
  goOther,
  goStars,
  playGo,
  type GoSize,
} from "./go";

export interface GoAiChoice {
  x: number;
  y: number;
  pass: boolean;
}

interface LevelConfig {
  /** 进入随机/择优池的候选数 */
  width: number;
  /** 评估时的随机噪声，越大越弱 */
  noise: number;
  /** 时间预算（毫秒） */
  deadlineMs: number;
  /** 地狱档向前看对手应手的候选数，0 表示不看 */
  reply: number;
}

const LEVELS: Record<Difficulty, LevelConfig> = {
  easy: { width: 14, noise: 180, deadlineMs: 30, reply: 0 },
  normal: { width: 8, noise: 55, deadlineMs: 120, reply: 0 },
  hard: { width: 4, noise: 12, deadlineMs: 420, reply: 0 },
  hell: { width: 3, noise: 4, deadlineMs: 1300, reply: 6 },
};

export interface GoMoveOptions {
  random?: () => number;
  deadlineMs?: number;
}

interface Candidate {
  i: number;
  x: number;
  y: number;
  value: number;
  captured: number;
}

const DIAG = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;

/** 是否是自己的真眼（填进去通常等于自毁）。 */
function isEye(
  board: readonly number[],
  size: number,
  i: number,
  player: Player,
): boolean {
  const x = i % size;
  const y = (i - x) / size;
  const nbr = goNeighbors(size);
  for (const n of nbr[i]) if (board[n] !== player) return false;

  let own = 0;
  let empty = 0;
  let edge = 0;
  for (const [dx, dy] of DIAG) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= size || ny >= size) {
      edge++;
      continue;
    }
    const v = board[ny * size + nx];
    if (v === player) own++;
    else if (v === 0) empty++;
    else return false;
  }
  if (edge >= 2) return own >= 1;
  if (edge === 1) return own >= 2;
  return own >= 2 && own + empty >= 3;
}

function neighborsOfStone(
  board: readonly number[],
  size: number,
  distance: number,
): boolean[] {
  const near = new Array<boolean>(size * size).fill(false);
  const nbr = goNeighbors(size);
  for (let i = 0; i < board.length; i++) {
    if (board[i] === 0) continue;
    const seen = new Set<number>([i]);
    let frontier = [i];
    for (let d = 0; d < distance; d++) {
      const next: number[] = [];
      for (const at of frontier) {
        for (const n of nbr[at]) {
          if (seen.has(n)) continue;
          seen.add(n);
          near[n] = true;
          next.push(n);
        }
      }
      frontier = next;
    }
  }
  return near;
}

function openingPoints(size: GoSize): number[][] {
  const stars = goStars(size);
  return stars.map(([x, y]) => [x, y]);
}

/**
 * 单点启发式评分。返回 null 表示非法。
 * 评分刻意保持廉价，19 路也能在一帧内跑完几十个候选。
 */
function evaluateMove(
  board: readonly number[],
  size: number,
  player: Player,
  x: number,
  y: number,
  ko: number,
  stoneCount: number,
): Candidate | null {
  const i = y * size + x;
  const r = playGo(board, size, x, y, player, ko);
  if (!r.ok) return null;

  const own = goGroup(r.board, size, i);
  if (!own) return null;
  const captured = r.captured.length;
  let value = captured * 145;
  if (captured > 0) value += 30;

  const libs = own.liberties.length;
  value += Math.min(libs, 7) * 4.2;
  if (libs === 1 && captured === 0) value -= 62;
  else if (libs === 2) value -= 3;
  if (own.stones.length > 1) value += Math.min(own.stones.length, 10) * 1.6;

  // 接上自己的棋块、救被打吃的棋
  const nbr = goNeighbors(size);
  let ownAdj = 0;
  const seen = new Set<number>();
  for (const n of nbr[i]) {
    const v = r.board[n];
    if (v === player) {
      ownAdj++;
      const g = goGroup(r.board, size, n);
      if (g) {
        const key = Math.min(...g.stones);
        if (!seen.has(key)) {
          seen.add(key);
          if (g.liberties.length === 1) value += 8;
        }
      }
    }
  }
  if (ownAdj >= 2) value += 7;

  // 打吃对手的棋块：下一步就有提子机会
  const checked = new Set<number>();
  for (const n of nbr[i]) {
    if (r.board[n] !== goOther(player)) continue;
    const g = goGroup(r.board, size, n);
    if (!g) continue;
    const key = Math.min(...g.stones);
    if (checked.has(key)) continue;
    checked.add(key);
    if (g.liberties.length === 1) value += 23 + Math.min(g.stones.length, 5) * 2;
    else if (g.liberties.length === 2) value += 4;
  }

  // 不填自己的眼
  if (captured === 0 && isEye(board, size, i, player)) value -= 260;

  const edge = Math.min(x, y, size - 1 - x, size - 1 - y);
  if (edge === 0) value -= 12;
  else if (edge === 1) value -= 2;
  else if (edge === 2 || edge === 3) value += 7;
  else value += 1;

  // 开局优先角部星位附近
  if (stoneCount < Math.max(10, size / 2)) {
    let corner = 99;
    for (const [sx, sy] of openingPoints(size as GoSize)) {
      const d = Math.max(Math.abs(x - sx), Math.abs(y - sy));
      if (d < corner) corner = d;
    }
    value += Math.max(0, 12 - corner * 4);
  }

  return { i, x, y, value, captured };
}

function candidates(
  board: readonly number[],
  size: number,
  player: Player,
  ko: number,
  width: number,
): Candidate[] {
  const stones: number[] = [];
  for (let i = 0; i < board.length; i++) if (board[i] !== 0) stones.push(i);

  const near = neighborsOfStone(board, size, 2);
  const points: number[] = [];
  for (let i = 0; i < near.length; i++) {
    if (near[i] && board[i] === 0) points.push(i);
  }

  // 空盘或棋盘极空：直接看星位
  if (stones.length === 0) {
    points.length = 0;
    for (const [x, y] of openingPoints(size as GoSize)) {
      points.push(y * size + x);
    }
    const center = (size - 1) / 2;
    points.push(Math.floor(center) * size + Math.floor(center));
  }

  // 边缘的候选也都补上（打劫、做眼常发生在边角）
  const list: Candidate[] = [];
  for (const i of points) {
    const x = i % size;
    const y = (i - x) / size;
    const c = evaluateMove(board, size, player, x, y, ko, stones.length);
    if (c) list.push(c);
  }
  list.sort((a, b) => b.value - a.value);
  if (list.length > width) list.length = width;
  return list;
}

function pickWeighted(
  list: readonly Candidate[],
  random: () => number,
): Candidate {
  const top = list.slice(0, Math.min(6, list.length));
  if (top.length === 1) return top[0];
  const weights = top.map((_, i) => Math.max(1, 7 - i * 1.4));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (let i = 0; i < top.length; i++) {
    r -= weights[i];
    if (r <= 0) return top[i];
  }
  return top[0];
}

/**
 * 选择一手。棋盘上没有合法点或只剩自己的眼时返回 pass。
 */
export function findGoMove(
  board: readonly number[],
  size: GoSize,
  player: Player,
  level: Difficulty,
  ko = -1,
  options?: GoMoveOptions,
): GoAiChoice {
  const config = LEVELS[level] ?? LEVELS.normal;
  const random = options?.random ?? Math.random;
  const deadline = Date.now() + (options?.deadlineMs ?? config.deadlineMs);

  const list = candidates(board, size, player, ko, Math.max(config.width, 8));
  if (list.length === 0) return { x: -1, y: -1, pass: true };

  if (level === "easy") {
    const pick = pickWeighted(list, random);
    return { x: pick.x, y: pick.y, pass: false };
  }
  if (level === "normal") {
    const pick = pickWeighted(list.slice(0, config.width), random);
    return { x: pick.x, y: pick.y, pass: false };
  }

  if (level === "hell") {
    // 向前看一手：对手最好的应手值越大，这一手越危险。
    let best = list[0];
    let bestScore = -Infinity;
    const width = Math.min(list.length, config.width + 4);
    for (let n = 0; n < width; n++) {
      if (Date.now() > deadline) break;
      const c = list[n];
      const played = playGo(board, size, c.x, c.y, player, ko);
      if (!played.ok) continue;
      const reply = candidates(
        played.board,
        size,
        goOther(player),
        played.ko,
        2,
      );
      const threat = reply.length > 0 ? reply[0].value : 0;
      // 如果对手下一手能提掉我们一大块，这一手要明显扣分。
      let safety = 0;
      if (threat > 100) safety = threat * 0.9;
      const score = c.value - safety + (n === 0 ? 2 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return { x: best.x, y: best.y, pass: false };
  }

  // hard：在最高分附近做一次提子确认，避免漏掉立刻能提的大块
  const best = list[0];
  const capture = list.find((c) => c.captured >= 2);
  if (capture && capture.value >= best.value - 8) {
    return { x: capture.x, y: capture.y, pass: false };
  }
  if (best.value < -180 && list.length <= 2) {
    return { x: -1, y: -1, pass: true };
  }
  return { x: best.x, y: best.y, pass: false };
}

/** 兜底：任意合法点；没有则虚手。 */
export function fallbackGoMove(
  board: readonly number[],
  size: number,
  player: Player,
  ko = -1,
): GoAiChoice {
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== 0) continue;
    const x = i % size;
    const y = (i - x) / size;
    if (playGo(board, size, x, y, player, ko).ok) {
      return { x, y, pass: false };
    }
  }
  return { x: -1, y: -1, pass: true };
}
