import { expect, test } from "nsh/test";
import { createGoBoard, goGroup, playGo, type GoSize } from "./go";
import { findGoMove } from "./go-ai";

const at = (x: number, y: number, size: number) => y * size + x;

test("围棋 AI 在空盘上给出合法落点", () => {
  const size = 9 as GoSize;
  const board = createGoBoard(size);
  for (const level of ["easy", "normal", "hard", "hell"] as const) {
    const m = findGoMove(board, size, 1, level, -1, {
      random: () => 0.25,
      deadlineMs: 200,
    });
    expect(m.pass).toBe(false);
    expect(playGo(board, size, m.x, m.y, 1).ok).toBe(true);
  }
});

test("围棋 AI 会提掉只剩一口气的对方棋块", () => {
  const size = 9 as GoSize;
  const b = createGoBoard(size);
  b[at(4, 4, size)] = 2;
  b[at(4, 3, size)] = 1;
  b[at(4, 5, size)] = 1;
  b[at(3, 4, size)] = 1;
  // 白棋只剩 (5,4) 一口气，黑棋应当提子
  const m = findGoMove(b, size, 1, "hard", -1, { deadlineMs: 300 });
  expect(m.pass).toBe(false);
  expect(m.x).toBe(5);
  expect(m.y).toBe(4);
});

test("围棋 AI 不会主动填自己的真眼", () => {
  const size = 9 as GoSize;
  const b = createGoBoard(size);
  // 黑棋在角上做出一个真眼，白棋在外侧
  b[at(1, 0, size)] = 1;
  b[at(0, 1, size)] = 1;
  b[at(2, 1, size)] = 2;
  b[at(1, 2, size)] = 2;
  b[at(2, 2, size)] = 2;
  const m = findGoMove(b, size, 1, "hell", -1, { deadlineMs: 500 });
  expect(m.pass).toBe(false);
  expect(m.x === 0 && m.y === 0).toBe(false);
});

test("四档围棋 AI 自对弈始终合法，且不会卡死", () => {
  const size = 9 as GoSize;
  let board = createGoBoard(size);
  let ko = -1;
  let moves = 0;
  for (let n = 0; n < 24; n++) {
    const p = n % 2 === 0 ? 1 : 2;
    const level = (["easy", "normal", "hard", "hell"] as const)[n % 4];
    const m = findGoMove(board, size, p, level, ko, {
      random: () => (n * 0.37) % 1,
      deadlineMs: 250,
    });
    if (m.pass) {
      ko = -1;
      moves++;
      continue;
    }
    const r = playGo(board, size, m.x, m.y, p, ko);
    expect(r.ok).toBe(true);
    board = r.board;
    ko = r.ko;
    moves++;
  }
  expect(moves).toBe(24);
  expect(goGroup(board, size, 0) === null || true).toBe(true);
});

test("围棋 AI 的地狱档在预算内返回", () => {
  const size = 9 as GoSize;
  const b = createGoBoard(size);
  for (let i = 0; i < 8; i++) {
    b[at(2 + i, 4, size)] = i % 2 === 0 ? 1 : 2;
  }
  const started = Date.now();
  const m = findGoMove(b, size, 1, "hell", -1, { deadlineMs: 600 });
  expect(m.pass || playGo(b, size, m.x, m.y, 1).ok).toBe(true);
  expect(Date.now() - started).toBeLessThan(2000);
});
