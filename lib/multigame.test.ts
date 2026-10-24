import { expect, test } from "nsh/test";
import {
  createMatch,
  applyAction,
  matchAi,
  replayMatch,
  type ExtraKind,
  type Action,
} from "./multigame";
import { readSavedGame } from "./save";
import { createClock, defaultTimeControl, restoreClock } from "./clock";
test("所有新增棋种可合法连续对局并从动作完整重建", async () => {
  for (const kind of [
    "connect6",
    "ludo",
    "checkers",
    "chess",
    "xiangqi",
    "junqi",
  ] as ExtraKind[]) {
    let m = createMatch(kind);
    const actions: Action[] = [];
    for (let i = 0; i < 24 && !m.state.result; i++) {
      const a = matchAi(m, "easy");
      expect(a).not.toBe(null);
      const n = applyAction(m, a!);
      expect(n).not.toBe(null);
      actions.push(a!);
      m = n!;
      if (i % 4 === 0)
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    const rebuilt = replayMatch(kind, actions);
    expect(rebuilt).not.toBe(null);
    expect(rebuilt!.state).toEqual(m.state);
    if (!m.state.result) {
      const raw = JSON.stringify({
        kind,
        moves: [],
        actions,
        clock: createClock(
          defaultTimeControl(kind),
          Math.min(2, m.state.turn) as 1 | 2,
        ),
        startedAt: 1,
        savedAt: 1,
      });
      expect(readSavedGame(raw)?.actions).toEqual(actions);
    }
  }
});
test("骰子重放确定，损坏动作、非法布阵与伪造时限被拒绝", () => {
  expect(replayMatch("ludo", [{ roll: true }])).toBe(null);
  expect(replayMatch("chess", [{ from: 52, to: 20 }])).toBe(null);
  expect(replayMatch("connect6", [{ to: 361 }])).toBe(null);
  expect(replayMatch("junqi", [], new Array(60).fill(0))).toBe(null);
  expect(restoreClock("chess", { control: { id: "custom" } }, 1)).toBe(null);
  const actions = [
    { roll: true, die: 6 },
    { plane: 0 },
    { roll: true, die: 3 },
    { plane: 0 },
  ];
  expect(replayMatch("ludo", actions)?.state).toEqual(
    replayMatch("ludo", actions)?.state,
  );
  expect(
    readSavedGame(
      JSON.stringify({ kind: "other", moves: [{ x: 1, y: 1, p: 1 }] }),
    ),
  ).toBe(null);
});
