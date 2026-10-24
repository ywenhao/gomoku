/**
 * 手动保存的棋谱。与「继续游戏」不同，棋谱库允许保存已经结束的整局棋，
 * 随时打开逐步回放；五子棋和围棋共用一份列表。
 */

import { GAMES, gameName } from "./catalog";
import { replayMatch, type Action } from "./multigame";
import {
  SIZE,
  other,
  type Difficulty,
  type GameKind,
  type Mode,
  type Move,
} from "./gomoku";
import { GO_SIZES, goStateFromMoves, type GoMove, type GoSize } from "./go";

export interface StoredRecord {
  id: string;
  name: string;
  game: GameKind;
  mode: Mode;
  level: Difficulty;
  goSize?: GoSize;
  moves: Move[];
  actions?: Action[];
  initialBoard?: number[];
  goMoves?: GoMove[];
  result?: string;
  savedAt: number;
}

export const RECORDS_LIMIT = 60;

/** 保存棋谱时的输入；名称缺省由棋种、难度和结果生成。 */
export interface RecordInput {
  game: GameKind;
  mode: Mode;
  level: Difficulty;
  goSize?: GoSize;
  moves?: Move[];
  actions?: Action[];
  initialBoard?: number[];
  goMoves?: GoMove[];
  result?: string;
  name?: string;
  savedAt?: number;
}

export function makeRecord(input: RecordInput): StoredRecord {
  const savedAt = input.savedAt ?? Date.now();
  const result = input.result?.slice(0, 40);
  return {
    id: `${savedAt}-${Math.random().toString(36).slice(2, 8)}`,
    name:
      input.name?.trim().slice(0, 60) ||
      recordTitle(input.game, input.level, savedAt, result),
    game: input.game,
    mode: input.mode,
    level: input.level,
    goSize: input.game === "go" ? (input.goSize ?? 19) : undefined,
    moves: input.game === "go" ? [] : (input.moves ?? []),
    goMoves: input.game === "go" ? (input.goMoves ?? []) : undefined,
    result,
    actions: input.actions,
    initialBoard: input.initialBoard,
    savedAt,
  };
}

const MODES: readonly Mode[] = ["pve", "pvp", "aiai"];
const LEVELS: readonly Difficulty[] = ["easy", "normal", "hard", "hell"];

function modeOf(value: unknown): Mode {
  return MODES.includes(value as Mode) ? (value as Mode) : "pve";
}

function levelOf(value: unknown): Difficulty {
  return LEVELS.includes(value as Difficulty)
    ? (value as Difficulty)
    : "normal";
}

export function recordTitle(
  game: GameKind,
  level: Difficulty,
  at: number,
  result?: string,
): string {
  const d = new Date(at);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const stamp = `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const name = gameName(game);
  const lv =
    level === "easy"
      ? "简单"
      : level === "normal"
        ? "普通"
        : level === "hard"
          ? "困难"
          : "地狱";
  return `${name} · ${lv}${result ? ` · ${result}` : ""} · ${stamp}`;
}

function readGomokuMoves(value: unknown): Move[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const out: Move[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (!item || typeof item !== "object") return null;
    const m = item as Record<string, unknown>;
    if (
      typeof m.x !== "number" ||
      typeof m.y !== "number" ||
      !Number.isInteger(m.x) ||
      !Number.isInteger(m.y) ||
      m.x < 0 ||
      m.y < 0 ||
      m.x >= SIZE ||
      m.y >= SIZE ||
      m.p !== (i % 2 === 0 ? 1 : 2)
    ) {
      return null;
    }
    const i0 = m.y * SIZE + m.x;
    if (seen.has(i0)) return null;
    seen.add(i0);
    out.push({ x: m.x, y: m.y, p: m.p as 1 | 2 });
  }
  return out;
}

export function readRecords(raw: string | null): StoredRecord[] {
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];

  const out: StoredRecord[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const data = item as Record<string, unknown>;
    if (typeof data.id !== "string" || data.id.length === 0) continue;
    if (data.game !== undefined && !GAMES.some((g) => g.kind === data.game))
      continue;
    const game: GameKind = (data.game ?? "gomoku") as GameKind;
    const savedAt =
      typeof data.savedAt === "number" && Number.isFinite(data.savedAt)
        ? data.savedAt
        : Date.now();
    const level = levelOf(data.level);
    const mode = modeOf(data.mode);
    const result =
      typeof data.result === "string" ? data.result.slice(0, 40) : undefined;
    const name =
      typeof data.name === "string" ? data.name.trim().slice(0, 60) : "";

    if (game !== "go" && game !== "gomoku") {
      if (!Array.isArray(data.actions)) continue;
      const initialBoard = data.initialBoard as number[] | undefined;
      if (initialBoard !== undefined && !Array.isArray(initialBoard)) continue;
      if (!replayMatch(game, data.actions as Action[], initialBoard)) continue;
      out.push({
        id: data.id,
        name: name || recordTitle(game, level, savedAt, result),
        game,
        mode,
        level,
        moves: [],
        actions: data.actions as Action[],
        initialBoard,
        result,
        savedAt,
      });
      continue;
    }
    if (game === "go") {
      if (!Array.isArray(data.goMoves) || data.goMoves.length === 0) continue;
      const size = GO_SIZES.includes(data.goSize as GoSize)
        ? (data.goSize as GoSize)
        : 19;
      const goMoves: GoMove[] = [];
      for (const m0 of data.goMoves) {
        if (!m0 || typeof m0 !== "object") continue;
        const m = m0 as Record<string, unknown>;
        if (
          typeof m.x !== "number" ||
          typeof m.y !== "number" ||
          !Number.isInteger(m.x) ||
          !Number.isInteger(m.y) ||
          (m.p !== 1 && m.p !== 2) ||
          (m.pass !== true && m.pass !== false)
        ) {
          continue;
        }
        goMoves.push({ x: m.x, y: m.y, p: m.p, pass: m.pass === true });
      }
      const state = goStateFromMoves(size, goMoves);
      if (!state || state.moves.length !== data.goMoves.length) continue;
      out.push({
        id: data.id,
        name: name || recordTitle(game, level, savedAt, result),
        game,
        mode,
        level,
        goSize: size,
        moves: [],
        goMoves: state.moves,
        result,
        savedAt,
      });
    } else {
      const moves = readGomokuMoves(data.moves);
      if (!moves) continue;
      out.push({
        id: data.id,
        name: name || recordTitle(game, level, savedAt, result),
        game,
        mode,
        level,
        moves,
        result,
        savedAt,
      });
    }
  }
  out.sort((a, b) => b.savedAt - a.savedAt);
  return out.slice(0, RECORDS_LIMIT);
}

/** 记录里的最后一手颜色：用于棋谱回放的下一手提示。 */
export function recordNextPlayer(record: StoredRecord): 1 | 2 {
  if (record.actions)
    return Math.min(
      2,
      replayMatch(
        record.game as Exclude<GameKind, "gomoku" | "go">,
        record.actions,
        record.initialBoard,
      )?.state.turn ?? 1,
    ) as 1 | 2;
  const list = record.game === "go" ? (record.goMoves ?? []) : record.moves;
  const last = list[list.length - 1];
  return last ? other(last.p) : 1;
}

export function recordMoveCount(record: StoredRecord): number {
  if (record.actions) return record.actions.length;
  return record.game === "go"
    ? (record.goMoves?.length ?? 0)
    : record.moves.length;
}
