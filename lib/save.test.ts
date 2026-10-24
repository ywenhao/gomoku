import { expect, test } from "nsh/test";
import { readSavedGame, savedTurn, type SavedGame } from "./save";

const moves = [
  { x: 7, y: 7, p: 1 as const },
  { x: 7, y: 8, p: 2 as const },
  { x: 8, y: 8, p: 1 as const },
];

const saved = (extra: Record<string, unknown> = {}) => ({
  moves,
  mode: "pvp",
  level: "hard",
  limitOn: false,
  leftMs: 12000,
  undos: 2,
  timeouts: 1,
  startedAt: 1000,
  savedAt: 2000,
  ...extra,
});

test("合法存档能读出全部字段，并由手数推出轮到谁", () => {
  const game = readSavedGame(JSON.stringify(saved()));
  expect(game).not.toBe(null);
  if (!game) return;

  expect(game.moves).toEqual(moves);
  expect(game.mode).toBe("pvp");
  expect(game.level).toBe("hard");
  expect(game.limitOn).toBe(false);
  expect(game.leftMs).toBe(12000);
  expect(game.undos).toBe(2);
  expect(game.timeouts).toBe(1);
  expect(game.startedAt).toBe(1000);
  expect(game.savedAt).toBe(2000);
  expect(savedTurn(game)).toBe(2);
});

test("空档、坏 JSON、空棋局都当没有存档", () => {
  expect(readSavedGame(null)).toBe(null);
  expect(readSavedGame("")).toBe(null);
  expect(readSavedGame("not json")).toBe(null);
  expect(readSavedGame(JSON.stringify(saved({ moves: [] })))).toBe(null);
});

test("越界、重复落子和黑白顺序不对的存档会被拒绝", () => {
  expect(
    readSavedGame(
      JSON.stringify(saved({ moves: [{ x: 15, y: 0, p: 1 }] })),
    ),
  ).toBe(null);
  expect(
    readSavedGame(
      JSON.stringify(
        saved({
          moves: [
            { x: 1, y: 1, p: 1 },
            { x: 1, y: 1, p: 2 },
          ],
        }),
      ),
    ),
  ).toBe(null);
  expect(
    readSavedGame(
      JSON.stringify(saved({ moves: [{ x: 1, y: 1, p: 2 }] })),
    ),
  ).toBe(null);
});

test("已经分出胜负的对局不会被当成「继续游戏」", () => {
  const finished = [
    { x: 3, y: 7, p: 1 },
    { x: 0, y: 0, p: 2 },
    { x: 4, y: 7, p: 1 },
    { x: 0, y: 1, p: 2 },
    { x: 5, y: 7, p: 1 },
    { x: 0, y: 2, p: 2 },
    { x: 6, y: 7, p: 1 },
    { x: 0, y: 3, p: 2 },
    { x: 7, y: 7, p: 1 },
  ];
  expect(readSavedGame(JSON.stringify(saved({ moves: finished })))).toBe(null);
});

test("非法设置回退到默认值，倒计时限制在 0–30 秒", () => {
  const game = readSavedGame(
    JSON.stringify(
      saved({
        mode: "online",
        level: "insane",
        limitOn: "yes",
        leftMs: 999999,
        undos: -3,
        timeouts: 1.5,
      }),
    ),
  );
  expect(game).not.toBe(null);
  if (!game) return;
  expect(game.mode).toBe("pve");
  expect(game.level).toBe("normal");
  expect(game.limitOn).toBe(true);
  expect(game.leftMs).toBe(30000);
  expect(game.undos).toBe(0);
  expect(game.timeouts).toBe(0);

  const zero = readSavedGame(JSON.stringify(saved({ leftMs: -1 })));
  expect(zero!.leftMs).toBe(0);
});
