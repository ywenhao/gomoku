import { expect, test } from "nsh/test";
import {
  ENDGAMES,
  startEndgame,
  endgameHint,
  playEndgame,
  queryEndgames,
} from "./endgames";
import { fromFen, parseUci, playRoyal, type RoyalState } from "./royal";
import type { MateProof } from "./data/xiangqi-puzzles";
test("残局规模、国际象棋全部解答合法，中国象棋全部防守分支合法且将杀", async () => {
  expect(ENDGAMES.filter((p) => p.kind === "chess").length).toBe(600);
  expect(ENDGAMES.filter((p) => p.kind === "xiangqi").length).toBe(900);
  let proofs = 0;
  function verify(s: RoyalState, proof: MateProof): void {
    const after = playRoyal(s, proof.move);
    expect(after).not.toBe(null);
    if (!proof.responses.length) {
      expect(after!.result?.winner).toBe(s.turn);
      return;
    }
    for (const reply of proof.responses) {
      const n = playRoyal(after!, reply.move);
      expect(n).not.toBe(null);
      verify(n!, reply.node);
    }
  }
  let checked = 0;
  for (const p of ENDGAMES) {
    if (++checked % 20 === 0)
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    let s = fromFen(p.kind, p.fen);
    expect(s).not.toBe(null);
    for (const uci of p.line) {
      const m = parseUci(s!, uci);
      s = m ? playRoyal(s!, m) : null;
      expect(s).not.toBe(null);
    }
    if (p.proof) {
      verify(fromFen(p.kind, p.fen)!, p.proof);
      proofs++;
    }
  }
  expect(proofs >= 30).toBe(true);
});
test("残局提示、完整过关与筛选；错手不改局面", () => {
  for (const kind of ["chess", "xiangqi"] as const) {
    const p = ENDGAMES.find(
      (p) => p.kind === kind && (p.line.length || p.proof),
    )!;
    let s = startEndgame(p)!;
    const bad = playEndgame(s, { from: -1, to: -1 });
    expect(bad.state).toBe(s.state);
    for (let i = 0; i < 10 && !s.solved; i++)
      s = playEndgame(s, endgameHint(s)!);
    expect(s.solved).toBe(true);
    expect(
      queryEndgames(kind, p.id, "全部", "全部", [], "全部").length,
    ).toBeGreaterThanOrEqual(1);
    expect(queryEndgames(kind, "", "全部", "全部", [p.id], "已解").length).toBe(
      1,
    );
  }
});
