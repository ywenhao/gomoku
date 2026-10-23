import { expect, test } from "nsh/test";
import {
  HISTORY_LIMIT,
  MOVE_SECONDS,
  SPEED_TARGET,
  TIMEOUT_PENALTY,
  UNDO_PENALTY,
  formatDuration,
  formatStamp,
  outcomeLabel,
  scoreGame,
  type Facts,
} from "./score";

const facts = (over: Partial<Facts> = {}): Facts => ({
  outcome: "win",
  level: "normal",
  moves: 40,
  seconds: 60,
  undos: 0,
  timeouts: 0,
  streak: 1,
  ...over,
});

test("规则常量", () => {
  expect(MOVE_SECONDS).toBe(30);
  expect(UNDO_PENALTY).toBe(15);
  expect(TIMEOUT_PENALTY).toBe(10);
  expect(SPEED_TARGET).toBe(120);
  expect(HISTORY_LIMIT).toBe(40);
});

test("胜利：基础分 + 速度 + 效率 + 连胜", () => {
  const b = scoreGame(facts({ level: "hard", moves: 30, seconds: 40, streak: 3 }));
  // 300 + (120-40)/120*120 + (55-30)*3 + min(50, 2*15)
  expect(b.total).toBe(300 + 80 + 75 + 30);
  expect(b.stars).toBe(3);
  expect(b.lines.length).toBe(4);
});

test("速度与效率有上限，用时过长不给速度分", () => {
  const slow = scoreGame(facts({ moves: 120, seconds: 600 }));
  // 只拿到胜利基础分：180
  expect(slow.total).toBe(180);
  expect(slow.stars).toBe(2);

  const fast = scoreGame(facts({ moves: 1, seconds: 0 }));
  // 180 + 120(封顶) + 90(封顶)
  expect(fast.total).toBe(180 + 120 + 90);
  expect(fast.stars).toBe(3);
});

test("悔棋与超时按次扣分，星级降为 1", () => {
  const b = scoreGame(facts({ undos: 2, timeouts: 1 }));
  // 180 + 60 + 45 - 30 - 10
  expect(b.total).toBe(180 + 60 + 45 - UNDO_PENALTY * 2 - TIMEOUT_PENALTY);
  expect(b.stars).toBe(1);
  const labels = b.lines.map((l) => l.label);
  expect(labels).toContain("悔棋 ×2");
  expect(labels).toContain("超时 ×1");
});

test("落败为负分，和棋给小额分，都不给星", () => {
  expect(scoreGame(facts({ outcome: "loss" })).total).toBe(-60);
  expect(scoreGame(facts({ outcome: "loss" })).stars).toBe(0);
  expect(scoreGame(facts({ outcome: "draw" })).total).toBe(30);
  expect(scoreGame(facts({ outcome: "draw" })).stars).toBe(0);
});

test("连胜只在 2 连胜起加分，且封顶 50", () => {
  expect(scoreGame(facts({ streak: 1 })).lines.some((l) => l.label.startsWith("连胜"))).toBe(false);
  expect(scoreGame(facts({ streak: 2 })).lines.find((l) => l.label.startsWith("连胜"))!.value).toBe(15);
  expect(scoreGame(facts({ streak: 9 })).lines.find((l) => l.label.startsWith("连胜"))!.value).toBe(50);
});

test("难度决定基础分", () => {
  const base = (level: Facts["level"]) =>
    scoreGame(facts({ level, moves: 120, seconds: 600, streak: 1 })).total;
  expect(base("easy")).toBe(100);
  expect(base("normal")).toBe(180);
  expect(base("hard")).toBe(300);
});

test("文案与格式化", () => {
  expect(outcomeLabel("win")).toBe("胜利");
  expect(outcomeLabel("loss")).toBe("惜败");
  expect(outcomeLabel("draw")).toBe("和棋");

  expect(formatDuration(0)).toBe("0:00");
  expect(formatDuration(7)).toBe("0:07");
  expect(formatDuration(67)).toBe("1:07");
  expect(formatDuration(125)).toBe("2:05");

  expect(formatStamp(new Date(2026, 0, 5, 9, 4).getTime())).toBe("01-05 09:04");
});
