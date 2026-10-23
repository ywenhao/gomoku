import { expect, test } from "nsh/test";
import { findBestMove } from "./ai";
import {
  createBoard,
  findWinLine,
  idx,
  isFull,
  other,
  type Difficulty,
  type Player,
} from "./gomoku";

/** 用 15 行字符画构造棋盘：X 黑、O 白、. 空 */
function parse(rows: string[]): number[] {
  const b = createBoard();
  rows.forEach((row, y) => {
    for (let x = 0; x < 15; x++) {
      const c = row[x];
      if (c === "X") b[idx(x, y)] = 1;
      else if (c === "O") b[idx(x, y)] = 2;
    }
  });
  return b;
}

const EMPTY = "...............";

/** 棋盘上某方最长的连子数 */
function longestRun(b: readonly number[], p: Player): number {
  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  let best = 0;
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      if (b[idx(x, y)] !== p) continue;
      for (const [dx, dy] of dirs) {
        if (x - dx >= 0 && y - dy >= 0 && x - dx < 15 && y - dy < 15 && b[idx(x - dx, y - dy)] === p) {
          continue; // 只从连子起点开始数
        }
        let n = 0;
        let cx = x;
        let cy = y;
        while (cx >= 0 && cy >= 0 && cx < 15 && cy < 15 && b[idx(cx, cy)] === p) {
          n++;
          cx += dx;
          cy += dy;
        }
        if (n > best) best = n;
      }
    }
  }
  return best;
}

/* ------------------------------ 规则 ------------------------------ */

test("横向五连判胜", () => {
  const b = createBoard();
  for (let x = 3; x <= 7; x++) b[idx(x, 5)] = 1;
  const line = findWinLine(b, 5, 5, 1);
  expect(line !== null).toBe(true);
  expect(line!.length >= 5).toBe(true);
});

test("纵向五连判胜", () => {
  const b = createBoard();
  for (let y = 2; y <= 6; y++) b[idx(9, y)] = 2;
  expect(findWinLine(b, 9, 4, 2) !== null).toBe(true);
});

test("两条斜线五连判胜", () => {
  const a = createBoard();
  for (let i = 0; i < 5; i++) a[idx(2 + i, 3 + i)] = 1;
  expect(findWinLine(a, 4, 5, 1) !== null).toBe(true);

  const c = createBoard();
  for (let i = 0; i < 5; i++) c[idx(10 - i, 2 + i)] = 2;
  expect(findWinLine(c, 8, 4, 2) !== null).toBe(true);
});

test("四连不算胜", () => {
  const b = createBoard();
  for (let x = 3; x <= 6; x++) b[idx(x, 5)] = 1;
  expect(findWinLine(b, 5, 5, 1)).toBe(null);
});

test("被对手隔断的连子不算胜", () => {
  const b = parse([
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    "....XXXOX......",
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
  ]);
  expect(findWinLine(b, 6, 5, 1)).toBe(null);
});

/* ------------------------------ AI ------------------------------ */

test("AI 直接成五", () => {
  const b = parse([
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    "...OOOO........",
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
  ]);
  const mv = findBestMove(b, 2, "normal")!;
  expect(mv !== null).toBe(true);
  const nb = b.slice();
  nb[idx(mv.x, mv.y)] = 2;
  expect(findWinLine(nb, mv.x, mv.y, 2) !== null).toBe(true);
});

test("AI 堵住唯一成五点", () => {
  const b = parse([
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    "..OXXXX........",
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
  ]);
  for (const level of ["normal", "hard"] as Difficulty[]) {
    const mv = findBestMove(b, 2, level)!;
    expect(`${level}:${mv.x},${mv.y}`).toBe(`${level}:7,7`);
  }
});

test("AI 不会漏掉自己的活四机会", () => {
  // 白棋三连且两端皆空，黑棋无威胁：应做出活四或直接成五
  const b = parse([
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    "...OOO.........",
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    ".....X.........",
    EMPTY,
    EMPTY,
  ]);
  const mv = findBestMove(b, 2, "hard")!;
  const nb = b.slice();
  nb[idx(mv.x, mv.y)] = 2;
  expect(longestRun(nb, 2) >= 4).toBe(true);
});

test("空棋盘落在天元", () => {
  const mv = findBestMove(createBoard(), 1, "hard")!;
  expect(`${mv.x},${mv.y}`).toBe("7,7");
});

test("AI 落子始终合法", () => {
  const b = createBoard();
  b[idx(7, 7)] = 1;
  b[idx(8, 8)] = 2;
  for (const level of ["easy", "normal", "hard"] as Difficulty[]) {
    const mv = findBestMove(b, 1, level)!;
    expect(b[idx(mv.x, mv.y)]).toBe(0);
    expect(mv.x >= 0 && mv.x < 15 && mv.y >= 0 && mv.y < 15).toBe(true);
  }
});

test("AI 不会堵自己的活路（开局第二手贴近对手）", () => {
  const b = createBoard();
  b[idx(7, 7)] = 1;
  const mv = findBestMove(b, 2, "normal")!;
  const dist = Math.max(Math.abs(mv.x - 7), Math.abs(mv.y - 7));
  expect(dist <= 2).toBe(true);
});

/* ---------------------------- 性能与自对弈 ---------------------------- */

test("hard 档单步耗时可控", () => {
  const b = createBoard();
  const seq: [number, number, Player][] = [
    [7, 7, 1], [8, 8, 2], [6, 6, 1], [8, 6, 2], [6, 8, 1], [9, 7, 2],
    [5, 7, 1], [7, 9, 2], [9, 9, 1], [7, 5, 2], [4, 7, 1], [10, 10, 2],
    [3, 7, 1], [9, 11, 2],
  ];
  for (const [x, y, p] of seq) b[idx(x, y)] = p;
  const t0 = Date.now();
  const mv = findBestMove(b, 1, "hard")!;
  const dt = Date.now() - t0;
  expect(mv !== null).toBe(true);
  // QuickJS 下留足余量；实际通常在 100~400ms
  expect(dt < 2000).toBe(true);
});
