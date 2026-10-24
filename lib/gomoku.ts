/**
 * 五子棋核心规则（纯函数，无副作用）。
 * 棋盘用一维数组表示：index = y * SIZE + x，0 空、1 黑、2 白。
 */

export const SIZE = 15;
export const CELL_COUNT = SIZE * SIZE;
export const WIN_LEN = 5;

export type Player = 1 | 2;
export type Difficulty = "easy" | "normal" | "hard" | "hell";
export type Mode = "pve" | "pvp" | "aiai";
export type GameKind = "gomoku" | "go";

export interface Move {
  x: number;
  y: number;
  p: Player;
}

export interface GameResult {
  kind: "win" | "draw";
  /** 0 表示和棋 */
  winner: 0 | Player;
  /** 构成五连的格子下标（和棋为空） */
  line: number[];
}

export const idx = (x: number, y: number): number => y * SIZE + x;

export const inBoard = (x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < SIZE && y < SIZE;

export const other = (p: Player): Player => (p === 1 ? 2 : 1);

export function createBoard(): number[] {
  return new Array<number>(CELL_COUNT).fill(0);
}

export function boardFromMoves(moves: readonly Move[]): number[] {
  const b = createBoard();
  for (const m of moves) b[idx(m.x, m.y)] = m.p;
  return b;
}

export function isEmptyBoard(b: readonly number[]): boolean {
  for (let i = 0; i < CELL_COUNT; i++) if (b[i] !== 0) return false;
  return true;
}

export function isFull(b: readonly number[]): boolean {
  for (let i = 0; i < CELL_COUNT; i++) if (b[i] === 0) return false;
  return true;
}

const DX = [1, 0, 1, 1] as const;
const DY = [0, 1, 1, -1] as const;

/**
 * 判断 (x, y) 落子后是否连成五子；返回整条连线的下标（含两端延伸），否则 null。
 */
export function findWinLine(
  b: readonly number[],
  x: number,
  y: number,
  p: Player,
): number[] | null {
  for (let d = 0; d < 4; d++) {
    const dx = DX[d];
    const dy = DY[d];
    const line: number[] = [idx(x, y)];

    let i = 1;
    while (inBoard(x + dx * i, y + dy * i) && b[idx(x + dx * i, y + dy * i)] === p) {
      line.push(idx(x + dx * i, y + dy * i));
      i++;
    }

    const back: number[] = [];
    let j = 1;
    while (inBoard(x - dx * j, y - dy * j) && b[idx(x - dx * j, y - dy * j)] === p) {
      back.unshift(idx(x - dx * j, y - dy * j));
      j++;
    }

    if (back.length + line.length >= WIN_LEN) return back.concat(line);
  }
  return null;
}

/** 落子并返回结果（不修改入参）。 */
export function applyMove(
  b: readonly number[],
  moves: readonly Move[],
  m: Move,
): { board: number[]; moves: Move[]; result: GameResult | null } {
  const next = b.slice();
  next[idx(m.x, m.y)] = m.p;
  const nextMoves = moves.concat([m]);
  const line = findWinLine(next, m.x, m.y, m.p);
  let result: GameResult | null = null;
  if (line) result = { kind: "win", winner: m.p, line };
  else if (isFull(next)) result = { kind: "draw", winner: 0, line: [] };
  return { board: next, moves: nextMoves, result };
}
