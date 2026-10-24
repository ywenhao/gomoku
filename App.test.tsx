import { expect, open, test } from "nsh/test";

const has = (texts: string[], part: string) => texts.some((t) => t.includes(part));

/** 干净存档开局，避免上一次测试留下的分数/模式影响断言 */
const fresh = (extra: Record<string, unknown> = {}) =>
  open("./App.tsx", { storage: {}, ...extra });

/** 打开菜单 → 切到双人 → 关掉菜单 */
async function toPvp(app: Awaited<ReturnType<typeof open>>) {
  await app.press("id:open-menu");
  await app.press("id:seg-pvp");
  await app.press("id:menu-close");
  await app.waitUntil(() => !app.shows("id:menu-close"));
}

test("首屏渲染正常", async () => {
  const app = await fresh();
  const texts = app.texts();
  expect(texts).toContain("五子棋");
  expect(texts).toContain("轮到你落子");
  expect(has(texts, "0 手")).toBe(true);
  expect(has(texts, "人机 · 普通")).toBe(true);
  expect(app.shows("id:cell-7-7")).toBe(true);
  expect(app.shows("id:cell-0-0")).toBe(true);
  expect(app.shows("id:cell-14-14")).toBe(true);
  expect(app.shows("id:timer-text")).toBe(true);
});

test("落子后 AI 会应手", async () => {
  const app = await fresh();
  await app.press("id:cell-7-7");
  await app.waitUntil(() => has(app.texts(), "2 手"), { timeout: 8000 });
  expect(app.texts()).toContain("轮到你落子");
});

test("悔棋回到开局", async () => {
  const app = await fresh();
  await app.press("id:cell-7-7");
  await app.waitUntil(() => has(app.texts(), "2 手"), { timeout: 8000 });
  await app.press("id:undo");
  await app.waitUntil(() => has(app.texts(), "0 手"), { timeout: 3000 });
  expect(app.texts()).toContain("轮到你落子");
  // 悔棋会给出扣分提示
  expect(has(app.texts(), "悔棋 −15 分")).toBe(true);
});

test("双人对战五连判胜，结算浮层可重开", async () => {
  const app = await fresh();
  await toPvp(app);
  const seq = [
    "3-7",
    "0-0",
    "4-7",
    "0-1",
    "5-7",
    "0-2",
    "6-7",
    "0-3",
    "7-7",
  ];
  for (const cell of seq) await app.press(`id:cell-${cell}`);

  const texts = app.texts();
  expect(texts).toContain("黑棋获胜");
  expect(has(texts, "9 手")).toBe(true);
  expect(has(texts, "本地双人对局，不计入积分")).toBe(true);
  expect(app.shows("id:result-restart")).toBe(true);

  await app.press("id:result-restart");
  await app.waitUntil(() => has(app.texts(), "0 手"), { timeout: 3000 });
  expect(app.texts()).toContain("黑棋落子");
});

test("结算浮层可以收起，棋盘保留终局", async () => {
  const app = await fresh();
  await toPvp(app);
  for (const c of ["3-7", "0-0", "4-7", "0-1", "5-7", "0-2", "6-7", "0-3", "7-7"]) {
    await app.press(`id:cell-${c}`);
  }
  await app.press("id:result-close");
  await app.waitUntil(() => !app.shows("id:result-close"));
  expect(app.shows("id:stone-7-7-b")).toBe(true);
  // 终局后不能悔棋
  expect(app.enabled("id:undo")).toBe(false);
});

test("已占用的格子不能再落子", async () => {
  const app = await fresh();
  await toPvp(app);
  await app.press("id:cell-5-5");
  await app.press("id:cell-5-5");
  await app.press("id:cell-5-5");
  expect(has(app.texts(), "1 手")).toBe(true);
});

test("切换难度不会清空棋局", async () => {
  const app = await fresh();
  await app.press("id:cell-7-7");
  await app.waitUntil(() => has(app.texts(), "2 手"), { timeout: 8000 });
  await app.press("id:open-menu");
  await app.press("id:seg-hard");
  await app.press("id:menu-close");
  await app.waitUntil(() => !app.shows("id:menu-close"));
  expect(has(app.texts(), "2 手")).toBe(true);
  expect(has(app.texts(), "人机 · 困难")).toBe(true);
});

test("底部重新开始清空棋盘", async () => {
  const app = await fresh();
  await app.press("id:cell-7-7");
  await app.waitUntil(() => has(app.texts(), "2 手"), { timeout: 8000 });
  await app.press("id:restart");
  await app.waitUntil(() => has(app.texts(), "0 手"), { timeout: 3000 });
});

test("棋子落在被点击的交叉点上", async () => {
  const app = await fresh();
  await toPvp(app);
  await app.press("id:cell-7-7");
  expect(app.shows("id:stone-7-7-b")).toBe(true);
  expect(app.shows("id:stone-0-0-b")).toBe(false);
  await app.press("id:cell-0-0");
  expect(app.shows("id:stone-0-0-w")).toBe(true);
  await app.press("id:cell-14-14");
  expect(app.shows("id:stone-14-14-b")).toBe(true);
});

test("AI 不会覆盖已有棋子", async () => {
  const app = await fresh();
  await app.press("id:cell-7-7");
  await app.waitUntil(() => has(app.texts(), "2 手"), { timeout: 8000 });
  expect(app.shows("id:stone-7-7-b")).toBe(true);
  expect(app.count("id:stone-7-7-w")).toBe(0);
});

test("连续多局状态互不影响", async () => {
  const app = await fresh();
  await toPvp(app);
  for (let round = 0; round < 3; round++) {
    for (const c of ["1-1", "9-9", "2-2", "9-10", "3-3", "9-11", "4-4", "9-12", "5-5"]) {
      await app.press(`id:cell-${c}`);
    }
    expect(app.shows("id:stone-5-5-b")).toBe(true);
    expect(app.shows("id:stone-9-12-w")).toBe(true);
    await app.press("id:result-restart");
    await app.waitUntil(() => has(app.texts(), "0 手"), { timeout: 3000 });
    expect(app.count("id:stone-1-1-b")).toBe(0);
  }
  // 三局都记进了战绩
  const saved = JSON.parse(app.storage()["gomoku.v2"]);
  expect(saved.history.length).toBe(3);
});

test("人机模式悔棋两步后轮到玩家", async () => {
  const app = await fresh();
  await app.press("id:cell-7-7");
  await app.waitUntil(() => has(app.texts(), "2 手"), { timeout: 8000 });
  await app.press("id:undo");
  await app.waitUntil(() => has(app.texts(), "0 手"), { timeout: 3000 });
  expect(app.count("id:stone-7-7-b")).toBe(0);
  await app.press("id:cell-7-7");
  expect(app.shows("id:stone-7-7-b")).toBe(true);
});

test("菜单可以打开、显示统计并关闭", async () => {
  const app = await fresh();
  await app.press("id:open-menu");
  await app.waitFor("id:menu-close");
  const texts = app.texts();
  expect(texts).toContain("菜单");
  expect(texts).toContain("总分");
  expect(texts).toContain("单局最高");
  expect(texts).toContain("连胜");
  expect(has(texts, "还没有对局记录")).toBe(true);
  expect(app.shows("id:clear-history")).toBe(true);

  await app.press("id:menu-close");
  await app.waitUntil(() => !app.shows("id:menu-close"));
  expect(app.texts()).toContain("轮到你落子");
});

test("对局结束会写入战绩，清空后归零", async () => {
  const app = await fresh();
  await toPvp(app);
  for (const c of ["3-7", "0-0", "4-7", "0-1", "5-7", "0-2", "6-7", "0-3", "7-7"]) {
    await app.press(`id:cell-${c}`);
  }
  await app.press("id:result-restart");
  await app.waitUntil(() => has(app.texts(), "0 手"), { timeout: 3000 });

  const saved = JSON.parse(app.storage()["gomoku.v2"]);
  expect(saved.history.length).toBe(1);
  expect(saved.history[0].outcome).toBe("win");
  expect(saved.history[0].moves).toBe(9);
  expect(saved.history[0].mode).toBe("pvp");
  expect(saved.win).toBe(1);

  await app.press("id:open-menu");
  await app.waitFor("id:menu-close");
  expect(has(app.texts(), "历史战绩（1 局）")).toBe(true);
  await app.press("id:clear-history");
  await app.press("id:clear-history");
  await app.waitUntil(() => has(app.texts(), "还没有对局记录"));

  const after = JSON.parse(app.storage()["gomoku.v2"]);
  expect(after.history.length).toBe(0);
  expect(after.score).toBe(0);
  expect(after.streak).toBe(0);
  expect(after.win).toBe(0);
});

test("限时落子：超时自动落子并提示扣分", async () => {
  const app = await fresh({ clock: {} });
  expect(app.shows("id:timer-text")).toBe(true);
  // 手动时钟推到 30 秒之后
  await app.clock.fastForward(30000);
  expect(has(app.texts(), "超时")).toBe(true);
  // 自动落子后轮到 AI，AI 会应一手
  await app.clock.runFor(300);
  expect(has(app.texts(), "2 手")).toBe(true);
});

test("菜单打开时倒计时暂停", async () => {
  const app = await fresh({ clock: {} });
  await app.press("id:open-menu");
  await app.clock.fastForward(90000);
  await app.press("id:menu-close");
  await app.clock.runFor(600);
  expect(has(app.texts(), "0 手")).toBe(true);
  expect(has(app.texts(), "超时")).toBe(false);
});

test("双人模式菜单打开时倒计时也暂停", async () => {
  const app = await fresh({ clock: {} });
  await toPvp(app);
  await app.press("id:open-menu");
  await app.clock.fastForward(90000);
  await app.press("id:menu-close");
  await app.clock.runFor(600);
  expect(has(app.texts(), "0 手")).toBe(true);
  expect(has(app.texts(), "超时")).toBe(false);
  expect(app.shows("id:timer-urgent")).toBe(false);
});

test("Web 上会挂载隐藏音效播放器", async () => {
  const app = await open("./App.tsx", { storage: {}, platform: "web" });
  await app.waitFor("id:sound-place");
  for (const name of ["place", "tick", "timeout", "win", "loss", "draw"]) {
    expect(app.count(`id:sound-${name}`)).toBe(1);
  }
  // 触发一次落子音效，确认隐藏播放器不会把对局弄崩
  await app.press("id:cell-7-7");
  expect(app.shows("id:stone-7-7-b")).toBe(true);
});

test("最后 5 秒进入红色闪烁警告", async () => {
  const app = await fresh({ clock: {} });
  await app.clock.fastForward(24000);
  expect(app.shows("id:timer-track")).toBe(true);
  expect(app.shows("id:timer-urgent")).toBe(false);

  await app.clock.fastForward(1000);
  expect(app.texts()).toContain("0:05");
  expect(app.shows("id:timer-urgent")).toBe(true);

  await app.clock.fastForward(1000);
  expect(app.texts()).toContain("0:04");
  expect(app.shows("id:timer-urgent")).toBe(true);
});
