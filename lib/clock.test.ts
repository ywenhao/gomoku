import { expect, test } from "nsh/test";
import {
  TIME_CONTROLS,
  clockAfterMove,
  createClock,
  defaultTimeControl,
  findTimeControl,
  formatClock,
  isFlagDown,
  remainingMs,
  tickClock,
} from "./clock";
import { GO_SIZES } from "./go";

const GO = findTimeControl("go", "go-5-3x30"); // 5 分 + 3×30 秒
const CHESS = findTimeControl("chess", "chess-15-10"); // 15 分 + 10 秒
const CLASSIC = findTimeControl("chess", "chess-90-30"); // 90 分 + 30 秒，40 步加 30 分

test("每个棋种都有可用的时间规则，默认值稳定", () => {
  for (const kind of Object.keys(
    TIME_CONTROLS,
  ) as (keyof typeof TIME_CONTROLS)[]) {
    expect(TIME_CONTROLS[kind].length > 0).toBe(true);
    const def = defaultTimeControl(kind);
    expect(def.mainMs > 0).toBe(true);
    expect(findTimeControl(kind, "missing").id).toBe(def.id);
  }
  expect(defaultTimeControl("go").id).toBe("go-5-3x30");
  expect(defaultTimeControl("chess").id).toBe("chess-15-10");
  expect(defaultTimeControl("xiangqi").mainMs).toBe(30 * 60_000);
});

test("加秒制：落子扣除本手用时并加秒，然后换边", () => {
  const start = createClock(CHESS, 1, 1_000);
  expect(remainingMs(start.p1)).toBe(15 * 60_000);
  const moved = clockAfterMove(start, 1, 1_000 + 4_000);
  expect(moved.timeout).toBe(null);
  expect(remainingMs(moved.clock.p1)).toBe(15 * 60_000 - 4_000 + 10_000);
  expect(remainingMs(moved.clock.p2)).toBe(15 * 60_000);
  expect(moved.clock.turn).toBe(2);
  expect(moved.clock.moveNo).toBe(1);
});

test("加秒制：主时间耗尽即判负，且不再加秒", () => {
  const start = createClock(CHESS, 1, 1_000);
  const late = start.lastAt + 15 * 60_000 + 1;
  const result = clockAfterMove(start, 1, late);
  expect(result.timeout).toBe(1);
  expect(result.clock.p1.mainMs).toBe(0);
});

test("40 步加时：双方各加 30 分钟，只加一次", () => {
  let clock = createClock(CLASSIC, 1, 0);
  let now = 0;
  for (let i = 0; i < 80; i++) {
    now += 1_000;
    const res = clockAfterMove(clock, clock.turn, now);
    expect(res.timeout).toBe(null);
    clock = res.clock;
  }
  const after40 = clock.p1.mainMs;
  // 每方 40 手各加 30 秒，再加 30 分钟
  expect(after40).toBe(90 * 60_000 - 40_000 + 40 * 30_000 + 30 * 60_000);
  for (let i = 0; i < 10; i++) {
    now += 1_000;
    clock = clockAfterMove(clock, clock.turn, now).clock;
  }
  expect(clock.p1.mainMs).toBe(after40 - 5_000 + 5 * 30_000);
});

test("读秒：主时间用完后进入 30 秒读秒，读秒用完扣一期", () => {
  const start = createClock(GO, 1, 0);
  const first = tickClock(start, 5 * 60_000 + 10_000);
  expect(first.timeout).toBe(null);
  expect(first.clock.p1.mainMs).toBe(0);
  expect(first.clock.p1.periodMs).toBe(20_000);
  expect(first.clock.p1.periods).toBe(3);
  expect(formatClock(first.clock.p1, GO)).toBe("0:20  ×3");

  const second = tickClock(first.clock, 5 * 60_000 + 40_000);
  expect(second.clock.p1.periodMs).toBe(20_000);
  expect(second.clock.p1.periods).toBe(2);
  expect(second.timeout).toBe(null);

  const third = tickClock(second.clock, 5 * 60_000 + 70_000);
  expect(third.clock.p1.periodMs).toBe(20_000);
  expect(third.clock.p1.periods).toBe(1);

  const over = tickClock(third.clock, 5 * 60_000 + 100_000);
  expect(over.timeout).toBe(1);
  expect(isFlagDown(over.clock.p1)).toBe(true);
});

test("读秒：落子后读秒期重置，但仍保留剩余期数", () => {
  const start = createClock(GO, 1, 0);
  const ticked = tickClock(start, 5 * 60_000 + 12_000).clock;
  const moved = clockAfterMove(ticked, 1, 5 * 60_000 + 15_000);
  expect(moved.clock.p1.periodMs).toBe(30_000);
  expect(moved.clock.p1.periods).toBe(3);
  expect(moved.clock.turn).toBe(2);
});

test("读秒：主时间未用完时落子不消耗读秒", () => {
  const start = createClock(GO, 1, 0);
  const moved = clockAfterMove(start, 1, 10_000);
  expect(moved.clock.p1.periodMs).toBe(0);
  expect(moved.clock.p1.periods).toBe(3);
  expect(moved.clock.p1.mainMs).toBe(5 * 60_000 - 10_000);
});

test("休闲计时：每次换边重置为 30 秒，超时判超时方", () => {
  const control = defaultTimeControl("gomoku");
  const start = createClock(control, 1, 0);
  const moved = clockAfterMove(start, 1, 7_000);
  expect(moved.clock.p1.mainMs).toBe(23_000);
  expect(moved.clock.p2.mainMs).toBe(30_000);
  expect(moved.clock.turn).toBe(2);
  const over = tickClock(moved.clock, 7_000 + 30_001);
  expect(over.timeout).toBe(2);
});

test("格式化与紧迫提示", () => {
  const start = createClock(CHESS, 1, 0);
  expect(formatClock(start.p1, CHESS)).toBe("15:00");
  const low = tickClock(start, 14 * 60_000 + 55_000).clock;
  expect(formatClock(low.p1, CHESS)).toBe("0:05");
  expect(isFlagDown(low.p1)).toBe(false);
});
