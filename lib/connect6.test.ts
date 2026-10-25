import { expect, test } from "nsh/test";
import {
  C6_CELLS,
  C6_INITIAL_P1,
  C6_INITIAL_P2,
  C6_SIZE,
  c6AllMoves,
  c6LegalMoves,
  connect6Ai,
  createConnect6,
  moveConnect6,
  type C6State,
} from "./connect6";
import type { Player } from "./gomoku";

function position(
  ones: number[] = [],
  twos: number[] = [],
  turn: Player = 1,
): C6State {
  const board = new Array<number>(C6_CELLS).fill(0);
  for (const i of ones) board[i] = 1;
  for (const i of twos) board[i] = 2;
  return { board, moves: [], turn, result: null };
}

function lastCaptured(s: C6State | null): number[] {
  return s?.moves[s.moves.length - 1]?.captured ?? [];
}

test("六子冲使用 4×4 棋盘，双方各六子且黑先", () => {
  const s = createConnect6();
  expect(C6_SIZE).toBe(4);
  expect(C6_CELLS).toBe(16);
  expect(s.board.length).toBe(16);
  expect(s.turn).toBe(1);
  expect(s.board.filter((v) => v === 1).length).toBe(6);
  expect(s.board.filter((v) => v === 2).length).toBe(6);
  for (const i of C6_INITIAL_P1) expect(s.board[i]).toBe(1);
  for (const i of C6_INITIAL_P2) expect(s.board[i]).toBe(2);
});

test("普通走法只能沿横竖相邻空格移动", () => {
  const s = createConnect6();
  expect(c6LegalMoves(s, 8)).toEqual([9]);
  expect(c6LegalMoves(s, 13)).toEqual([9]);
  expect(c6LegalMoves(s, 12)).toEqual([]);
  expect(moveConnect6(s, 8, 9)).not.toBe(null);
  expect(moveConnect6(s, 8, 10)).toBe(null);
  expect(moveConnect6(s, 8, 12)).toBe(null);
  expect(moveConnect6(s, 8, 7)).toBe(null);
  expect(moveConnect6(s, 8, 8)).toBe(null);
  expect(moveConnect6(s, 9, 8)).toBe(null);
});

test("越界、非己方棋子和已结束局面不能走", () => {
  const s = createConnect6();
  expect(moveConnect6(s, -1, 9)).toBe(null);
  expect(moveConnect6(s, 8, 16)).toBe(null);
  expect(moveConnect6(s, 0, 5)).toBe(null);
  const ended: C6State = {
    ...s,
    result: { kind: "win", winner: 1, line: [], reason: "测试" },
  };
  expect(c6LegalMoves(ended, 8)).toEqual([]);
  expect(moveConnect6(ended, 8, 9)).toBe(null);
});

test("只剩一子时可以独飞，但不能越过棋子", () => {
  const open = position([0], [5, 10]);
  expect(c6LegalMoves(open, 0)).toEqual([1, 2, 3, 4, 8, 12]);
  const blocked = position([0], [1, 5, 10]);
  expect(c6LegalMoves(blocked, 0)).toEqual([4, 8, 12]);
  expect(moveConnect6(blocked, 0, 2)).toBe(null);
});

test("二打一吃与己方两子相邻的敌子", () => {
  const s = position([1, 4], [2, 6, 10]);
  const next = moveConnect6(s, 4, 0)!;
  expect(lastCaptured(next)).toEqual([2]);
  expect(next.board[2]).toBe(0);
  expect(next.turn).toBe(2);
  expect(next.result).toBe(null);
});

test("二打一也识别反向的敌-己-己", () => {
  const s = position([5, 8], [0, 10]);
  const next = moveConnect6(s, 5, 4)!;
  expect(lastCaptured(next)).toEqual([0]);
});

test("三己一排与三种错误相邻图形都不能吃子", () => {
  const three = position([0, 1, 2], [6, 10]);
  expect(lastCaptured(moveConnect6(three, 2, 3))).toEqual([]);

  const blockedDouble = position([1, 4], [3, 6, 7, 10]);
  expect(lastCaptured(moveConnect6(blockedDouble, 4, 5))).toEqual([]);

  const enemiesBothEnds = position([4, 5, 12], [3, 6, 10]);
  expect(lastCaptured(moveConnect6(enemiesBothEnds, 12, 8))).toEqual([]);

  const ownBehind = position([0, 3, 4], [2, 10]);
  expect(lastCaptured(moveConnect6(ownBehind, 4, 1))).toEqual([]);
});

test("夹吃己-敌-己且至少一端为空", () => {
  const s = position([0, 12], [4, 10]);
  const next = moveConnect6(s, 12, 8)!;
  expect(lastCaptured(next)).toEqual([4]);
  expect(next.board[4]).toBe(0);
});

test("夹吃两端都没有空位时不能吃", () => {
  const s = position([0, 4], [1, 3, 10]);
  expect(lastCaptured(moveConnect6(s, 4, 2))).toEqual([]);
});

test("独飞插入两敌之间触发挑吃，吃掉两端", () => {
  const s = position([5], [0, 2, 10]);
  const next = moveConnect6(s, 5, 1)!;
  expect(lastCaptured(next)).toEqual([0, 2]);
  expect(next.board[0]).toBe(0);
  expect(next.board[2]).toBe(0);
});

test("挑吃要求插入点至少一端为空", () => {
  const s = position([5], [0, 2, 3, 10]);
  expect(lastCaptured(moveConnect6(s, 5, 1))).toEqual([]);
});

test("单线二打二（双顶吃）吃掉相邻的两枚敌子", () => {
  const s = position([0, 5], [8, 12]);
  const next = moveConnect6(s, 5, 4)!;
  expect(lastCaptured(next)).toEqual([8, 12]);
  expect(next.board[8]).toBe(0);
  expect(next.board[12]).toBe(0);
});

test("同一步多方向吃子会去重合并", () => {
  const s = position([4, 6, 9], [7, 13]);
  const next = moveConnect6(s, 4, 5)!;
  expect(next).not.toBe(null);
  expect(lastCaptured(next)).toEqual([7, 13]);
});

test("把对方棋子减到一枚立即获胜", () => {
  const s = position([1, 4], [2, 10]);
  const next = moveConnect6(s, 4, 0)!;
  expect(next.result?.winner).toBe(1);
  expect(next.result?.reason).toBe("对方仅剩一子");
});

test("让对方无合法着法也立即获胜", () => {
  const s = position([1, 4, 5, 11, 14], [0, 15]);
  const next = moveConnect6(s, 5, 6)!;
  expect(next.result?.winner).toBe(1);
  expect(next.result?.reason).toBe("对方无棋可走");
});

test("AI 返回合法着法并能找到立即吃子", () => {
  const s = position([1, 4], [2, 10]);
  const choice = connect6Ai(s, "hell")!;
  expect(
    c6AllMoves(s).some(
      (m) => m.from === choice.from && m.to === choice.to,
    ),
  ).toBe(true);
  expect(choice).toEqual({ from: 4, to: 0 });
});

test("AI 在初始局面也有合法走法", () => {
  const s = createConnect6();
  const choice = connect6Ai(s, "normal");
  expect(choice).not.toBe(null);
  expect(moveConnect6(s, choice!.from, choice!.to)).not.toBe(null);
  expect(choice!.from).toBeGreaterThanOrEqual(0);
  expect(choice!.from).toBeLessThan(C6_CELLS);
});
