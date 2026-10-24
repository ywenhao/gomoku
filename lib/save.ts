/**
 * 当前对局的存档：退出、关窗或进程被杀之后，下次启动点「继续游戏」能接着下。
 *
 * 只保存真正开始过、还没结束的对局；下完一局就清掉，避免“继续”一局已经
 * 分出胜负的棋。存档是 JSON，读到坏数据时当没有存档，绝不拦住启动。
 *
 * 从 1.4.0 起同一份存档同时支持五子棋和围棋；旧版 gomoku.game.v1
 * 没有 kind 字段，按五子棋读取。
 */

import {
  SIZE,
  applyMove,
  createBoard,
  idx,
  other,
  type Difficulty,
  type GameKind,
  type Mode,
  type Move,
} from "./gomoku";
import {
  GO_SIZES,
  GO_KOMI,
  goStateFromMoves,
  type GoMove,
  type GoSize,
} from "./go";
import { MOVE_SECONDS } from "./score";
import { GAMES, isComplexGame } from "./catalog";
import {
  clockSlotForMatch,
  replayMatch,
  type Action,
  type ExtraKind,
} from "./multigame";
import { restoreClock, type MatchClock } from "./clock";
import { isCheckerPlayers, type CheckerPlayers } from "./race";

export interface SavedGame {
  kind: GameKind;
  /** 五子棋手数；围棋时为空，实际手数看 goMoves */
  moves: Move[];
  goMoves?: GoMove[];
  goSize?: GoSize;
  mode: Mode;
  level: Difficulty;
  limitOn: boolean;
  leftMs: number;
  undos: number;
  timeouts: number;
  startedAt: number;
  savedAt: number;
  actions?: Action[];
  initialBoard?: number[];
  checkerPlayers?: CheckerPlayers;
  clock?: MatchClock;
  timeControl?: string;
  scoring?: boolean;
  dead?: number[];
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
export function savedTurn(game: SavedGame): number {
  if (game.actions)
    return (
      replayMatch(
        game.kind as ExtraKind,
        game.actions,
        game.initialBoard,
        game.checkerPlayers ?? 2,
      )?.state.turn ?? 1
    );
  const last =
    game.kind === "go"
      ? game.goMoves?.[game.goMoves.length - 1]
      : game.moves[game.moves.length - 1];
  return last ? other(last.p) : 1;
}

export function savedMoveCount(game: SavedGame): number {
  if (game.actions) return game.actions.length;
  return game.kind === "go" ? (game.goMoves?.length ?? 0) : game.moves.length;
}

function readMode(value: unknown): Mode {
  return value === "pvp" || value === "aiai" ? value : "pve";
}

function readLevel(value: unknown): Difficulty {
  return value === "easy" ||
    value === "normal" ||
    value === "hard" ||
    value === "hell"
    ? value
    : "normal";
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
  if (data.kind !== undefined && !GAMES.some((g) => g.kind === data.kind))
    return null;
  const kind: GameKind = (data.kind ?? "gomoku") as GameKind;

  const now = Date.now();
  const mode = readMode(data.mode);
  const level = readLevel(data.level);
  const common = {
    kind,
    mode,
    level,
    limitOn: typeof data.limitOn === "boolean" ? data.limitOn : true,
    leftMs:
      typeof data.leftMs === "number" && Number.isFinite(data.leftMs)
        ? Math.max(
            0,
            Math.min(isComplexGame(kind) ? 86_400_000 : FULL_MS, data.leftMs),
          )
        : FULL_MS,
    undos: count(data.undos),
    timeouts: count(data.timeouts),
    startedAt: time(data.startedAt, now),
    savedAt: time(data.savedAt, now),
  };

  if (kind !== "gomoku" && kind !== "go") {
    if (!Array.isArray(data.actions) || data.actions.length > 4000) return null;
    const initialBoard = data.initialBoard as number[] | undefined;
    if (initialBoard !== undefined && !Array.isArray(initialBoard)) return null;
    if (kind === "checkers" && data.checkerPlayers !== undefined)
      if (!isCheckerPlayers(data.checkerPlayers)) return null;
    const checkerPlayers: CheckerPlayers | undefined =
      kind === "checkers"
        ? isCheckerPlayers(data.checkerPlayers)
          ? data.checkerPlayers
          : 2
        : undefined;
    const match = replayMatch(
      kind,
      data.actions as Action[],
      initialBoard,
      checkerPlayers,
    );
    if (!match || match.state.result) return null;
    const clock = restoreClock(kind, data.clock, clockSlotForMatch(match));
    if (data.clock && !clock) return null;
    return {
      ...common,
      moves: [],
      actions: data.actions as Action[],
      initialBoard,
      checkerPlayers,
      clock: clock ?? undefined,
      timeControl: clock?.control.id,
    };
  }

  if (kind === "go") {
    if (
      !Array.isArray(data.goMoves) ||
      data.goMoves.length === 0 ||
      data.goMoves.length > 4000
    )
      return null;
    const size = GO_SIZES.includes(data.goSize as GoSize)
      ? (data.goSize as GoSize)
      : 19;
    const moves: GoMove[] = [];
    for (const item of data.goMoves) {
      if (!item || typeof item !== "object") return null;
      const m = item as Record<string, unknown>;
      if (
        typeof m.x !== "number" ||
        typeof m.y !== "number" ||
        !Number.isInteger(m.x) ||
        !Number.isInteger(m.y) ||
        (m.p !== 1 && m.p !== 2) ||
        (m.pass !== true && m.pass !== false)
      ) {
        return null;
      }
      moves.push({
        x: m.x,
        y: m.y,
        p: m.p,
        pass: m.pass === true,
      });
    }
    const state = goStateFromMoves(size, moves);
    if (!state) return null;
    const clock = restoreClock(
      "go",
      data.clock,
      state.moves.length % 2 === 0 ? 1 : 2,
    );
    if (data.clock && !clock) return null;
    return {
      ...common,
      moves: [],
      goMoves: state.moves,
      goSize: size,
      clock: clock ?? undefined,
      timeControl:
        typeof data.timeControl === "string" ? data.timeControl : undefined,
      scoring: state.passes >= 2,
      dead: Array.isArray(data.dead)
        ? ([
            ...new Set(
              data.dead.filter(
                (i) =>
                  Number.isInteger(i) &&
                  i >= 0 &&
                  i < size * size &&
                  state.board[i] !== 0,
              ),
            ),
          ] as number[])
        : [],
    };
  }

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

  return {
    ...common,
    kind: "gomoku",
    moves,
  };
}

/** 给围棋数子用的贴目常量，保存时方便读取。 */
export { GO_KOMI };
