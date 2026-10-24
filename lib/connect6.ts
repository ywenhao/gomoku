/**
 * 六子棋：19 路棋盘，黑棋第一手只下一子，之后每方每手连下两子，
 * 横竖斜先连成六子或更多者胜。规则和胜负判定都是纯函数。
 */

import {
  other,
  type Difficulty,
  type GameResult,
  type Player,
} from "./gomoku";

export const C6_SIZE = 19;
export const C6_WIN = 6;
export const C6_CELLS = C6_SIZE * C6_SIZE;

export interface C6Move {
  x: number;
  y: number;
  p: Player;
}

export interface C6State {
  board: number[];
  moves: C6Move[];
  turn: Player;
  /** 本手还可以下几子：开局黑棋 1，之后 2 */
  left: number;
  result: GameResult | null;
}

export const c6Idx = (x: number, y: number): number => y * C6_SIZE + x;

export function createConnect6(): C6State {
  return {
    board: new Array<number>(C6_CELLS).fill(0),
    moves: [],
    turn: 1,
    left: 1,
    result: null,
  };
}

export function c6InBoard(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < C6_SIZE && y < C6_SIZE;
}

const DX = [1, 0, 1, 1] as const;
const DY = [0, 1, 1, -1] as const;

export function c6WinLine(
  board: readonly number[],
  x: number,
  y: number,
  p: Player,
): number[] | null {
  for (let d = 0; d < 4; d++) {
    const dx = DX[d];
    const dy = DY[d];
    const line: number[] = [c6Idx(x, y)];
    for (let k = 1; k < C6_WIN + 1; k++) {
      const nx = x + dx * k;
      const ny = y + dy * k;
      if (!c6InBoard(nx, ny) || board[c6Idx(nx, ny)] !== p) break;
      line.push(c6Idx(nx, ny));
    }
    const back: number[] = [];
    for (let k = 1; k < C6_WIN + 1; k++) {
      const nx = x - dx * k;
      const ny = y - dy * k;
      if (!c6InBoard(nx, ny) || board[c6Idx(nx, ny)] !== p) break;
      back.unshift(c6Idx(nx, ny));
    }
    if (line.length + back.length >= C6_WIN) return back.concat(line);
  }
  return null;
}

/** 落一子；非法（越界、占用、已结束）返回 null。 */
export function playConnect6(
  state: C6State,
  x: number,
  y: number,
): C6State | null {
  if (state.result || !c6InBoard(x, y)) return null;
  const i = c6Idx(x, y);
  if (state.board[i] !== 0) return null;

  const board = state.board.slice();
  board[i] = state.turn;
  const moves = state.moves.concat([{ x, y, p: state.turn }]);
  const line = c6WinLine(board, x, y, state.turn);

  if (line) {
    return {
      board,
      moves,
      turn: state.turn,
      left: 0,
      result: { kind: "win", winner: state.turn, line },
    };
  }
  if (board.every((v) => v !== 0)) {
    return {
      board,
      moves,
      turn: state.turn,
      left: 0,
      result: { kind: "draw", winner: 0, line: [] },
    };
  }

  if (state.left > 1) {
    return { board, moves, turn: state.turn, left: state.left - 1, result: null };
  }
  return {
    board,
    moves,
    turn: other(state.turn),
    left: 2,
    result: null,
  };
}

export function c6LegalMoves(state: C6State): number[] {
  if (state.result) return [];
  const out: number[] = [];
  for (let i = 0; i < state.board.length; i++) if (state.board[i] === 0) out.push(i);
  return out;
}

/** 棋型分：连子越长、两端越空，分越高。 */
function pointScore(
  board: readonly number[],
  x: number,
  y: number,
  p: Player,
): number {
  let total = 0;
  for (let d = 0; d < 4; d++) {
    const dx = DX[d];
    const dy = DY[d];
    let run = 1;
    let open = 0;
    for (const sign of [1, -1] as const) {
      let k = 1;
      while (k < C6_WIN) {
        const nx = x + dx * k * sign;
        const ny = y + dy * k * sign;
        if (!c6InBoard(nx, ny)) break;
        const v = board[c6Idx(nx, ny)];
        if (v === p) {
          run++;
          k++;
          continue;
        }
        if (v === 0) open++;
        break;
      }
    }
    if (run >= C6_WIN) total += 1_000_000;
    else if (run === 5) total += open > 0 ? 120_000 : 24_000;
    else if (run === 4) total += open > 0 ? 12_000 : 1_800;
    else if (run === 3) total += open > 0 ? 900 : 180;
    else if (run === 2) total += open > 0 ? 90 : 24;
    else total += open > 0 ? 10 : 2;
  }
  return total;
}

function pairScore(
  board: number[],
  a: number,
  b: number,
  p: Player,
): number {
  const ax = a % C6_SIZE;
  const ay = (a - ax) / C6_SIZE;
  const bx = b % C6_SIZE;
  const by = (b - bx) / C6_SIZE;
  board[a] = p;
  const first = pointScore(board, ax, ay, p);
  board[b] = p;
  const second = pointScore(board, bx, by, p);
  board[a] = 0;
  board[b] = 0;
  return first + second + (first > 90_000 && second > 90_000 ? 900_000 : 0);
}

function candidates(state: C6State): number[] {
  const empty: number[] = [];
  let stones = 0;
  for (let i = 0; i < state.board.length; i++) {
    if (state.board[i] !== 0) stones++;
  }
  if (stones === 0) {
    const center = c6Idx(9, 9);
    return [center];
  }
  for (let y = 0; y < C6_SIZE; y++) {
    for (let x = 0; x < C6_SIZE; x++) {
      const i = c6Idx(x, y);
      if (state.board[i] !== 0) continue;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (!c6InBoard(x + dx, y + dy)) continue;
          if (state.board[c6Idx(x + dx, y + dy)] !== 0) {
            near = true;
            break;
          }
        }
      }
      if (near) empty.push(i);
    }
  }
  if (empty.length === 0) {
    for (let i = 0; i < state.board.length; i++) if (state.board[i] === 0) empty.push(i);
  }
  return empty;
}

function pick<T>(list: readonly T[], level: Difficulty): T {
  if (level === "easy" && list.length > 1) {
    return list[Math.floor(Math.random() * list.length)];
  }
  return list[0];
}

/**
 * AI 的一手。黑棋第一手返回 1 个点，其余返回 2 个点。
 * 候选点限制在已有棋子周围，避免 19×19 全盘搜索。
 */
export function connect6Ai(
  state: C6State,
  level: Difficulty = "normal",
): { x: number; y: number }[] {
  if (state.result) return [];
  const pool = candidates(state);
  if (pool.length === 0) return [];
  if (state.left === 1) {
    pool.sort(
      (a, b) =>
        pointScore(state.board, b % C6_SIZE, (b - (b % C6_SIZE)) / C6_SIZE, state.turn) -
        pointScore(state.board, a % C6_SIZE, (a - (a % C6_SIZE)) / C6_SIZE, state.turn),
    );
    const i = pick(pool, level);
    return [{ x: i % C6_SIZE, y: (i - (i % C6_SIZE)) / C6_SIZE }];
  }

  const enemy = other(state.turn);
  const scored: { a: number; b: number; score: number }[] = [];
  for (let i = 0; i < pool.length; i++) {
    const a = pool[i];
    if (state.board[a] !== 0) continue;
    const ax = a % C6_SIZE;
    const ay = (a - ax) / C6_SIZE;
    // 单点已经能成六，直接带一个相邻空点
    state.board[a] = state.turn;
    const win = c6WinLine(state.board, ax, ay, state.turn);
    state.board[a] = 0;
    if (win) {
      const b = pool.find((j) => j !== a) ?? a;
      return [
        { x: ax, y: ay },
        { x: b % C6_SIZE, y: (b - (b % C6_SIZE)) / C6_SIZE },
      ];
    }
  }

  const limit = level === "easy" ? 12 : level === "normal" ? 28 : 48;
  const small = pool.slice(0, limit);
  for (let i = 0; i < small.length; i++) {
    for (let j = i + 1; j < small.length; j++) {
      const a = small[i];
      const b = small[j];
      const attack = pairScore(state.board.slice(), a, b, state.turn);
      const defend = pairScore(state.board.slice(), a, b, enemy);
      let score = attack + defend * (level === "hell" ? 1.05 : 0.72);
      if (level === "easy") score += Math.random() * 4_000;
      scored.push({ a, b, score });
    }
  }
  scored.sort((x, y) => y.score - x.score);

  // 地狱档：在前几个组合里再看一眼对手的最佳回应，选最不让对手成六的
  if (level === "hell" && scored.length > 1) {
    const top = scored.slice(0, 5);
    for (const item of top) {
      const board = state.board.slice();
      board[item.a] = state.turn;
      board[item.b] = state.turn;
      let bestReply = 0;
      for (const i of pool) {
        if (board[i] !== 0) continue;
        const x = i % C6_SIZE;
        const y = (i - x) / C6_SIZE;
        bestReply = Math.max(bestReply, pointScore(board, x, y, enemy));
      }
      item.score -= bestReply * 0.9;
    }
    top.sort((x, y) => y.score - x.score);
    const best = top[0] ?? scored[0];
    return [
      { x: best.a % C6_SIZE, y: (best.a - (best.a % C6_SIZE)) / C6_SIZE },
      { x: best.b % C6_SIZE, y: (best.b - (best.b % C6_SIZE)) / C6_SIZE },
    ];
  }

  const best = scored[0];
  if (!best) {
    const a = pool[0];
    const b = pool[1] ?? pool[0];
    return [
      { x: a % C6_SIZE, y: (a - (a % C6_SIZE)) / C6_SIZE },
      { x: b % C6_SIZE, y: (b - (b % C6_SIZE)) / C6_SIZE },
    ];
  }
  return [
    { x: best.a % C6_SIZE, y: (best.a - (best.a % C6_SIZE)) / C6_SIZE },
    { x: best.b % C6_SIZE, y: (best.b - (best.b % C6_SIZE)) / C6_SIZE },
  ];
}
