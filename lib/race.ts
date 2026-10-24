import type { Difficulty, Player } from "./gomoku";

export interface RaceResult {
  winner: number;
  reason: string;
}
export interface LudoState {
  planes: number[][];
  turn: number;
  die: number;
  sixes: number;
  result: RaceResult | null;
  rolls: number;
}
export const LUDO_TRACK: readonly [number, number][] = [
  [6, 13],
  [6, 12],
  [6, 11],
  [6, 10],
  [6, 9],
  [5, 8],
  [4, 8],
  [3, 8],
  [2, 8],
  [1, 8],
  [0, 8],
  [0, 7],
  [0, 6],
  [1, 6],
  [2, 6],
  [3, 6],
  [4, 6],
  [5, 6],
  [6, 5],
  [6, 4],
  [6, 3],
  [6, 2],
  [6, 1],
  [6, 0],
  [7, 0],
  [8, 0],
  [8, 1],
  [8, 2],
  [8, 3],
  [8, 4],
  [8, 5],
  [9, 6],
  [10, 6],
  [11, 6],
  [12, 6],
  [13, 6],
  [14, 6],
  [14, 7],
  [14, 8],
  [13, 8],
  [12, 8],
  [11, 8],
  [10, 8],
  [9, 8],
  [8, 9],
  [8, 10],
  [8, 11],
  [8, 12],
  [8, 13],
  [8, 14],
  [7, 14],
  [6, 14],
];
export function createLudo(): LudoState {
  return {
    planes: Array.from({ length: 4 }, () => [-1, -1, -1, -1]),
    turn: 1,
    die: 0,
    sixes: 0,
    result: null,
    rolls: 0,
  };
}
export function rollLudo(
  s: LudoState,
  die = 1 + Math.floor(Math.random() * 6),
): LudoState | null {
  if (s.result || s.die || !Number.isInteger(die) || die < 1 || die > 6)
    return null;
  const sixes = die === 6 ? s.sixes + 1 : 0;
  if (sixes >= 3)
    return {
      ...s,
      turn: (s.turn % 4) + 1,
      die: 0,
      sixes: 0,
      rolls: s.rolls + 1,
    };
  const n = { ...s, die, sixes, rolls: s.rolls + 1 };
  return ludoLegal(n).length
    ? n
    : { ...n, die: 0, sixes: 0, turn: (s.turn % 4) + 1 };
}
export function ludoLegal(s: LudoState): number[] {
  if (!s.die || s.result) return [];
  return s.planes[s.turn - 1]
    .map((step, i) =>
      (step >= 0 && step < 57) || (step === -1 && s.die === 6) ? i : -1,
    )
    .filter((i) => i >= 0);
}
export function ludoPosition(player: number, step: number): number {
  return step >= 0 && step < 52 ? ((player - 1) * 13 + step) % 52 : -1;
}
export function moveLudo(s: LudoState, plane: number): LudoState | null {
  if (!ludoLegal(s).includes(plane)) return null;
  const planes = s.planes.map((p) => p.slice());
  let step = planes[s.turn - 1][plane];
  step = step < 0 ? 0 : step + s.die;
  if (step > 57) step = 114 - step;
  // Agreed flying-chess variant: colour jump, then a flight at square 18.
  if (step === 18) step = 30;
  else {
    if (step > 0 && step <= 46 && step % 4 === 2) step += 4;
    if (step === 18) step = 30;
  }
  planes[s.turn - 1][plane] = step;
  const pos = ludoPosition(s.turn, step);
  if (pos >= 0)
    for (let p = 1; p <= 4; p++)
      if (p !== s.turn) {
        for (let i = 0; i < 4; i++)
          if (ludoPosition(p, planes[p - 1][i]) === pos) planes[p - 1][i] = -1;
      }
  const result = planes[s.turn - 1].every((x) => x === 57)
    ? { winner: s.turn, reason: "四架飞机全部到达终点" }
    : null;
  return {
    ...s,
    planes,
    turn: result || s.die === 6 ? s.turn : (s.turn % 4) + 1,
    die: 0,
    sixes: s.die === 6 ? s.sixes : 0,
    result,
  };
}
export function ludoAi(s: LudoState, level: Difficulty): number | null {
  const choices = ludoLegal(s);
  if (!choices.length) return null;
  if (level === "easy")
    return choices[Math.floor(Math.random() * choices.length)];
  return choices.sort((a, b) => {
    const score = (i: number) => {
      const n = moveLudo(s, i)!;
      return (
        n.planes[s.turn - 1][i] +
        (n.result ? 1000 : 0) +
        n.planes.reduce(
          (v, row, p) =>
            v +
            (p === s.turn - 1
              ? 0
              : row.filter((x, j) => x < 0 && s.planes[p][j] >= 0).length * 30),
          0,
        )
      );
    };
    return score(b) - score(a);
  })[0];
}

export interface Hole {
  q: number;
  r: number;
}
const key = (q: number, r: number) => `${q},${r}`;
const rotate = (q: number, r: number): [number, number] => [-r, q + r];
const holes: Hole[] = [],
  camps: number[][] = Array.from({ length: 6 }, () => []);
for (let q = -4; q <= 4; q++)
  for (let r = -4; r <= 4; r++) if (Math.abs(q + r) <= 4) holes.push({ q, r });
for (let arm = 0; arm < 6; arm++)
  for (let r = -8; r <= -5; r++)
    for (let q = -r - 4; q <= 4; q++) {
      let a = q,
        b = r;
      for (let k = 0; k < arm; k++) [a, b] = rotate(a, b);
      camps[arm].push(holes.length);
      holes.push({ q: a, r: b });
    }
export const CHECKER_HOLES: readonly Hole[] = holes;
export const CHECKER_CAMPS: readonly number[][] = camps;
const index = new Map(holes.map((h, i) => [key(h.q, h.r), i]));
const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
];
export interface CheckerState {
  board: number[];
  turn: Player;
  result: RaceResult | null;
  ply: number;
}
export function createCheckers(): CheckerState {
  const board = new Array<number>(121).fill(0);
  for (const i of camps[0]) board[i] = 1;
  for (const i of camps[3]) board[i] = 2;
  return { board, turn: 1, result: null, ply: 0 };
}
export function checkerMoves(s: CheckerState, from: number): number[] {
  if (s.result || s.board[from] !== s.turn || !holes[from]) return [];
  const found = new Set<number>(),
    seen = new Set([from]),
    queue = [from];
  const occupied = (i: number) => i !== from && s.board[i] !== 0;
  const target = camps[s.turn === 1 ? 3 : 0];
  for (const [dq, dr] of DIRS) {
    const i = index.get(key(holes[from].q + dq, holes[from].r + dr));
    if (i !== undefined && !occupied(i)) found.add(i);
  }
  for (let at = 0; at < queue.length; at++) {
    const h = holes[queue[at]];
    for (const [dq, dr] of DIRS) {
      const mid = index.get(key(h.q + dq, h.r + dr)),
        dest = index.get(key(h.q + 2 * dq, h.r + 2 * dr));
      if (
        dest !== undefined &&
        target.includes(queue[at]) &&
        !target.includes(dest)
      )
        continue;
      if (
        mid !== undefined &&
        dest !== undefined &&
        occupied(mid) &&
        !occupied(dest) &&
        !seen.has(dest)
      ) {
        seen.add(dest);
        found.add(dest);
        queue.push(dest);
      }
    }
  }
  // Once in the target camp a piece may rearrange there, but cannot leave it.
  return [...found].filter((i) => !target.includes(from) || target.includes(i));
}
export function moveCheckers(
  s: CheckerState,
  from: number,
  to: number,
): CheckerState | null {
  if (!checkerMoves(s, from).includes(to)) return null;
  const board = s.board.slice();
  board[from] = 0;
  board[to] = s.turn;
  const target = camps[s.turn === 1 ? 3 : 0];
  const won =
    target.every((i) => board[i] !== 0) &&
    target.some((i) => board[i] === s.turn);
  return {
    board,
    turn: s.turn === 1 ? 2 : 1,
    ply: s.ply + 1,
    result: won ? { winner: s.turn, reason: "占满对营（含防堵塞判定）" } : null,
  };
}
export function checkersAi(
  s: CheckerState,
  level: Difficulty,
): { from: number; to: number } | null {
  const all: { from: number; to: number; score: number }[] = [];
  for (let from = 0; from < 121; from++)
    if (s.board[from] === s.turn)
      for (const to of checkerMoves(s, from)) {
        const dir = s.turn === 1 ? 1 : -1,
          a = holes[from],
          b = holes[to];
        all.push({
          from,
          to,
          score:
            (b.r - a.r) * dir * 10 -
            Math.abs(b.q + b.r / 2) * 0.2 +
            (camps[s.turn === 1 ? 3 : 0].includes(to) ? 4 : 0),
        });
      }
  if (!all.length) return null;
  return level === "easy"
    ? all[Math.floor(Math.random() * all.length)]
    : all.sort((a, b) => b.score - a.score)[0];
}
