import { expect, test } from "nsh/test";
import {
  C6_WIN,
  c6Idx,
  c6InBoard,
  connect6Ai,
  createConnect6,
  playConnect6,
  type C6State,
} from "./connect6";

function put(state: C6State, cells: [number, number][], p: 1 | 2): C6State {
  const board = state.board.slice();
  for (const [x, y] of cells) board[c6Idx(x, y)] = p;
  return { ...state, board };
}

test("六子棋开局棋盘 19 路且黑棋第一手只能一子", () => {
  const start = createConnect6();
  expect(start.board.length).toBe(19 * 19);
  expect(start.turn).toBe(1);
  expect(start.left).toBe(1);

  const one = playConnect6(start, 9, 9);
  expect(one).not.toBe(null);
  expect(one!.turn).toBe(2);
  expect(one!.left).toBe(2);

  // 白棋连下两子
  const two = playConnect6(one!, 8, 8);
  expect(two!.turn).toBe(2);
  expect(two!.left).toBe(1);
  const three = playConnect6(two!, 10, 10);
  expect(three!.turn).toBe(1);
  expect(three!.left).toBe(2);
});

test("六子棋不能下在已占用或越界的位置", () => {
  const start = createConnect6();
  const one = playConnect6(start, 9, 9)!;
  expect(playConnect6(one, 9, 9)).toBe(null);
  expect(playConnect6(one, -1, 5)).toBe(null);
  expect(playConnect6(one, 19, 5)).toBe(null);
  expect(c6InBoard(0, 0)).toBe(true);
  expect(c6InBoard(18, 18)).toBe(true);
  expect(c6InBoard(19, 18)).toBe(false);
});

test("六连（含超过六子）判胜并返回连线", () => {
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ] as const) {
    let state = createConnect6();
    state = put(state, [], 1);
    state = put(state, Array.from({ length: C6_WIN }, (_, i) => [5 + dx * i, 5 + dy * i]) as [number, number][], 1);
    // 黑棋下一子只是在别处走，此时已经提前成六；用 play 检查最后落子
    const target = state;
    const last = playConnect6(
      { ...target, board: target.board.map((v, i) => (i === c6Idx(5 + dx * 5, 5 + dy * 5) ? 0 : v)) },
      5 + dx * 5,
      5 + dy * 5,
    );
    expect(last?.result?.kind).toBe("win");
    expect(last?.result?.winner).toBe(1);
    expect(last?.result?.line.length).toBeGreaterThanOrEqual(C6_WIN);
  }
});

test("六子棋长连也判胜", () => {
  let state = createConnect6();
  const board = state.board.slice();
  for (let x = 3; x < 3 + 7; x++) board[c6Idx(x, 4)] = 1;
  state = { ...state, board, turn: 1, left: 2 };
  // 最后补一子在第 10 列；之前 7 子已经存在（正常对局不可能，但规则上应判胜）
  board[c6Idx(9, 4)] = 0;
  state = { ...state, board };
  const next = playConnect6(state, 9, 4);
  expect(next?.result?.kind).toBe("win");
  expect(next?.result?.line.length).toBe(7);
});

test("棋盘下满且无人连六判和", () => {
  const start = createConnect6();
  const board: number[] = start.board.map((_, i) => {
    const x = i % 19;
    const y = (i - x) / 19;
    return (x + 2 * y) % 4 < 2 ? 1 : 2;
  });
  // 留一个空位让黑棋落最后一子，并保证不会连六：棋盘按斜条纹填充本身没有六连
  board[c6Idx(18, 18)] = 0;
  const almost: C6State = { ...start, board, turn: 1, left: 1 };
  const done = playConnect6(almost, 18, 18);
  expect(done).not.toBe(null);
  expect(done!.result?.kind).toBe("draw");
});

test("AI 立刻补成六", () => {
  const start = createConnect6();
  const board = start.board.slice();
  for (let x = 4; x <= 8; x++) board[c6Idx(x, 6)] = 1;
  const state: C6State = { ...start, board, turn: 1, left: 2 };
  const plan = connect6Ai(state, "hell");
  expect(plan.length).toBe(2);
  const first = plan[0];
  const after = playConnect6(state, first.x, first.y);
  expect(after?.result?.kind).toBe("win");
});

test("AI 在空棋盘落天元，合法且不重复", () => {
  const start = createConnect6();
  const plan = connect6Ai(start, "normal");
  expect(plan).toEqual([{ x: 9, y: 9 }]);
  const next = playConnect6(start, plan[0].x, plan[0].y)!;
  const reply = connect6Ai(next, "normal");
  expect(reply.length).toBe(2);
  expect(reply[0]).not.toEqual(reply[1]);
  for (const p of reply) {
    expect(next.board[c6Idx(p.x, p.y)]).toBe(0);
  }
});

test("AI 会挡对手的五连", () => {
  const start = createConnect6();
  const board = start.board.slice();
  for (let x = 4; x <= 8; x++) board[c6Idx(x, 8)] = 1;
  const state: C6State = { ...start, board, turn: 2, left: 2 };
  const plan = connect6Ai(state, "hell");
  expect(plan.length).toBe(2);
  const spots = plan.map((p) => c6Idx(p.x, p.y));
  expect(spots.includes(c6Idx(3, 8)) || spots.includes(c6Idx(9, 8))).toBe(true);
});
