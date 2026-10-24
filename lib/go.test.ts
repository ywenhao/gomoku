import { expect, test } from "nsh/test";
import {
  GO_KOMI,
  createGoBoard,
  goGroup,
  goStateFromMoves,
  playGo,
  scoreGo,
  type GoMove,
  type GoSize,
} from "./go";

const at = (x: number, y: number, size: number) => y * size + x;

test("提子：四面围住的白棋被提掉", () => {
  const size = 5;
  const b = createGoBoard(size as GoSize);
  // 白子在天元，黑棋三面围住，最后一手落在左边
  b[at(2, 2, size)] = 2;
  b[at(2, 1, size)] = 1;
  b[at(2, 3, size)] = 1;
  b[at(3, 2, size)] = 1;
  const r = playGo(b, size, 1, 2, 1);
  expect(r.ok).toBe(true);
  expect(r.captured.length).toBe(1);
  expect(r.board[at(2, 2, size)]).toBe(0);
  expect(r.board[at(1, 2, size)]).toBe(1);
});

test("自杀手非法，边界也算气", () => {
  const size = 5;
  const b = createGoBoard(size as GoSize);
  b[at(1, 0, size)] = 1;
  b[at(0, 1, size)] = 1;
  const r = playGo(b, size, 0, 0, 2);
  expect(r.ok).toBe(false);
  expect(r.reason).toBe("suicide");
});

test("不能下在已有棋子的交叉点", () => {
  const size = 5;
  const b = createGoBoard(size as GoSize);
  b[at(2, 2, size)] = 1;
  const r = playGo(b, size, 2, 2, 2);
  expect(r.ok).toBe(false);
  expect(r.reason).toBe("occupied");
});

test("打劫：提一子后不能立即回提", () => {
  const size = 5;
  const b = createGoBoard(size as GoSize);
  // 劫形：白 (1,2) 只有 (2,2) 一口气，黑提后自身也只有一口气
  b[at(1, 1, size)] = 1;
  b[at(2, 1, size)] = 2;
  b[at(0, 2, size)] = 1;
  b[at(1, 2, size)] = 2;
  b[at(3, 2, size)] = 2;
  b[at(1, 3, size)] = 1;
  b[at(2, 3, size)] = 2;
  // 黑提白 (1,2)
  const first = playGo(b, size, 2, 2, 1);
  expect(first.ok).toBe(true);
  expect(first.captured.length).toBe(1);
  expect(first.ko).toBe(at(1, 2, size));
  // 白立即回提非法
  const back = playGo(first.board, size, 1, 2, 2, first.ko);
  expect(back.ok).toBe(false);
  expect(back.reason).toBe("ko");
});

test("数子：围空 + 棋子，白棋贴 7.5 子", () => {
  const size = 5;
  const b = createGoBoard(size as GoSize);
  // 黑棋一条竖线，把左边 2 列围成黑空
  for (let y = 0; y < size; y++) b[at(2, y, size)] = 1;
  // 白棋一条竖线，把右边 2 列围成白空
  for (let y = 0; y < size; y++) b[at(4, y, size)] = 2;
  const s = scoreGo(b, size);
  expect(s.blackStones).toBe(5);
  expect(s.whiteStones).toBe(5);
  expect(s.blackTerritory).toBe(10);
  expect(s.whiteTerritory).toBe(0); // 第 3 列被黑白夹住，是单官
  expect(s.blackArea).toBe(15);
  expect(s.whiteArea).toBe(5 + GO_KOMI);
  expect(s.winner).toBe(1);
});

test("标记死子后按空点计入对方地盘", () => {
  const size = 5;
  const b = createGoBoard(size as GoSize);
  for (let y = 0; y < size; y++) b[at(0, y, size)] = 1;
  for (let x = 1; x < size; x++) b[at(x, 0, size)] = 2;
  b[at(1, 1, size)] = 2;
  const withDead = scoreGo(b, size, [at(1, 1, size)]);
  const alive = scoreGo(b, size);
  expect(withDead.whiteStones).toBe(alive.whiteStones - 1);
  expect(withDead.blackArea).toBeGreaterThanOrEqual(alive.blackArea);
});

test("棋谱重建会拒绝非法手", () => {
  const size = 9 as GoSize;
  const moves: GoMove[] = [
    { x: 2, y: 2, p: 1, pass: false },
    { x: 3, y: 3, p: 2, pass: false },
    { x: 2, y: 2, p: 1, pass: false },
  ];
  expect(goStateFromMoves(size, moves)).toBe(null);
  const ok = goStateFromMoves(size, moves.slice(0, 2));
  expect(ok?.moves.length).toBe(2);
  expect(ok?.board[at(2, 2, size)]).toBe(1);
});

test("连续虚手与棋块气数", () => {
  const size = 9;
  const b = createGoBoard(size as GoSize);
  b[at(4, 4, size)] = 1;
  b[at(4, 5, size)] = 1;
  const g = goGroup(b, size, at(4, 4, size))!;
  expect(g.stones.length).toBe(2);
  expect(g.liberties.length).toBe(6);

  const state = goStateFromMoves(size as GoSize, [
    { x: -1, y: -1, p: 1, pass: true },
    { x: -1, y: -1, p: 2, pass: true },
  ]);
  expect(state?.passes).toBe(2);
});
