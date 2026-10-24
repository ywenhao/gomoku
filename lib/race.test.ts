import { expect, test } from "nsh/test";
import {
  createLudo,
  rollLudo,
  moveLudo,
  ludoLegal,
  ludoPosition,
  CHECKER_HOLES,
  CHECKER_CAMPS,
  createCheckers,
  checkerMoves,
  moveCheckers,
} from "./race";
test("飞行棋6起飞，无可走飞机自动过；骰子与三连6", () => {
  const s = createLudo();
  expect(rollLudo(s, 2)?.turn).toBe(2);
  expect(rollLudo(s, 7)).toBe(null);
  let n = rollLudo(s, 6)!;
  expect(ludoLegal(n).length).toBe(4);
  n = moveLudo(n, 0)!;
  expect(n.turn).toBe(1);
  expect(n.planes[0][0]).toBe(0);
  n = rollLudo(n, 6)!;
  n = moveLudo(n, 1)!;
  n = rollLudo(n, 6)!;
  expect(n.turn).toBe(2);
  expect(n.die).toBe(0);
});
test("飞行棋终点折返、撞机与最后一机胜利", () => {
  const s = createLudo();
  s.planes[0] = [55, 57, 57, 57];
  s.die = 4;
  expect(moveLudo(s, 0)?.planes[0][0]).toBe(55);
  s.die = 2;
  expect(moveLudo(s, 0)?.result?.winner).toBe(1);
  const crash = createLudo();
  crash.planes[0][0] = 7;
  crash.planes[1][0] = 47;
  crash.die = 1;
  expect(ludoPosition(1, 8)).toBe(ludoPosition(2, 47));
  expect(moveLudo(crash, 0)?.planes[1][0]).toBe(-1);
});
test("跳棋星盘121孔、双方10子、连跳不吃子", () => {
  expect(CHECKER_HOLES.length).toBe(121);
  expect(new Set(CHECKER_HOLES.map((h) => `${h.q},${h.r}`)).size).toBe(121);
  expect(CHECKER_CAMPS.every((c) => c.length === 10)).toBe(true);
  const s = createCheckers();
  expect(s.board.filter((x) => x === 1).length).toBe(10);
  const from = s.board.findIndex(
      (p, i) => p === 1 && checkerMoves(s, i).length > 0,
    ),
    to = checkerMoves(s, from)[0];
  const n = moveCheckers(s, from, to)!;
  expect(n.board.filter((x) => x === 1).length).toBe(10);
  expect(n.board.filter((x) => x === 2).length).toBe(10);
  expect(n.turn).toBe(2);
  expect(moveCheckers(s, from, from)).toBe(null);
});
