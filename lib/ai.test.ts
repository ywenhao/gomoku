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

/** 某方下一手能直接成五的落点数量；≥2 即活四/双四。 */
function winningSpots(board: readonly number[], p: Player): number {
  const b = board.slice();
  let n = 0;
  for (let i = 0; i < b.length; i++) {
    if (b[i] !== 0) continue;
    const x = i % 15;
    const y = (i - x) / 15;
    b[i] = p;
    if (findWinLine(b, x, y, p) !== null) n++;
    b[i] = 0;
  }
  return n;
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
  for (const level of ["normal", "hard", "hell"] as Difficulty[]) {
    const mv = findBestMove(b, 2, level, {
      deadlineMs: 300,
      maxNodes: 6000,
    })!;
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
  for (const level of ["hard", "hell"] as Difficulty[]) {
    const mv = findBestMove(b, 2, level, {
      deadlineMs: 300,
      maxNodes: 6000,
    })!;
    const nb = b.slice();
    nb[idx(mv.x, mv.y)] = 2;
    expect(longestRun(nb, 2) >= 4).toBe(true);
    expect(winningSpots(nb, 2) >= 2).toBe(true);
  }
});

test("AI 会封堵对手的活三，不让它变成活四", () => {
  const b = parse([
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    "....XXX........",
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    "..O............",
    EMPTY,
  ]);
  for (const level of ["hard", "hell"] as Difficulty[]) {
    const mv = findBestMove(b, 2, level, {
      deadlineMs: 400,
      maxNodes: 6000,
    })!;
    expect(mv.y).toBe(7);
    expect(`${level}:${mv.x === 3 || mv.x === 7}`).toBe(`${level}:true`);
  }
});

test("AI 能识别并防住对手的双四", () => {
  // 黑棋横三 + 竖三：再下 (8,7) 会同时在横线和竖线做成两个四
  const board = createBoard();
  for (const x of [5, 6, 7]) board[idx(x, 7)] = 1;
  for (const y of [3, 4, 5]) board[idx(8, y)] = 1;
  // 白棋封住左端和下端，避免这两条线本来就是活四
  board[idx(4, 7)] = 2;
  board[idx(8, 2)] = 2;
  board[idx(0, 0)] = 2;

  for (const level of ["hard", "hell"] as Difficulty[]) {
    const mv = findBestMove(board, 2, level, {
      deadlineMs: 400,
      maxNodes: 6000,
    })!;
    // 只有占住双四的交叉点（或先堵住其中一条线）才算有效防守
    const safe =
      (mv.x === 8 && mv.y === 7) ||
      (mv.x === 8 && mv.y === 6) ||
      (mv.x === 9 && mv.y === 7);
    expect(`${level}:${safe}`).toBe(`${level}:true`);
  }
});

test("地狱档会拆掉对手的连续冲四（VCF）", () => {
  // 黑棋先下 (8,7)：横线冲四逼白棋堵 (9,7)，随后 (8,6) 做成活四。
  // 白棋必须提前占住 (8,7) 或 (8,6)，光堵 (9,7) 来不及。
  const board = createBoard();
  for (const x of [5, 6, 7]) board[idx(x, 7)] = 1;
  for (const y of [4, 5]) board[idx(8, y)] = 1;
  board[idx(4, 7)] = 2;
  board[idx(0, 0)] = 2;

  const mv = findBestMove(board, 2, "hell", {
    deadlineMs: 700,
    maxNodes: 10000,
  })!;
  const safe = (mv.x === 8 && mv.y === 7) || (mv.x === 8 && mv.y === 6);
  expect(`hell:${safe}`).toBe("hell:true");
});

test("空棋盘落在天元", () => {
  const mv = findBestMove(createBoard(), 1, "hard")!;
  expect(`${mv.x},${mv.y}`).toBe("7,7");
});

test("AI 落子始终合法", () => {
  const b = createBoard();
  b[idx(7, 7)] = 1;
  b[idx(8, 8)] = 2;
  for (const level of ["easy", "normal", "hard", "hell"] as Difficulty[]) {
    const mv = findBestMove(b, 1, level, {
      deadlineMs: 200,
      maxNodes: 3000,
    })!;
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

test("hell 档在限定预算内返回合法落子", () => {
  const b = createBoard();
  const seq: [number, number, Player][] = [
    [7, 7, 1], [7, 8, 2], [6, 7, 1], [8, 8, 2], [8, 7, 1], [6, 8, 2],
    [5, 6, 1], [9, 9, 2], [9, 6, 1], [5, 8, 2], [4, 7, 1], [10, 7, 2],
    [6, 5, 1], [8, 10, 2],
  ];
  for (const [x, y, p] of seq) b[idx(x, y)] = p;

  const t0 = Date.now();
  const mv = findBestMove(b, 1, "hell", { deadlineMs: 500, maxNodes: 8000 })!;
  const dt = Date.now() - t0;
  expect(mv !== null).toBe(true);
  expect(b[idx(mv.x, mv.y)]).toBe(0);
  // 单次调用必须明显低于 QuickJS 约 2s 的执行上限
  expect(dt < 1900).toBe(true);
});
