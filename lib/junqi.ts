import { other, type Difficulty, type Player } from "./gomoku";
import { owner } from "./royal";

// 1 engineer, 2 platoon, 3 company, 4 battalion, 5 regiment, 6 brigade,
// 7 division, 8 army, 9 commander, 10 bomb, 11 mine, 12 flag.
export const JUNQI_NAMES = [
  "",
  "工",
  "排",
  "连",
  "营",
  "团",
  "旅",
  "师",
  "军",
  "司",
  "炸",
  "雷",
  "旗",
];
export const JUNQI_CAMPS = [11, 13, 17, 21, 23, 36, 38, 42, 46, 48];
export const JUNQI_HQ = [1, 3, 56, 58];
const track = (i: number) => {
  const x = i % 5,
    y = Math.floor(i / 5);
  return (
    y === 1 ||
    y === 5 ||
    y === 6 ||
    y === 10 ||
    ((x === 0 || x === 4) && y >= 1 && y <= 10)
  );
};
export interface JunqiState {
  board: number[];
  turn: Player;
  revealed: number[];
  result: { winner: Player | 0; reason: string } | null;
  ply: number;
  quiet: number;
}
const PIECES = [
  12, 11, 11, 11, 10, 10, 9, 8, 7, 7, 6, 6, 5, 5, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1,
  1,
];
export function validDeployment(board: readonly number[], p: Player): boolean {
  const s = p === 1 ? 1 : -1,
    half = p === 1 ? 30 : 0;
  const pieces = board
    .slice(half, half + 30)
    .filter((v) => v * s > 0)
    .map(Math.abs)
    .sort((a, b) => a - b);
  if (
    pieces.join() !==
    PIECES.slice()
      .sort((a, b) => a - b)
      .join()
  )
    return false;
  for (let i = half; i < half + 30; i++) {
    const t = Math.abs(board[i]),
      y = Math.floor(i / 5);
    if (!t) continue;
    if (JUNQI_CAMPS.includes(i)) return false;
    if (t === 12 && !JUNQI_HQ.includes(i)) return false;
    if (t === 11 && !(p === 1 ? y >= 10 : y <= 1)) return false;
    if (t === 10 && y === (p === 1 ? 6 : 5)) return false;
  }
  return true;
}
export function createJunqi(): JunqiState {
  const board = new Array<number>(60).fill(0);
  for (const p of [1, 2] as Player[]) {
    const s = p === 1 ? 1 : -1;
    const map = (i: number) => (p === 2 ? i : 59 - i);
    board[map(1)] = 12 * s;
    for (const i of [0, 2, 4]) board[map(i)] = 11 * s;
    const slots = Array.from({ length: 30 }, (_, i) => map(i)).filter(
      (i) => !board[i] && !JUNQI_CAMPS.includes(i),
    );
    const rest = PIECES.filter((t) => t !== 12 && t !== 11);
    // Bombs are placed before other pieces, in the back rows.
    for (let i = 0; i < rest.length; i++) board[slots[i]] = rest[i] * s;
  }
  return { board, turn: 1, revealed: [], result: null, ply: 0, quiet: 0 };
}
function neighbors(i: number): number[] {
  const x = i % 5,
    y = Math.floor(i / 5),
    out: number[] = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const nx = x + dx,
        ny = y + dy,
        j = ny * 5 + nx;
      if (nx < 0 || nx >= 5 || ny < 0 || ny >= 12) continue;
      if ((y === 5 && ny === 6) || (y === 6 && ny === 5)) {
        if (dx || ![0, 2, 4].includes(x)) continue;
      }
      if (dx && dy && !JUNQI_CAMPS.includes(i) && !JUNQI_CAMPS.includes(j))
        continue;
      out.push(j);
    }
  return out;
}
export function junqiMoves(s: JunqiState, from: number): number[] {
  if (
    s.result ||
    owner(s.board[from]) !== s.turn ||
    JUNQI_HQ.includes(from) ||
    [11, 12].includes(Math.abs(s.board[from]))
  )
    return [];
  const out = new Set(neighbors(from));
  if (track(from)) {
    if (Math.abs(s.board[from]) === 1) {
      const seen = new Set([from]),
        queue = [from];
      for (let n = 0; n < queue.length; n++)
        for (const to of neighbors(queue[n])) {
          if (
            !track(to) ||
            seen.has(to) ||
            (Math.abs(to - queue[n]) !== 1 && Math.abs(to - queue[n]) !== 5)
          )
            continue;
          seen.add(to);
          out.add(to);
          if (!s.board[to]) queue.push(to);
        }
    } else {
      for (const d of [-1, 1, -5, 5]) {
        let prev = from;
        for (
          let to = from + d;
          to >= 0 && to < 60 && track(to) && neighbors(prev).includes(to);
          to += d
        ) {
          if (Math.abs(d) === 1 && Math.floor(to / 5) !== Math.floor(from / 5))
            break;
          out.add(to);
          if (s.board[to]) break;
          prev = to;
        }
      }
    }
  }
  return [...out].filter(
    (to) =>
      owner(s.board[to]) !== s.turn &&
      !(s.board[to] && JUNQI_CAMPS.includes(to)),
  );
}
export function moveJunqi(
  s: JunqiState,
  from: number,
  to: number,
): JunqiState | null {
  if (!junqiMoves(s, from).includes(to)) return null;
  const board = s.board.slice(),
    a = Math.abs(board[from]),
    b = Math.abs(board[to]),
    revealed = s.revealed.filter((i) => i !== from && i !== to);
  board[from] = 0;
  if (a === 10 && b === 12) board[to] = 0;
  else if (
    !b ||
    b === 12 ||
    (b === 11 && a === 1) ||
    (a <= 9 && b <= 9 && a > b)
  )
    board[to] = s.board[from];
  else if (a === 10 || b === 10 || a === b) board[to] = 0;
  // Otherwise the defender survives, including a mine against any non-engineer.
  for (const p of [1, 2] as Player[])
    if (!board.includes(p === 1 ? 9 : -9)) {
      const flag = board.indexOf(p === 1 ? 12 : -12);
      if (flag >= 0) revealed.push(flag);
    }
  const n: JunqiState = {
    board,
    turn: other(s.turn),
    revealed: [...new Set(revealed)],
    ply: s.ply + 1,
    quiet: b ? 0 : s.quiet + 1,
    result: b === 12 ? { winner: s.turn, reason: "夺取军旗" } : null,
  };
  if (
    !n.result &&
    !board.some((v, i) => owner(v) === n.turn && junqiMoves(n, i).length)
  )
    n.result = { winner: s.turn, reason: "对方无可移动棋子" };
  if (!n.result && n.quiet >= 100)
    n.result = { winner: 0, reason: "约定五十回合无战斗，和棋" };
  return n;
}
export function junqiAi(
  s: JunqiState,
  level: Difficulty,
): { from: number; to: number } | null {
  const all: { from: number; to: number; score: number }[] = [];
  // Decisions use only visible information, never the hidden rank of an enemy.
  for (let from = 0; from < 60; from++)
    if (owner(s.board[from]) === s.turn)
      for (const to of junqiMoves(s, from)) {
        const advance =
          (Math.floor(from / 5) - Math.floor(to / 5)) * (s.turn === 1 ? 1 : -1);
        all.push({
          from,
          to,
          score:
            advance +
            (!s.board[to] ? 0 : s.revealed.includes(to) ? 20 : 3) +
            (JUNQI_CAMPS.includes(to) ? 0.5 : 0) +
            Math.random(),
        });
      }
  if (!all.length) return null;
  return level === "easy"
    ? all[Math.floor(Math.random() * all.length)]
    : all.sort((a, b) => b.score - a.score)[0];
}
