/**
 * 围棋核心规则（纯函数，无副作用）。
 *
 * 采用中国规则（数子法）：黑先、白贴 7.5 子；禁止自杀、禁止立即打劫；
 * 连续两次虚手进入数子。棋盘用一维数组表示，index = y * size + x。
 */

import type { Difficulty, Player } from "./gomoku";

export const GO_SIZES = [9, 13, 19] as const;
export type GoSize = (typeof GO_SIZES)[number];
export const GO_KOMI = 7.5;

export interface GoMove {
  x: number;
  y: number;
  p: Player;
  pass: boolean;
}

export interface GoState {
  size: GoSize;
  board: number[];
  moves: GoMove[];
  captures: { 1: number; 2: number };
  ko: number;
  passes: number;
}

export interface GoResult {
  kind: "win" | "draw";
  winner: 0 | Player;
  blackArea: number;
  whiteArea: number;
  margin: number;
  blackTerritory: number;
  whiteTerritory: number;
  komi: number;
}

export interface GoPlayResult {
  ok: boolean;
  reason?: "occupied" | "suicide" | "ko";
  board: number[];
  captured: number[];
  ko: number;
}

export const goIdx = (x: number, y: number, size: number): number => y * size + x;
export const goOther = (p: Player): Player => (p === 1 ? 2 : 1);

const NEIGHBOR_CACHE = new Map<number, number[][]>();

/** 每个交叉点的上下左右邻居（越界不包含）。 */
export function goNeighbors(size: number): number[][] {
  const hit = NEIGHBOR_CACHE.get(size);
  if (hit) return hit;
  const all: number[][] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const list: number[] = [];
      if (x > 0) list.push(y * size + x - 1);
      if (x < size - 1) list.push(y * size + x + 1);
      if (y > 0) list.push((y - 1) * size + x);
      if (y < size - 1) list.push((y + 1) * size + x);
      all.push(list);
    }
  }
  NEIGHBOR_CACHE.set(size, all);
  return all;
}

export function createGoBoard(size: GoSize = 19): number[] {
  return new Array<number>(size * size).fill(0);
}

export function createGoState(size: GoSize = 19): GoState {
  return {
    size,
    board: createGoBoard(size),
    moves: [],
    captures: { 1: 0, 2: 0 },
    ko: -1,
    passes: 0,
  };
}

export interface GoGroup {
  stones: number[];
  liberties: number[];
  player: number;
}

/** 找到 i 所在棋块与气；空点返回 null。 */
export function goGroup(
  board: readonly number[],
  size: number,
  i: number,
): GoGroup | null {
  const player = board[i];
  if (!player) return null;
  const nbr = goNeighbors(size);
  const seen = new Uint8Array(size * size);
  const stones: number[] = [i];
  const libs: number[] = [];
  const libSeen = new Uint8Array(size * size);
  seen[i] = 1;

  for (let head = 0; head < stones.length; head++) {
    const at = stones[head];
    for (const n of nbr[at]) {
      const v = board[n];
      if (v === 0) {
        if (!libSeen[n]) {
          libSeen[n] = 1;
          libs.push(n);
        }
      } else if (v === player && !seen[n]) {
        seen[n] = 1;
        stones.push(n);
      }
    }
  }
  return { stones, liberties: libs, player };
}

/** 棋盘上所有被提掉的棋子；调用方负责落子与轮次。 */
function removeDead(
  board: number[],
  size: number,
  player: number,
): { captured: number[]; board: number[] } {
  const nbr = goNeighbors(size);
  const dead: number[] = [];
  const checked = new Uint8Array(size * size);
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== player || checked[i]) continue;
    const g = goGroup(board, size, i)!;
    for (const s of g.stones) checked[s] = 1;
    if (g.liberties.length === 0) {
      for (const s of g.stones) {
        board[s] = 0;
        dead.push(s);
      }
    }
  }
  return { captured: dead, board };
}

/**
 * 落子。不修改入参；非法时 ok=false，board 原样返回。
 * ko 是对手上一手提掉单子后留下的禁止立即回提点。
 */
export function playGo(
  board: readonly number[],
  size: number,
  x: number,
  y: number,
  player: Player,
  ko = -1,
): GoPlayResult {
  if (x < 0 || y < 0 || x >= size || y >= size) {
    return { ok: false, reason: "occupied", board: board.slice(), captured: [], ko };
  }
  const i = goIdx(x, y, size);
  if (board[i] !== 0) {
    return { ok: false, reason: "occupied", board: board.slice(), captured: [], ko };
  }
  if (i === ko) {
    return { ok: false, reason: "ko", board: board.slice(), captured: [], ko };
  }

  let next = board.slice();
  next[i] = player;

  // 先提对方无气的棋块
  const opponent = goOther(player);
  const first = removeDead(next, size, opponent);
  next = first.board;
  const captured = first.captured;

  // 再检查自己是否自杀（提子后仍无气）
  const own = goGroup(next, size, i);
  if (!own || own.liberties.length === 0) {
    return { ok: false, reason: "suicide", board: board.slice(), captured: [], ko };
  }

  // 单子提单子、且己方也只有一口气：形成打劫，禁止立即回提
  let nextKo = -1;
  if (
    captured.length === 1 &&
    own.stones.length === 1 &&
    own.liberties.length === 1
  ) {
    nextKo = captured[0];
  }

  return { ok: true, board: next, captured, ko: nextKo };
}

/** 从棋谱重建局面；遇到非法手返回 null。 */
export function goStateFromMoves(
  size: GoSize,
  moves: readonly GoMove[],
): GoState | null {
  let board = createGoBoard(size);
  let ko = -1;
  let passes = 0;
  const captures = { 1: 0, 2: 0 };
  const list: GoMove[] = [];

  for (let n = 0; n < moves.length; n++) {
    const m = moves[n];
    if (!m || (m.p !== 1 && m.p !== 2)) return null;
    if (m.pass) {
      passes++;
      ko = -1;
      list.push({ x: -1, y: -1, p: m.p, pass: true });
      continue;
    }
    const r = playGo(board, size, m.x, m.y, m.p, ko);
    if (!r.ok) return null;
    board = r.board;
    ko = r.ko;
    passes = 0;
    captures[m.p] += r.captured.length;
    list.push({ x: m.x, y: m.y, p: m.p, pass: false });
  }

  return { size, board, moves: list, captures, ko, passes };
}

/** 显示用坐标：D4。跳过 I，列从 A 开始；行从下往上数。 */
export function goCoord(x: number, y: number, size: number): string {
  const letters = "ABCDEFGHJKLMNOPQRST";
  return `${letters[x] ?? "?"}${size - y}`;
}

export interface GoScoreDetail {
  blackStones: number;
  whiteStones: number;
  blackTerritory: number;
  whiteTerritory: number;
  blackArea: number;
  whiteArea: number;
  komi: number;
  winner: 0 | Player;
  margin: number;
}

/** 标记为死子的棋子不参与计算，其空点按围空归属。 */
export function scoreGo(
  board: readonly number[],
  size: number,
  dead: readonly number[] = [],
  komi = GO_KOMI,
): GoScoreDetail {
  const b = board.slice();
  for (const i of dead) {
    if (i >= 0 && i < b.length) b[i] = 0;
  }

  let blackStones = 0;
  let whiteStones = 0;
  for (const v of b) {
    if (v === 1) blackStones++;
    else if (v === 2) whiteStones++;
  }

  const nbr = goNeighbors(size);
  const seen = new Uint8Array(size * size);
  let blackTerritory = 0;
  let whiteTerritory = 0;

  for (let i = 0; i < b.length; i++) {
    if (b[i] !== 0 || seen[i]) continue;
    const region: number[] = [i];
    seen[i] = 1;
    let touchBlack = false;
    let touchWhite = false;
    for (let head = 0; head < region.length; head++) {
      for (const n of nbr[region[head]]) {
        if (b[n] === 0) {
          if (!seen[n]) {
            seen[n] = 1;
            region.push(n);
          }
        } else if (b[n] === 1) touchBlack = true;
        else touchWhite = true;
      }
    }
    if (touchBlack && !touchWhite) blackTerritory += region.length;
    else if (touchWhite && !touchBlack) whiteTerritory += region.length;
  }

  const blackArea = blackStones + blackTerritory;
  const whiteArea = whiteStones + whiteTerritory + komi;
  const margin = Math.abs(blackArea - whiteArea);
  const winner: 0 | Player =
    margin === 0 ? 0 : blackArea > whiteArea ? 1 : 2;
  return {
    blackStones,
    whiteStones,
    blackTerritory,
    whiteTerritory,
    blackArea,
    whiteArea,
    komi,
    winner,
    margin,
  };
}

/** 把结果转成一句中文，例如「黑棋 3.5 子胜」。 */
export function goResultText(result: GoScoreDetail): string {
  if (result.winner === 0) return "和棋";
  const side = result.winner === 1 ? "黑棋" : "白棋";
  return `${side} ${result.margin.toFixed(1)} 子胜`;
}

/** 9/13/19 路星位（含天元）。 */
export function goStars(size: GoSize): readonly [number, number][] {
  if (size === 9) {
    return [
      [2, 2],
      [6, 2],
      [2, 6],
      [6, 6],
      [4, 4],
    ];
  }
  if (size === 13) {
    return [
      [3, 3],
      [9, 3],
      [3, 9],
      [9, 9],
      [6, 6],
    ];
  }
  return [
    [3, 3],
    [9, 3],
    [15, 3],
    [3, 9],
    [9, 9],
    [15, 9],
    [3, 15],
    [9, 15],
    [15, 15],
  ];
}

/** 当前局面是否已经连续两次虚手（应当进入数子）。 */
export function goAwaitingScore(passes: number): boolean {
  return passes >= 2;
}

/** 难度名称（与五子棋共用）。 */
export const GO_LEVEL_NAME: Record<Difficulty, string> = {
  easy: "简单",
  normal: "普通",
  hard: "困难",
  hell: "地狱",
};
