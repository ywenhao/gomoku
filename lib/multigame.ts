import { type GameKind, type Difficulty, type Player } from "./gomoku";
import {
  createConnect6,
  moveConnect6,
  connect6Ai,
  type C6State,
} from "./connect6";
import { createRoyal, playRoyal, royalAi, type RoyalState } from "./royal";
import {
  createLudo,
  rollLudo,
  moveLudo,
  ludoAi,
  createCheckers,
  moveCheckers,
  checkersAi,
  type CheckerPlayers,
  type LudoState,
  type CheckerState,
} from "./race";
import {
  createJunqi,
  moveJunqi,
  junqiAi,
  validDeployment,
  type JunqiState,
} from "./junqi";

export type ExtraKind = Exclude<GameKind, "gomoku" | "go">;
export type Action = {
  from?: number;
  to?: number;
  promotion?: number;
  die?: number;
  plane?: number;
  roll?: boolean;
};
export type Match =
  | { kind: "connect6"; state: C6State }
  | { kind: "chess" | "xiangqi"; state: RoyalState }
  | { kind: "ludo"; state: LudoState }
  | { kind: "checkers"; state: CheckerState }
  | { kind: "junqi"; state: JunqiState };

/**
 * 棋钟只有两个计时槽。跳棋按半回合奇偶使用槽位，其余棋种按行棋方映射。
 * 多人跳棋每回合都是 30 秒，因此第 1、3、5 位玩家共用 p1 槽，第 2、4、6 位共用 p2 槽。
 */
export function clockSlotForMatch(m: Match): Player {
  return (m.kind === "checkers"
    ? m.state.ply % 2 === 0
      ? 1
      : 2
    : Math.min(2, m.state.turn)) as Player;
}

export function completesTurn(
  before: Match,
  after: Match,
  action: Action,
): boolean {
  return (
    before.state.turn !== after.state.turn ||
    (before.kind === "ludo" && !action.roll)
  );
}
export function createMatch(
  kind: ExtraKind,
  checkerPlayers: CheckerPlayers = 2,
): Match {
  if (kind === "connect6") return { kind, state: createConnect6() };
  if (kind === "ludo") return { kind, state: createLudo() };
  if (kind === "checkers")
    return { kind, state: createCheckers(checkerPlayers) };
  if (kind === "junqi") return { kind, state: createJunqi() };
  return { kind, state: createRoyal(kind) };
}
export function applyAction(m: Match, a: Action): Match | null {
  if (!a || typeof a !== "object" || Array.isArray(a) || m.state.result)
    return null;
  for (const key of ["from", "to", "plane", "promotion", "die"] as const)
    if (a[key] !== undefined && !Number.isInteger(a[key])) return null;
  if (a.roll !== undefined && typeof a.roll !== "boolean") return null;
  if (m.kind === "ludo" && a.roll && a.die === undefined) return null;
  let state: Match["state"] | null = null;
  if (
    m.kind === "connect6" &&
    a.from !== undefined &&
    a.to !== undefined
  )
    state = moveConnect6(m.state, a.from, a.to);
  else if (m.kind === "ludo")
    state = a.roll
      ? rollLudo(m.state, a.die)
      : a.plane !== undefined
        ? moveLudo(m.state, a.plane)
        : null;
  else if (a.from !== undefined && a.to !== undefined) {
    if (m.kind === "checkers") state = moveCheckers(m.state, a.from, a.to);
    else if (m.kind === "junqi") state = moveJunqi(m.state, a.from, a.to);
    else if (m.kind === "chess" || m.kind === "xiangqi")
      state = playRoyal(m.state, {
        from: a.from,
        to: a.to,
        promotion: a.promotion,
      });
  }
  return state ? ({ kind: m.kind, state } as Match) : null;
}
export function matchAi(m: Match, level: Difficulty): Action | null {
  if (m.state.result) return null;
  if (m.kind === "connect6") return connect6Ai(m.state, level);
  if (m.kind === "ludo") {
    if (!m.state.die)
      return { roll: true, die: 1 + Math.floor(Math.random() * 6) };
    const i = ludoAi(m.state, level);
    return i === null ? null : { plane: i };
  }
  if (m.kind === "checkers") return checkersAi(m.state, level);
  if (m.kind === "junqi") return junqiAi(m.state, level);
  return royalAi(m.state, level);
}
export function replayMatch(
  kind: ExtraKind,
  actions: readonly Action[],
  initialBoard?: number[],
  checkerPlayers: CheckerPlayers = 2,
): Match | null {
  if (actions.length > 4000) return null;
  let m = createMatch(kind, checkerPlayers);
  if (initialBoard) {
    if (
      kind !== "junqi" ||
      initialBoard.length !== 60 ||
      !initialBoard.every(Number.isInteger) ||
      !validDeployment(initialBoard, 1) ||
      !validDeployment(initialBoard, 2)
    )
      return null;
    if (m.kind === "junqi")
      m = { ...m, state: { ...m.state, board: initialBoard.slice() } };
  }
  for (const a of actions) {
    if (!a || typeof a !== "object") return null;
    m = applyAction(m, a)!;
    if (!m) return null;
  }
  return m;
}
