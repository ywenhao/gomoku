import { expect, test } from "nsh/test";
import {
  RECORDS_LIMIT,
  makeRecord,
  readRecords,
  recordMoveCount,
  recordNextPlayer,
  recordTitle,
  type StoredRecord,
} from "./records";

const GOMOKU_MOVES = [
  { x: 7, y: 7, p: 1 as const },
  { x: 7, y: 8, p: 2 as const },
  { x: 8, y: 8, p: 1 as const },
];

const GO_MOVES = [
  { x: 4, y: 4, p: 1 as const, pass: false },
  { x: 4, y: 5, p: 2 as const, pass: false },
  { x: -1, y: -1, p: 1 as const, pass: true },
];

function gomokuRecord(extra: Record<string, unknown> = {}) {
  return {
    id: "r-1",
    game: "gomoku",
    mode: "pve",
    level: "normal",
    moves: GOMOKU_MOVES,
    savedAt: 1000,
    ...extra,
  };
}

function goRecord(extra: Record<string, unknown> = {}) {
  return {
    id: "g-1",
    game: "go",
    mode: "aiai",
    level: "hard",
    goSize: 9,
    goMoves: GO_MOVES,
    savedAt: 2000,
    ...extra,
  };
}

test("makeRecord 会生成默认名称、补齐棋种字段并保留时间", () => {
  const gomoku = makeRecord({
    game: "gomoku",
    mode: "pvp",
    level: "easy",
    moves: GOMOKU_MOVES,
    result: "黑棋胜",
    savedAt: 1700000000000,
  });
  expect(gomoku.name).toContain("五子棋 · 简单 · 黑棋胜");
  expect(gomoku.mode).toBe("pvp");
  expect(gomoku.moves).toEqual(GOMOKU_MOVES);
  expect(gomoku.goMoves).toBe(undefined);
  expect(gomoku.goSize).toBe(undefined);
  expect(gomoku.savedAt).toBe(1700000000000);
  expect(gomoku.id.startsWith("1700000000000-")).toBe(true);

  const go = makeRecord({
    game: "go",
    mode: "aiai",
    level: "hell",
    goMoves: GO_MOVES,
  });
  expect(go.name).toContain("围棋 · 地狱");
  expect(go.goSize).toBe(19);
  expect(go.moves).toEqual([]);
  expect(go.goMoves).toEqual(GO_MOVES);
});

test("自定义名称会去掉首尾空格并截断", () => {
  const record = makeRecord({
    game: "gomoku",
    mode: "pve",
    level: "normal",
    moves: GOMOKU_MOVES,
    name: `  ${"长".repeat(80)}  `,
  });
  expect(record.name.length).toBe(60);
  expect(record.name.startsWith("长")).toBe(true);

  const blank = makeRecord({
    game: "gomoku",
    mode: "pve",
    level: "normal",
    moves: GOMOKU_MOVES,
    name: "   ",
    savedAt: 1000,
  });
  expect(blank.name).toContain("五子棋 · 普通");
});

test("空值、坏 JSON 与非数组都读成空棋谱库", () => {
  expect(readRecords(null)).toEqual([]);
  expect(readRecords("")).toEqual([]);
  expect(readRecords("not json")).toEqual([]);
  expect(readRecords("{}")).toEqual([]);
  expect(readRecords("42")).toEqual([]);
});

test("合法五子棋棋谱能完整读回，并补齐缺失设置", () => {
  const records = readRecords(
    JSON.stringify([
      gomokuRecord({
        name: "  让子局  ",
        result: "黑棋五连",
        mode: "online",
        level: "insane",
      }),
    ]),
  );
  expect(records.length).toBe(1);
  const record = records[0];
  expect(record.name).toBe("让子局");
  expect(record.game).toBe("gomoku");
  expect(record.mode).toBe("pve");
  expect(record.level).toBe("normal");
  expect(record.result).toBe("黑棋五连");
  expect(record.moves).toEqual(GOMOKU_MOVES);
  expect(recordMoveCount(record)).toBe(3);
  expect(recordNextPlayer(record)).toBe(2);
});

test("非法五子棋棋谱会被跳过，合法的仍然保留", () => {
  const records = readRecords(
    JSON.stringify([
      gomokuRecord({ id: "", moves: GOMOKU_MOVES }),
      gomokuRecord({ id: "empty", moves: [] }),
      gomokuRecord({ id: "out", moves: [{ x: 15, y: 0, p: 1 }] }),
      gomokuRecord({
        id: "dup",
        moves: [
          { x: 1, y: 1, p: 1 },
          { x: 1, y: 1, p: 2 },
        ],
      }),
      gomokuRecord({
        id: "order",
        moves: [{ x: 1, y: 1, p: 2 }],
      }),
      gomokuRecord({ id: "ok", savedAt: 3000 }),
    ]),
  );
  expect(records.map((r) => r.id)).toEqual(["ok"]);
});

test("合法围棋棋谱能读回，尺寸缺省 19 路，手数与轮次正确", () => {
  const records = readRecords(
    JSON.stringify([
      goRecord({
        goSize: undefined,
        name: "  人机大战  ",
        result: "黑棋 3.5 子胜",
      }),
    ]),
  );
  expect(records.length).toBe(1);
  const record = records[0];
  expect(record.game).toBe("go");
  expect(record.goSize).toBe(19);
  expect(record.name).toBe("人机大战");
  expect(record.result).toBe("黑棋 3.5 子胜");
  expect(record.moves).toEqual([]);
  expect(record.goMoves?.length).toBe(3);
  expect(recordMoveCount(record)).toBe(3);
  expect(recordNextPlayer(record)).toBe(2);
});

test("非法围棋棋谱会被跳过", () => {
  const records = readRecords(
    JSON.stringify([
      goRecord({ id: "empty", goMoves: [] }),
      goRecord({
        id: "out",
        goSize: 9,
        goMoves: [{ x: 9, y: 0, p: 1, pass: false }],
      }),
      goRecord({
        id: "occupied",
        goSize: 9,
        goMoves: [
          { x: 4, y: 4, p: 1, pass: false },
          { x: 4, y: 4, p: 2, pass: false },
        ],
      }),
      goRecord({
        id: "badp",
        goMoves: [{ x: 4, y: 4, p: 3, pass: false }],
      }),
      goRecord({ id: "ok", savedAt: 4000 }),
    ]),
  );
  expect(records.map((r) => r.id)).toEqual(["ok"]);
});

test("棋谱按保存时间倒序，并限制在最多 60 份", () => {
  const list = Array.from({ length: RECORDS_LIMIT + 5 }, (_, i) =>
    gomokuRecord({
      id: `r-${i}`,
      savedAt: i * 1000,
      moves: GOMOKU_MOVES,
    }),
  );
  const records = readRecords(JSON.stringify(list));
  expect(records.length).toBe(RECORDS_LIMIT);
  expect(records[0].id).toBe(`r-${RECORDS_LIMIT + 4}`);
  expect(records[1].id).toBe(`r-${RECORDS_LIMIT + 3}`);
  expect(records[RECORDS_LIMIT - 1].id).toBe("r-5");
});

test("recordTitle 会写清棋种、难度、结果与时间", () => {
  const title = recordTitle(
    "go",
    "hell",
    new Date(2026, 9, 24, 9, 5).getTime(),
    "白棋 2.5 子胜",
  );
  expect(title).toContain("围棋");
  expect(title).toContain("地狱");
  expect(title).toContain("白棋 2.5 子胜");
  expect(title).toContain("10-24 09:05");
});

test("recordNextPlayer 从最后一手推导下一手，空棋谱默认黑先", () => {
  const gomoku = {
    game: "gomoku",
    moves: GOMOKU_MOVES,
  } as unknown as StoredRecord;
  expect(recordNextPlayer(gomoku)).toBe(2);

  const go = {
    game: "go",
    goMoves: GO_MOVES,
  } as unknown as StoredRecord;
  expect(recordNextPlayer(go)).toBe(2);

  const empty = { game: "gomoku", moves: [] } as unknown as StoredRecord;
  expect(recordNextPlayer(empty)).toBe(1);
  expect(recordMoveCount(empty)).toBe(0);
});
