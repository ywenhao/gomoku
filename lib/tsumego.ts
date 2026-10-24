/**
 * 死活题运行逻辑：题面、正解树、玩家落子判定。
 *
 * 数据来自 Go Game Guru Weekly Go Problems（CC BY-NC-SA 4.0），
 * 生成脚本见 scripts/build-tsumego.mjs。
 */

import type { Difficulty, Player } from "./gomoku";
import { playGo, type GoMove } from "./go";
import {
  TSUMEGO_PROBLEMS,
  type TsumegoNode,
  type TsumegoProblem,
} from "./data/tsumego";

export const TSUMEGO_LEVEL_NAME: Record<Difficulty, string> = {
  easy: "简单",
  normal: "普通",
  hard: "困难",
  hell: "地狱",
};

export const LEVEL_ORDER: Record<Difficulty, number> = {
  easy: 0,
  normal: 1,
  hard: 2,
  hell: 3,
};

export type TsumegoRegion = "全部" | "角部" | "边上" | "中腹";
export type TsumegoSort = "no" | "name" | "level";

/** SGF 坐标 → 棋盘下标。 */
export function sgfPoint(m: string, size = 19): { x: number; y: number } {
  return {
    x: m.charCodeAt(0) - 97,
    y: m.charCodeAt(1) - 97,
  };
}

export function problemBoard(problem: TsumegoProblem): number[] {
  const board = new Array<number>(problem.size * problem.size).fill(0);
  for (const m of problem.black) {
    const p = sgfPoint(m);
    board[p.y * problem.size + p.x] = 1;
  }
  for (const m of problem.white) {
    const p = sgfPoint(m);
    board[p.y * problem.size + p.x] = 2;
  }
  return board;
}

export interface TsumegoSession {
  board: number[];
  ko: number;
  moves: GoMove[];
  /** 当前可以由玩家选择的黑棋正解节点；空表示已经完成。 */
  pending: TsumegoNode[];
  last: number;
  solved: boolean;
}

export function startTsumego(problem: TsumegoProblem): TsumegoSession {
  return {
    board: problemBoard(problem),
    ko: -1,
    moves: [],
    pending: problem.solutions.slice(),
    last: -1,
    solved: false,
  };
}

function applyNode(
  session: TsumegoSession,
  node: TsumegoNode,
  size: number,
): boolean {
  const p = sgfPoint(node.m);
  const r = playGo(session.board, size, p.x, p.y, node.p, session.ko);
  if (!r.ok) return false;
  session.board = r.board;
  session.ko = r.ko;
  session.last = p.y * size + p.x;
  session.moves = session.moves.concat([
    { x: p.x, y: p.y, p: node.p as Player, pass: false },
  ]);
  return true;
}

/**
 * 玩家点了 (x,y)。返回 "ok" 表示走出正解，"wrong" 表示不对，
 * "solved" 表示整道题已经完成。
 */
export function playTsumego(
  problem: TsumegoProblem,
  session: TsumegoSession,
  x: number,
  y: number,
): "ok" | "wrong" | "solved" {
  if (session.solved) return "solved";
  const hit = session.pending.find((n) => {
    const p = sgfPoint(n.m, problem.size);
    return p.x === x && p.y === y;
  });
  if (!hit) return "wrong";

  if (!applyNode(session, hit, problem.size)) return "wrong";
  session.pending = [];

  let remaining = hit.c;
  while (remaining.length > 0 && remaining[0].p === 2) {
    const white = remaining[0];
    if (!applyNode(session, white, problem.size)) {
      session.solved = true;
      return "solved";
    }
    remaining = white.c;
  }

  if (remaining.length === 0) {
    session.solved = true;
    return "solved";
  }

  // 白棋已经应完，轮到黑棋：这里可能有一组都算正解的继续手段。
  session.pending = remaining;
  return "ok";
}

/** 提示：当前正解的第一手。 */
export function tsumegoHint(session: TsumegoSession): { x: number; y: number } | null {
  const node = session.pending[0];
  if (!node) return null;
  return sgfPoint(node.m);
}

export interface TsumegoQuery {
  level: "全部" | Difficulty;
  region: TsumegoRegion;
  text: string;
  sort: TsumegoSort;
}

export function queryTsumego(q: TsumegoQuery): TsumegoProblem[] {
  const text = q.text.trim().toLowerCase();
  const out = TSUMEGO_PROBLEMS.filter((p) => {
    if (q.level !== "全部" && p.level !== q.level) return false;
    if (q.region !== "全部" && p.region !== q.region) return false;
    if (!text) return true;
    return (
      p.name.toLowerCase().includes(text) ||
      String(p.no).includes(text) ||
      p.series.includes(text) ||
      p.id.includes(text)
    );
  });

  out.sort((a, b) => {
    if (q.sort === "name") return a.name.localeCompare(b.name, "zh");
    if (q.sort === "level") {
      const d = LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level];
      return d === 0 ? a.no - b.no : d;
    }
    return a.no - b.no;
  });
  return out;
}

export function nextProblem(
  problem: TsumegoProblem,
  list: readonly TsumegoProblem[],
): TsumegoProblem | null {
  const at = list.findIndex((p) => p.id === problem.id);
  if (at < 0) return list[0] ?? null;
  return list[(at + 1) % list.length] ?? null;
}

export { TSUMEGO_PROBLEMS };
export type { TsumegoProblem, TsumegoNode };
