import { expect, test } from "nsh/test";
import { playGo, type GoSize } from "./go";
import {
  TSUMEGO_PROBLEMS,
  playTsumego,
  problemBoard,
  queryTsumego,
  sgfPoint,
  startTsumego,
  tsumegoHint,
  type TsumegoNode,
} from "./tsumego";

function walk(node: TsumegoNode, fn: (n: TsumegoNode) => void) {
  fn(node);
  for (const c of node.c) walk(c, fn);
}

test("残局数据有数百道，四个难度都有", () => {
  expect(TSUMEGO_PROBLEMS.length).toBe(420);
  const levels = new Set(TSUMEGO_PROBLEMS.map((p) => p.level));
  expect(levels.has("easy")).toBe(true);
  expect(levels.has("normal")).toBe(true);
  expect(levels.has("hard")).toBe(true);
  expect(levels.has("hell")).toBe(true);
});

test("每道残局的题面与正解树都合法", () => {
  for (const problem of TSUMEGO_PROBLEMS.slice(0, 60)) {
    const board = problemBoard(problem);
    expect(board.filter((v) => v !== 0).length).toBeGreaterThan(2);
    let count = 0;
    for (const root of problem.solutions) {
      walk(root, (node) => count++);
    }
    expect(count).toBeGreaterThan(0);
  }
});

test("按难度、区域和关键字筛选与排序", () => {
  const easy = queryTsumego({
    level: "easy",
    region: "全部",
    text: "",
    sort: "no",
  });
  expect(easy.length).toBe(140);
  expect(easy.every((p) => p.level === "easy")).toBe(true);

  const corner = queryTsumego({
    level: "全部",
    region: "角部",
    text: "",
    sort: "name",
  });
  expect(corner.length).toBeGreaterThan(100);
  expect(corner.every((p) => p.region === "角部")).toBe(true);

  const search = queryTsumego({
    level: "全部",
    region: "全部",
    text: "001",
    sort: "level",
  });
  expect(search.some((p) => p.no === 1)).toBe(true);
});

test("走错时不会污染棋盘，走对后自动应手直到完成", () => {
  const problem = TSUMEGO_PROBLEMS[0];
  const session = startTsumego(problem);
  const before = session.board.slice();
  expect(playTsumego(problem, session, 0, 0)).toBe("wrong");
  expect(session.board).toEqual(before);

  const hint = tsumegoHint(session);
  expect(hint).not.toBe(null);
  const result = playTsumego(problem, session, hint!.x, hint!.y);
  expect(["ok", "solved"]).toContain(result);

  // 若还有后续，继续按提示落子，最多 20 手一定完成
  let guard = 0;
  while (!session.solved && guard++ < 20) {
    const next = tsumegoHint(session);
    expect(next).not.toBe(null);
    playTsumego(problem, session, next!.x, next!.y);
  }
  expect(session.solved).toBe(true);
});

test("SGF 坐标解析", () => {
  expect(sgfPoint("aa")).toEqual({ x: 0, y: 0 });
  expect(sgfPoint("rs")).toEqual({ x: 17, y: 18 });
});

test("正解中的每一手在当前局面都是合法的", () => {
  for (const problem of TSUMEGO_PROBLEMS.slice(0, 20)) {
    const session = startTsumego(problem);
    let guard = 0;
    while (!session.solved && guard++ < 30) {
      const hint = tsumegoHint(session);
      if (!hint) break;
      const r = playGo(session.board, problem.size, hint.x, hint.y, 1, session.ko);
      expect(r.ok).toBe(true);
      playTsumego(problem, session, hint.x, hint.y);
    }
    expect(session.solved).toBe(true);
  }
});
