/**
 * 比赛时钟（纯函数）。
 *
 * 复杂棋种按正式比赛常用的「主时间 + 加秒 / 读秒」处理，超时判负；
 * 五子棋、六子冲、飞行棋和跳棋仍用每手 / 每回合 30 秒的休闲规则。
 *
 * 这里只算时间，不碰 UI：组件每 100ms 调一次 `tickClock`，落子时调
 * `clockAfterMove`。所有函数都不修改入参，方便单测。
 */

import type { GameKind, Player } from "./gomoku";

export type ClockKind = "per-move" | "increment" | "byoyomi";

export interface TimeControl {
  id: string;
  label: string;
  kind: ClockKind;
  /** 每方主时间；per-move 模式下是每手时间 */
  mainMs: number;
  /** 每走一手增加的毫秒数（increment） */
  incrementMs: number;
  /** 读秒一期的毫秒数（byoyomi） */
  byoyomiMs: number;
  /** 读秒期数（byoyomi） */
  byoyomiPeriods: number;
  /** 走到第几手时给双方加时（例如 FIDE 40 步） */
  movesToGo?: number;
  bonusMs?: number;
}

export interface SideClock {
  /** 主时间剩余；byoyomi 模式下为 0 表示正在读秒 */
  mainMs: number;
  /** 当前读秒期剩余；非读秒模式忽略 */
  periodMs: number;
  /** 剩余读秒期数 */
  periods: number;
}

export interface MatchClock {
  control: TimeControl;
  p1: SideClock;
  p2: SideClock;
  turn: Player;
  /** 已经走了多少手（半步） */
  moveNo: number;
  /** 上一次结算时间 */
  lastAt: number;
}

export interface TickResult {
  clock: MatchClock;
  /** 超时的一方；null 表示还在走 */
  timeout: Player | null;
}

const MINUTE = 60_000;

export const TIME_CONTROLS: Record<GameKind, readonly TimeControl[]> = {
  gomoku: [
    {
      id: "per-move",
      label: "每手 30 秒",
      kind: "per-move",
      mainMs: 30_000,
      incrementMs: 0,
      byoyomiMs: 0,
      byoyomiPeriods: 0,
    },
  ],
  connect6: [
    {
      id: "per-move",
      label: "每手 30 秒",
      kind: "per-move",
      mainMs: 30_000,
      incrementMs: 0,
      byoyomiMs: 0,
      byoyomiPeriods: 0,
    },
  ],
  ludo: [
    {
      id: "per-turn",
      label: "每回合 30 秒",
      kind: "per-move",
      mainMs: 30_000,
      incrementMs: 0,
      byoyomiMs: 0,
      byoyomiPeriods: 0,
    },
  ],
  checkers: [
    {
      id: "per-turn",
      label: "每回合 30 秒",
      kind: "per-move",
      mainMs: 30_000,
      incrementMs: 0,
      byoyomiMs: 0,
      byoyomiPeriods: 0,
    },
  ],
  go: [
    {
      id: "go-5-3x30",
      label: "友谊 5 分 + 3×30 秒",
      kind: "byoyomi",
      mainMs: 5 * MINUTE,
      incrementMs: 0,
      byoyomiMs: 30_000,
      byoyomiPeriods: 3,
    },
    {
      id: "go-10-3x30",
      label: "快棋 10 分 + 3×30 秒",
      kind: "byoyomi",
      mainMs: 10 * MINUTE,
      incrementMs: 0,
      byoyomiMs: 30_000,
      byoyomiPeriods: 3,
    },
    {
      id: "go-3-3x20",
      label: "快棋 3 分 + 3×20 秒",
      kind: "byoyomi",
      mainMs: 3 * MINUTE,
      incrementMs: 0,
      byoyomiMs: 20_000,
      byoyomiPeriods: 3,
    },
  ],
  chess: [
    {
      id: "chess-15-10",
      label: "快棋 15 分 + 10 秒",
      kind: "increment",
      mainMs: 15 * MINUTE,
      incrementMs: 10_000,
      byoyomiMs: 0,
      byoyomiPeriods: 0,
    },
    {
      id: "chess-90-30",
      label: "经典 90 分 + 30 秒（40 步加 30 分）",
      kind: "increment",
      mainMs: 90 * MINUTE,
      incrementMs: 30_000,
      byoyomiMs: 0,
      byoyomiPeriods: 0,
      movesToGo: 40,
      bonusMs: 30 * MINUTE,
    },
    {
      id: "chess-5-3",
      label: "超快棋 5 分 + 3 秒",
      kind: "increment",
      mainMs: 5 * MINUTE,
      incrementMs: 3_000,
      byoyomiMs: 0,
      byoyomiPeriods: 0,
    },
  ],
  xiangqi: [
    {
      id: "xq-30-30",
      label: "约定 30 分 + 30 秒",
      kind: "increment",
      mainMs: 30 * MINUTE,
      incrementMs: 30_000,
      byoyomiMs: 0,
      byoyomiPeriods: 0,
    },
    {
      id: "xq-10-10",
      label: "快棋 10 分 + 10 秒",
      kind: "increment",
      mainMs: 10 * MINUTE,
      incrementMs: 10_000,
      byoyomiMs: 0,
      byoyomiPeriods: 0,
    },
  ],
  junqi: [
    {
      id: "jq-30-30",
      label: "约定 30 分 + 30 秒",
      kind: "increment",
      mainMs: 30 * MINUTE,
      incrementMs: 30_000,
      byoyomiMs: 0,
      byoyomiPeriods: 0,
    },
    {
      id: "jq-10-10",
      label: "快棋 10 分 + 10 秒",
      kind: "increment",
      mainMs: 10 * MINUTE,
      incrementMs: 10_000,
      byoyomiMs: 0,
      byoyomiPeriods: 0,
    },
  ],
};

export function defaultTimeControl(kind: GameKind): TimeControl {
  return TIME_CONTROLS[kind][0];
}

export function findTimeControl(
  kind: GameKind,
  id: string | undefined,
): TimeControl {
  return (
    TIME_CONTROLS[kind].find((t) => t.id === id) ?? defaultTimeControl(kind)
  );
}

export function timeControlSummary(control: TimeControl): string {
  if (control.kind === "per-move")
    return `每手 / 回合 ${control.mainMs / 1000} 秒`;
  const main = `每方 ${control.mainMs / 60_000} 分钟`;
  return control.kind === "increment"
    ? `${main}，每走一手加 ${control.incrementMs / 1000} 秒`
    : `${main}，主时间用尽后有 ${control.byoyomiPeriods} 次 ${control.byoyomiMs / 1000} 秒读秒`;
}

export function describeTimeControl(control: TimeControl): string {
  let text = timeControlSummary(control) + "。";
  if (control.kind === "byoyomi")
    text +=
      "读秒是主时间用尽后启用的单手时限。及时落子会重置当前读秒，用尽一次就减少一次，全部耗尽判负。";
  else if (control.kind === "increment")
    text +=
      "加秒在完成一手后计入该方余时；双方独立计时，不能在超时后靠加秒继续对局。";
  else
    text += "新的一手 / 回合开始后重置时限。";
  if (control.movesToGo !== undefined && control.bonusMs !== undefined)
    text += `每方第 ${control.movesToGo} 步完成后，该方另加 ${control.bonusMs / 60_000} 分钟。`;
  return text;
}

function sideFor(control: TimeControl): SideClock {
  return {
    mainMs: control.mainMs,
    periodMs: control.kind === "byoyomi" ? control.byoyomiMs : 0,
    periods: control.kind === "byoyomi" ? control.byoyomiPeriods : 0,
  };
}

export function createClock(
  control: TimeControl,
  turn: Player = 1,
  now = Date.now(),
): MatchClock {
  return {
    control,
    p1: sideFor(control),
    p2: sideFor(control),
    turn,
    moveNo: 0,
    lastAt: now,
  };
}

export function sideOf(clock: MatchClock, p: Player): SideClock {
  return p === 1 ? clock.p1 : clock.p2;
}

function withSide(clock: MatchClock, p: Player, side: SideClock): MatchClock {
  return p === 1 ? { ...clock, p1: side } : { ...clock, p2: side };
}

/** 当前这一方还剩多少时间：主时间 +（读秒时）当前一期。 */
export function remainingMs(side: SideClock): number {
  return (
    Math.max(0, side.mainMs) +
    (side.mainMs <= 0 ? Math.max(0, side.periodMs) : 0)
  );
}

/** 主时间或读秒耗尽后，这一方是否已经超时。 */
export function isFlagDown(side: SideClock): boolean {
  return side.mainMs <= 0 && side.periodMs <= 0 && side.periods <= 0;
}

/**
 * 把 from 到 now 的时间从当前一方扣掉；返回新时钟和超时方。
 * 读秒模式下主时间用完后自动进入第一期读秒；读秒期用完则扣一期。
 */
export function tickClock(clock: MatchClock, now: number): TickResult {
  const spent = Math.max(0, now - clock.lastAt);
  if (!Number.isFinite(now)) return { clock, timeout: null };
  if (isFlagDown(sideOf(clock, clock.turn)))
    return { clock, timeout: clock.turn };
  if (spent === 0) return { clock, timeout: null };

  const p = clock.turn;
  const side = sideOf(clock, p);
  const control = clock.control;

  if (control.kind === "per-move") {
    const left = side.mainMs - spent;
    if (left > 0) {
      return {
        clock: withSide({ ...clock, lastAt: now }, p, {
          ...side,
          mainMs: left,
        }),
        timeout: null,
      };
    }
    return {
      clock: withSide({ ...clock, lastAt: now }, p, { ...side, mainMs: 0 }),
      timeout: p,
    };
  }

  if (control.kind === "increment") {
    const left = side.mainMs - spent;
    if (left > 0) {
      return {
        clock: withSide({ ...clock, lastAt: now }, p, {
          ...side,
          mainMs: left,
        }),
        timeout: null,
      };
    }
    return {
      clock: withSide({ ...clock, lastAt: now }, p, { ...side, mainMs: 0 }),
      timeout: p,
    };
  }

  // byoyomi：主时间 -> 当前读秒期 -> 下一期 -> 超时
  let main = side.mainMs;
  let period = side.mainMs > 0 ? control.byoyomiMs : side.periodMs;
  let periods = side.periods;
  let left = spent;

  if (main > 0) {
    const used = Math.min(main, left);
    main -= used;
    left -= used;
    if (main > 0) {
      return {
        clock: withSide({ ...clock, lastAt: now }, p, {
          ...side,
          mainMs: main,
        }),
        timeout: null,
      };
    }
  }

  while (left > 0) {
    if (period <= 0) {
      if (periods <= 0) {
        return {
          clock: withSide({ ...clock, lastAt: now }, p, {
            mainMs: 0,
            periodMs: 0,
            periods: 0,
          }),
          timeout: p,
        };
      }
      period = control.byoyomiMs;
    }
    const used = Math.min(period, left);
    period -= used;
    left -= used;
    if (period <= 0) {
      periods -= 1;
      if (periods <= 0) {
        return {
          clock: withSide({ ...clock, lastAt: now }, p, {
            mainMs: 0,
            periodMs: 0,
            periods: 0,
          }),
          timeout: p,
        };
      }
      period = control.byoyomiMs;
    }
  }

  return {
    clock: withSide({ ...clock, lastAt: now }, p, {
      mainMs: 0,
      periodMs: period,
      periods,
    }),
    timeout: null,
  };
}

/**
 * 落子后结算：先扣掉本手用时，再加秒 / 重置读秒，然后换边。
 * 返回的时钟里 `turn` 已经是下一方。
 */
export function clockAfterMove(
  clock: MatchClock,
  player: Player,
  now: number,
): TickResult {
  if (player !== clock.turn) return { clock, timeout: null };
  const ticked = tickClock(clock, now);
  if (ticked.timeout !== null) return ticked;

  let next = ticked.clock;
  const control = next.control;
  const side = sideOf(next, player);

  if (control.kind === "increment") {
    next = withSide(next, player, {
      ...side,
      mainMs: side.mainMs + control.incrementMs,
    });
  } else if (control.kind === "byoyomi") {
    next = withSide(next, player, {
      ...side,
      periodMs: side.mainMs <= 0 ? control.byoyomiMs : 0,
    });
  }

  const moveNo = next.moveNo + 1;
  if (
    control.movesToGo !== undefined &&
    control.bonusMs !== undefined &&
    Math.ceil(moveNo / 2) === control.movesToGo
  ) {
    next = withSide(next, player, {
      ...sideOf(next, player),
      mainMs: sideOf(next, player).mainMs + control.bonusMs,
    });
  }

  const nextTurn: Player = player === 1 ? 2 : 1;
  if (control.kind === "per-move") {
    next = withSide(next, nextTurn, {
      ...sideOf(next, nextTurn),
      mainMs: control.mainMs,
    });
  }

  return {
    clock: { ...next, turn: nextTurn, moveNo, lastAt: now },
    timeout: null,
  };
}

/** Withdraw completed turns and their awards, without refunding thinking time. */
export function clockAfterUndo(
  clock: MatchClock,
  movers: readonly Player[],
  turn: Player,
  now: number,
  running = true,
): TickResult {
  const ticked = running ? tickClock(clock, now) : { clock, timeout: null };
  if (ticked.timeout !== null) return ticked;
  let next = ticked.clock;
  for (let i = movers.length - 1; i >= 0 && next.moveNo > 0; i--) {
    const player = movers[i],
      control = next.control;
    if (control.kind === "increment") {
      const bonus =
        control.movesToGo !== undefined &&
        Math.ceil(next.moveNo / 2) === control.movesToGo
          ? (control.bonusMs ?? 0)
          : 0;
      const side = sideOf(next, player);
      next = withSide(next, player, {
        ...side,
        mainMs: Math.max(0, side.mainMs - control.incrementMs - bonus),
      });
    }
    next = { ...next, moveNo: next.moveNo - 1 };
  }
  next = { ...next, turn, lastAt: now };
  return { clock: next, timeout: isFlagDown(sideOf(next, turn)) ? turn : null };
}

/** 悔棋 / 回看后把时钟换回某方，不改变剩余时间。 */
export function setClockTurn(clock: MatchClock, turn: Player): MatchClock {
  return { ...clock, turn, lastAt: Date.now() };
}

/** "4:32" 或读秒时的 "0:28 ×3" */
export function formatClock(side: SideClock, control: TimeControl): string {
  if (control.kind === "byoyomi" && side.mainMs <= 0) {
    return `${formatMs(side.periodMs)}  ×${side.periods}`;
  }
  return formatMs(side.mainMs);
}

export function formatMs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/** 棋钟的紧迫程度：最后 10 秒（或最后 5 秒读秒）标红。 */
export function clockUrgent(side: SideClock, control: TimeControl): boolean {
  if (control.kind === "byoyomi" && side.mainMs <= 0) {
    return side.periodMs <= 5_000;
  }
  return side.mainMs <= 10_000;
}

/** Restore only bounded values; the control is resolved from the catalog, never trusted from JSON. */
export function restoreClock(
  kind: GameKind,
  value: unknown,
  turn: Player,
  now = Date.now(),
): MatchClock | null {
  if (!value || typeof value !== "object") return null;
  const v = value as MatchClock;
  const control = TIME_CONTROLS[kind].find((c) => c.id === v.control?.id);
  if (
    !control ||
    !Number.isInteger(v.moveNo) ||
    v.moveNo < 0 ||
    v.moveNo > 4000 ||
    v.turn !== turn
  )
    return null;
  for (const side of [v.p1, v.p2]) {
    if (
      !side ||
      !Number.isFinite(side.mainMs) ||
      side.mainMs < 0 ||
      side.mainMs > 24 * 60 * 60_000 ||
      !Number.isFinite(side.periodMs) ||
      side.periodMs < 0 ||
      side.periodMs > control.byoyomiMs ||
      !Number.isInteger(side.periods) ||
      side.periods < 0 ||
      side.periods > control.byoyomiPeriods
    )
      return null;
  }
  return { ...v, control, p1: { ...v.p1 }, p2: { ...v.p2 }, lastAt: now };
}
