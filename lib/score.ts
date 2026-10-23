/**
 * 计分规则（纯函数）。
 *
 * 单局得分 = 胜负基础分 + 速度奖励 + 效率奖励 + 连胜奖励 − 悔棋/超时扣分
 * 总分在结算时累加，最高分取单局最高。
 */

import type { Difficulty } from "./gomoku";

export type Outcome = "win" | "loss" | "draw";

/** 每手限时（秒） */
export const MOVE_SECONDS = 30;
/** 每次悔棋扣分 */
export const UNDO_PENALTY = 15;
/** 每次超时扣分 */
export const TIMEOUT_PENALTY = 10;
/** 拿满速度奖励所需的用时上限（秒） */
export const SPEED_TARGET = 120;
/** 单局历史最多保留条数 */
export const HISTORY_LIMIT = 40;

const BASE: Record<Difficulty, number> = { easy: 100, normal: 180, hard: 300 };

export interface ScoreLine {
  label: string;
  value: number;
}

export interface Breakdown {
  lines: ScoreLine[];
  total: number;
  stars: 0 | 1 | 2 | 3;
}

export interface Facts {
  outcome: Outcome;
  level: Difficulty;
  /** 总手数 */
  moves: number;
  /** 本局用时（秒） */
  seconds: number;
  undos: number;
  timeouts: number;
  /** 结算后的连胜数（仅胜利时 > 1 有奖励） */
  streak: number;
}

export interface GameRecord {
  at: number;
  outcome: Outcome;
  level: Difficulty;
  mode: "pve" | "pvp";
  moves: number;
  seconds: number;
  delta: number;
  stars: number;
}

const clamp = (n: number, lo: number, hi: number) =>
  n < lo ? lo : n > hi ? hi : n;

export function scoreGame(f: Facts): Breakdown {
  const lines: ScoreLine[] = [];
  let total = 0;

  const add = (label: string, value: number) => {
    const v = Math.round(value);
    if (v === 0) return;
    lines.push({ label, value: v });
    total += v;
  };

  if (f.outcome === "win") {
    add("胜利基础", BASE[f.level]);
    add(
      "速度奖励",
      clamp((SPEED_TARGET - f.seconds) / SPEED_TARGET, 0, 1) * 120,
    );
    add("效率奖励", clamp((55 - f.moves) * 3, 0, 90));
    if (f.streak >= 2) add(`连胜 ×${f.streak}`, Math.min(50, (f.streak - 1) * 15));
  } else if (f.outcome === "draw") {
    add("和棋", 30);
  } else {
    add("落败", -60);
  }

  if (f.undos > 0) add(`悔棋 ×${f.undos}`, -UNDO_PENALTY * f.undos);
  if (f.timeouts > 0) add(`超时 ×${f.timeouts}`, -TIMEOUT_PENALTY * f.timeouts);

  let stars: 0 | 1 | 2 | 3 = 0;
  if (f.outcome === "win") {
    if (f.undos === 0 && f.timeouts === 0 && f.seconds <= SPEED_TARGET * 0.6) {
      stars = 3;
    } else if (f.undos === 0 && f.timeouts === 0) {
      stars = 2;
    } else {
      stars = 1;
    }
  }

  return { lines, total, stars };
}

export function outcomeLabel(o: Outcome): string {
  if (o === "win") return "胜利";
  if (o === "loss") return "惜败";
  return "和棋";
}

export function outcomeTone(o: Outcome): "win" | "loss" | "draw" {
  return o;
}

/** 秒 → "1:07" */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? "0" : ""}${r}`;
}

/** 时间戳 → "10-23 11:32" */
export function formatStamp(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
