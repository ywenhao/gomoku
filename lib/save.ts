/**
 * 当前对局的存档：退出、关窗或进程被杀之后，下次启动点「继续游戏」能接着下。
 *
 * 只保存真正开始过、还没结束的对局；下完一局就清掉，避免“继续”一局已经
 * 分出胜负的棋。存档是 JSON，读到坏数据时当没有存档，绝不拦住启动。
 */

import {
  SIZE,
  applyMove,
  createBoard,
  idx,
  other,
  type Difficulty,
  type Mode,
  type Move,
  type Player,
} from "./gomoku";
import { MOVE_SECONDS } from "./score";

export interface SavedGame {
  moves: Move[];
  mode: Mode;
  level: Difficulty;
  limitOn: boolean;
  leftMs: number;
  undos: number;
  timeouts: number;
  startedAt: number;
  savedAt: number;
}

const FULL_MS = MOVE_SECONDS * 1000;

function count(
  value: unknown,
  fallback = 0,
  max = Number.MAX_SAFE_INTEGER,
): number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= max
    ? value
    : fallback;
}

function time(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

/** 存档里下一手轮到谁：黑白交替，由最后一手反推。 */
export function savedTurn(game: SavedGame): Player {
  const last = game.moves[game.moves.length - 1];
  return last ? other(last.p) : 1;
}

/** 解析并校验存档；不合法（或对局已结束）时返回 null。 */
export function readSavedGame(raw: string | null): SavedGame | null {
  if (!raw) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.moves) || data.moves.length === 0) return null;

  const moves: Move[] = [];
  const seen = new Set<number>();
  let board = createBoard();

  for (let i = 0; i < data.moves.length; i++) {
    const item = data.moves[i];
    if (!item || typeof item !== "object") return null;
    const m = item as Record<string, unknown>;
    const { x, y, p } = m;
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      x >= SIZE ||
      y < 0 ||
      y >= SIZE ||
      (p !== 1 && p !== 2) ||
      // 黑棋先行，之后交替
      p !== (i % 2 === 0 ? 1 : 2)
    ) {
      return null;
    }
    const i0 = idx(x, y);
    if (seen.has(i0)) return null;
    seen.add(i0);

    const move: Move = { x, y, p };
    const result = applyMove(board, moves, move);
    // 已经连成五子（或下满）的棋不应出现在“继续游戏”里
    if (result.result) return null;
    board = result.board;
    moves.push(move);
  }

  const now = Date.now();
  const mode: Mode = data.mode === "pvp" ? "pvp" : "pve";
  const level: Difficulty =
    data.level === "easy" ||
    data.level === "normal" ||
    data.level === "hard" ||
    data.level === "hell"
      ? data.level
      : "normal";

  return {
    moves,
    mode,
    level,
    limitOn: typeof data.limitOn === "boolean" ? data.limitOn : true,
    leftMs:
      typeof data.leftMs === "number" && Number.isFinite(data.leftMs)
        ? Math.max(0, Math.min(FULL_MS, data.leftMs))
        : FULL_MS,
    undos: count(data.undos),
    timeouts: count(data.timeouts),
    startedAt: time(data.startedAt, now),
    savedAt: time(data.savedAt, now),
  };
}
