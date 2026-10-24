import { expect, test } from "nsh/test";
import {
  createLudo,
  rollLudo,
  moveLudo,
  ludoLegal,
  ludoPosition,
  CHECKER_HOLES,
  CHECKER_CAMPS,
  CHECKER_PLAYER_COUNTS,
  createCheckers,
  checkerMoves,
  moveCheckers,
  checkerCampIndices,
  isCheckerPlayers,
  oppositeCheckerCamp,
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
  expect(n.result).toBe(null);
  expect(moveCheckers(s, from, from)).toBe(null);
});

test("跳棋支持2/3/4/6人，玩家1在下方并按人数轮转", () => {
  const averageR = (camp: number) =>
    CHECKER_CAMPS[camp].reduce((sum, i) => sum + CHECKER_HOLES[i].r, 0) /
    CHECKER_CAMPS[camp].length;
  expect(averageR(3)).toBeGreaterThan(averageR(0));
  expect(oppositeCheckerCamp(3)).toBe(0);
  expect(oppositeCheckerCamp(5)).toBe(2);
  expect(oppositeCheckerCamp(4)).toBe(1);
  expect(isCheckerPlayers(4)).toBe(true);
  expect(isCheckerPlayers(5)).toBe(false);

  for (const players of CHECKER_PLAYER_COUNTS) {
    const start = createCheckers(players);
    expect(start.players).toBe(players);
    expect(checkerCampIndices(players)[0]).toBe(3);
    for (let player = 1; player <= players; player++)
      expect(start.board.filter((piece) => piece === player).length).toBe(10);

    let state = start;
    for (let player = 1; player <= players; player++) {
      expect(state.turn).toBe(player);
      const from = state.board.findIndex(
        (piece, i) => piece === player && checkerMoves(state, i).length > 0,
      );
      expect(from).toBeGreaterThanOrEqual(0);
      const to = checkerMoves(state, from)[0];
      state = moveCheckers(state, from, to)!;
    }
    expect(state.turn).toBe(1);
    expect(state.ply).toBe(players);
  }
});
