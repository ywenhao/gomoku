import { expect, test } from "nsh/test";
import {
  createJunqi,
  junqiMoves,
  moveJunqi,
  validDeployment,
  JUNQI_CAMPS,
} from "./junqi";
test("军棋默认布阵合法且行营空，大本营禁动", () => {
  const s = createJunqi();
  expect(validDeployment(s.board, 1)).toBe(true);
  expect(validDeployment(s.board, 2)).toBe(true);
  expect(JUNQI_CAMPS.every((i) => s.board[i] === 0)).toBe(true);
  expect(junqiMoves(s, 56).length).toBe(0);
});
test("军棋工兵排雷、炸弹同归于尽与夺旗", () => {
  const base = createJunqi();
  const board = new Array<number>(60).fill(0);
  board[30] = 1;
  board[25] = -11;
  board[1] = -12;
  board[58] = 12;
  let s = { ...base, board };
  let n = moveJunqi(s, 30, 25)!;
  expect(n.board[25]).toBe(1);
  s = { ...base, board: board.slice() };
  s.board[30] = 9;
  n = moveJunqi(s, 30, 25)!;
  expect(n.board[25]).toBe(-11);
  expect(n.board[30]).toBe(0);
  s = { ...base, board: board.slice() };
  s.board[30] = 10;
  n = moveJunqi(s, 30, 25)!;
  expect(n.board[25]).toBe(0);
  s = { ...base, board: new Array<number>(60).fill(0) };
  s.board[6] = 4;
  s.board[1] = -12;
  s.board[58] = 12;
  expect(moveJunqi(s, 6, 1)?.result?.winner).toBe(1);
});
test("军棋行营保护，敌方暗子不影响AI选法的合法范围", () => {
  const s = createJunqi();
  s.board[36] = -2;
  expect(s.board.some((p, i) => p > 0 && junqiMoves(s, i).includes(36))).toBe(
    false,
  );
  expect(junqiMoves(s, -1).length).toBe(0);
});
