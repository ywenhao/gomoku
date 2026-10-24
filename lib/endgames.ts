import { CHESS_PUZZLES } from "./data/chess-puzzles";
import { XIANGQI_PUZZLES, type MateProof } from "./data/xiangqi-puzzles";
import {
  fromFen,
  parseUci,
  playRoyal,
  royalLegalMoves,
  royalAi,
  squareName,
  type RoyalKind,
  type RoyalMove,
  type RoyalState,
} from "./royal";
export interface Endgame {
  id: string;
  kind: RoyalKind;
  name: string;
  fen: string;
  category: string;
  rating: number;
  line: string[];
  proof: MateProof | null;
  themes: string;
}
const THEME_NAMES: Record<string, string> = {
  mateIn1: "一步将杀",
  mateIn2: "两步将杀",
  mateIn3: "三步将杀",
  fork: "叉击",
  pin: "牵制",
  skewer: "串击",
  discoveredAttack: "闪击",
  sacrifice: "弃子",
  rookEndgame: "车残局",
  pawnEndgame: "兵残局",
  queenEndgame: "后残局",
  knightEndgame: "马残局",
  bishopEndgame: "象残局",
  endgame: "实用残局",
};
export const ENDGAMES: readonly Endgame[] = [
  ...CHESS_PUZZLES.map((p) => ({
    id: p.id,
    kind: "chess" as const,
    name:
      (Object.keys(THEME_NAMES)
        .filter((t) => p.themes.split(" ").includes(t))
        .map((t) => THEME_NAMES[t])
        .join(" · ") || "战术训练") +
      " · " +
      p.id.slice(3),
    fen: p.fen,
    category:
      p.themes.includes("Endgame") || p.themes.includes("endgame")
        ? "实用残局"
        : "战术挑战",
    rating: p.rating,
    line: p.moves.split(" "),
    proof: null,
    themes: p.themes,
  })),
  ...XIANGQI_PUZZLES.map((p) => ({
    ...p,
    kind: "xiangqi" as const,
    rating: 0,
    line: [],
    themes: p.name,
  })),
];
export interface EndgameSession {
  problem: Endgame;
  state: RoyalState;
  start: RoyalState;
  lineAt: number;
  proof: MateProof | null;
  solved: boolean;
  steps: RoyalState[];
  notice: string;
  hints: number;
}
export function startEndgame(p: Endgame): EndgameSession | null {
  let s = fromFen(p.kind, p.fen);
  if (!s) return null;
  if (p.line.length) {
    const m = parseUci(s, p.line[0]);
    s = m ? playRoyal(s, m) : null;
    if (!s) return null;
  }
  return {
    problem: p,
    state: s,
    start: s,
    lineAt: p.line.length ? 1 : 0,
    proof: p.proof,
    solved: false,
    steps: [s],
    notice: p.line.length
      ? "对手刚走了一步，轮到你寻找最佳着。"
      : p.proof
        ? "找到强制将杀，系统会自动应手。"
        : "自由研习：双方合法走子，AI应手不代表理论正解。",
    hints: 0,
  };
}
export function endgameHint(s: EndgameSession): RoyalMove | null {
  if (s.solved || s.state.result) return null;
  if (s.problem.line.length) return parseUci(s.state, s.problem.line[s.lineAt]);
  if (s.proof) return s.proof.move;
  return royalAi(s.state, "hard");
}
const same = (a: RoyalMove, b: RoyalMove) =>
  a.from === b.from &&
  a.to === b.to &&
  (a.promotion ?? 0) === (b.promotion ?? 0);
export function playEndgame(s: EndgameSession, m: RoyalMove): EndgameSession {
  if (s.solved || s.state.result) return s;
  const expected = endgameHint(s),
    n = playRoyal(s.state, m);
  if (!n) return { ...s, notice: "非法走法，请选择高亮落点。" };
  const challenge = s.problem.line.length > 0 || s.problem.proof !== null;
  if (
    challenge &&
    expected &&
    !same(expected, m) &&
    !(n.result?.winner === s.start.turn)
  )
    return {
      ...s,
      notice: "这一手不在校验的正解中，棋盘保持原样。请重新计算。",
    };
  let state = n,
    lineAt = s.lineAt + 1,
    proof = s.proof,
    steps = s.steps.concat([n]);
  if (n.result?.winner === s.start.turn)
    return {
      ...s,
      state,
      steps,
      solved: true,
      notice: "将杀成功！已记录进度。",
    };
  if (s.problem.line.length && lineAt < s.problem.line.length) {
    const reply = parseUci(state, s.problem.line[lineAt]);
    const after = reply ? playRoyal(state, reply) : null;
    if (!after) return { ...s, notice: "解答数据无法继续，请换一题。" };
    state = after;
    steps = steps.concat([after]);
    lineAt++;
  } else if (proof) {
    const reply = proof.responses[0];
    if (reply) {
      const after = playRoyal(state, reply.move);
      if (!after) return { ...s, notice: "解答数据无法继续，请换一题。" };
      state = after;
      steps = steps.concat([after]);
      proof = reply.node;
    } else proof = null;
  } else if (!challenge && !state.result) {
    const reply = royalAi(state, "hard"),
      after = reply ? playRoyal(state, reply) : null;
    if (after) {
      state = after;
      steps = steps.concat([after]);
    }
  }
  const solved = challenge
    ? s.problem.line.length
      ? lineAt >= s.problem.line.length
      : !proof
    : state.result?.winner === s.start.turn;
  return {
    ...s,
    state,
    lineAt,
    proof,
    steps,
    solved: !!solved,
    notice: solved
      ? "正解完成！已记录进度。"
      : state.result
        ? state.result.reason
        : challenge
          ? "正确，继续计算下一手。"
          : "AI已应手，继续研究局面。",
  };
}
export function describeMove(s: RoyalState, m: RoyalMove): string {
  return `${squareName(m.from, s.kind)} → ${squareName(m.to, s.kind)}${m.promotion ? "（升变）" : ""}`;
}
export function queryEndgames(
  kind: RoyalKind,
  text: string,
  category: string,
  level: string,
  solved: readonly string[],
  status: string,
): Endgame[] {
  const search = text.trim().toLowerCase();
  return ENDGAMES.filter(
    (p) =>
      p.kind === kind &&
      (!search ||
        `${p.name} ${p.id} ${p.themes}`.toLowerCase().includes(search)) &&
      (category === "全部" || p.category === category) &&
      (level === "全部" ||
        kind === "xiangqi" ||
        (level === "入门"
          ? p.rating < 1200
          : level === "进阶"
            ? p.rating >= 1200 && p.rating < 1700
            : p.rating >= 1700)) &&
      (status === "全部" ||
        (status === "已解" ? solved.includes(p.id) : !solved.includes(p.id))),
  );
}

export const ENDGAME_CREDITS =
  '中国象棋资料来源：https://github.com/dffge552/xiangqi-pwa-offline\n\nMIT License\n\nCopyright (c) 2026 dffge552\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n\n国际象棋：Lichess Puzzle Database，CC0 1.0 Universal。https://database.lichess.org/#puzzles\n';
