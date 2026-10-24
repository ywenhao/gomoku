/**
 * 棋类目录：首页、帮助、教程、棋谱和存档都从这里取棋种名称与分类，
 * 以后加新棋类只要补一条记录和对应组件。
 */

import type { GameKind, Mode } from "./gomoku";

export const MODE_LABELS: Record<Mode, string> = {
  pve: "对战 AI",
  pvp: "双人",
  aiai: "AI 观战",
};

export type GameFamily = "stone" | "race" | "chess" | "war";

export interface GameMeta {
  kind: GameKind;
  name: string;
  latin: string;
  glyph: string;
  desc: string;
  family: GameFamily;
  players: string;
  board: string;
  /** 默认是否有对战 AI / AI 观战 */
  modes: readonly ("pve" | "pvp" | "aiai")[];
  /** 首页设置里显示的时间规则 */
  clock: string;
  /** 这个棋种是否有残局库 */
  endgames: boolean;
  /** 教程入口文案 */
  learn: string;
}

export const GAMES: readonly GameMeta[] = [
  {
    kind: "gomoku",
    name: "五子棋",
    latin: "GOMOKU",
    glyph: "五",
    desc: "五连即胜，节奏明快",
    family: "stone",
    players: "1–2 人",
    board: "15 × 15",
    modes: ["pve", "pvp", "aiai"],
    clock: "每手 30 秒",
    endgames: false,
    learn: "棋型、开局与攻防",
  },
  {
    kind: "go",
    name: "围棋",
    latin: "GO",
    glyph: "围",
    desc: "围地提子，变化无穷",
    family: "stone",
    players: "1–2 人",
    board: "9 / 13 / 19 路",
    modes: ["pve", "pvp", "aiai"],
    clock: "主时间 + 读秒",
    endgames: true,
    learn: "气、做活与数子",
  },
  {
    kind: "connect6",
    name: "六子棋",
    latin: "CONNECT6",
    glyph: "六",
    desc: "每手两子，连六即胜",
    family: "stone",
    players: "1–2 人",
    board: "19 × 19",
    modes: ["pve", "pvp", "aiai"],
    clock: "每手 30 秒",
    endgames: false,
    learn: "双子进攻与防守",
  },
  {
    kind: "ludo",
    name: "飞行棋",
    latin: "LUDO",
    glyph: "飞",
    desc: "掷骰起飞，先到终点",
    family: "race",
    players: "1–4 人",
    board: "4 色 16 机",
    modes: ["pve", "pvp", "aiai"],
    clock: "每回合 30 秒",
    endgames: false,
    learn: "掷骰、跳跃与回巢",
  },
  {
    kind: "checkers",
    name: "跳棋",
    latin: "CHINESE CHECKERS",
    glyph: "跳",
    desc: "连跳过河，占满对营",
    family: "race",
    players: "1–2 人",
    board: "121 孔星盘",
    modes: ["pve", "pvp", "aiai"],
    clock: "每回合 30 秒",
    endgames: false,
    learn: "单步、连跳与阵形",
  },
  {
    kind: "chess",
    name: "国际象棋",
    latin: "CHESS",
    glyph: "♞",
    desc: "王车易位，将死王棋",
    family: "chess",
    players: "1–2 人",
    board: "8 × 8",
    modes: ["pve", "pvp", "aiai"],
    clock: "15 分 + 10 秒",
    endgames: true,
    learn: "走子、易位与将杀",
  },
  {
    kind: "xiangqi",
    name: "中国象棋",
    latin: "XIANGQI",
    glyph: "将",
    desc: "楚河汉界，将死将帅",
    family: "chess",
    players: "1–2 人",
    board: "9 × 10",
    modes: ["pve", "pvp", "aiai"],
    clock: "约定 30 分 + 30 秒",
    endgames: true,
    learn: "马腿、炮架与杀法",
  },
  {
    kind: "junqi",
    name: "军旗",
    latin: "JUNQI",
    glyph: "军",
    desc: "暗棋布阵，夺旗获胜",
    family: "war",
    players: "1–2 人",
    board: "5 × 12",
    modes: ["pve", "pvp", "aiai"],
    clock: "约定 30 分 + 30 秒",
    endgames: false,
    learn: "暗棋、行营与铁路",
  },
];

const BY_KIND = new Map<GameKind, GameMeta>(GAMES.map((g) => [g.kind, g]));

export function gameMeta(kind: GameKind): GameMeta {
  return BY_KIND.get(kind) ?? GAMES[0];
}

export function gameName(kind: GameKind): string {
  return gameMeta(kind).name;
}

export function isComplexGame(kind: GameKind): boolean {
  return (
    kind === "go" || kind === "chess" || kind === "xiangqi" || kind === "junqi"
  );
}

export function isStoneGame(kind: GameKind): boolean {
  return kind === "gomoku" || kind === "go" || kind === "connect6";
}

/** 需要时钟且采用「超时判负」的棋种；其余棋种超时只自动走一手。 */
export function clockLosesOnTimeout(kind: GameKind): boolean {
  return isComplexGame(kind);
}
