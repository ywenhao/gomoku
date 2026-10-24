import { expect, open, test } from "nsh/test";

const has = (texts: string[], part: string) => texts.some((t) => t.includes(part));

/** 启动到主页，不自动开局 */
const launch = (extra: Record<string, unknown> = {}) =>
  open("./App.tsx", { storage: {}, ...extra });

/** 干净存档 → 从主页点「开始新对局」，避免棋盘是第一屏 */
const fresh = async (extra: Record<string, unknown> = {}) => {
  const app = await launch(extra);
  await app.press("id:home-new");
  await app.waitFor("id:cell-7-7");
  return app;
};

/** 打开菜单 → 切到双人 → 关掉菜单 */
async function toPvp(app: Awaited<ReturnType<typeof open>>) {
  await app.press("id:open-menu");
  await app.press("id:seg-pvp");
  await app.press("id:menu-close");
  await app.waitUntil(() => !app.shows("id:menu-close"));
}

test("首屏是游戏菜单，不直接显示棋盘", async () => {
  const app = await launch();
  const texts = app.texts();
  expect(texts).toContain("五子棋");
  expect(has(texts, "人机")).toBe(true);
  expect(has(texts, "普通")).toBe(true);
  expect(app.shows("id:home-screen")).toBe(true);
  expect(app.shows("id:home-new")).toBe(true);
  expect(app.shows("id:home-sound")).toBe(true);
  expect(app.shows("id:home-exit")).toBe(true);
  expect(app.shows("id:home-continue")).toBe(false);
  expect(app.shows("id:cell-7-7")).toBe(false);
  expect(app.shows("id:timer-text")).toBe(false);
});

test("新对局进入棋盘并开始倒计时", async () => {
  const app = await fresh();
  const texts = app.texts();
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
  // 已经分出胜负的对局不再出现在「继续游戏」里
  expect(app.storage()["gomoku.game.v1"]).toBe(null);

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
  const app = await fresh({ platform: "web" });
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

test("返回游戏菜单后继续，沿用存档里的设置", async () => {
  const app = await fresh();
  await toPvp(app);
  await app.press("id:cell-7-7");
  await app.press("id:cell-8-8");
  await app.press("id:open-menu");
  await app.press("id:menu-home");
  await app.waitFor("id:home-continue");
  expect(has(app.texts(), "2 手")).toBe(true);
  await app.waitUntil(() => app.storage()["gomoku.game.v1"] !== undefined);

  // 主页改成单机困难，不应该影响上一局：继续后仍是本地双人
  await app.press("id:seg-pve");
  await app.press("id:seg-hard");
  await app.press("id:home-continue");
  await app.waitFor("id:cell-7-7");
  expect(has(app.texts(), "本地双人")).toBe(true);
  expect(has(app.texts(), "2 手")).toBe(true);
  expect(app.shows("id:stone-7-7-b")).toBe(true);
  expect(app.shows("id:stone-8-8-w")).toBe(true);
});

test("关掉应用重新打开，能从主页继续", async () => {
  const app = await fresh();
  await toPvp(app);
  for (const c of ["1-1", "2-2", "3-3"]) {
    await app.press(`id:cell-${c}`);
  }
  await app.waitUntil(() => app.storage()["gomoku.game.v1"] !== undefined);

  const again = await open("./App.tsx", { storage: app.storage() });
  await again.waitFor("id:home-continue");
  expect(has(again.texts(), "3 手")).toBe(true);

  await again.press("id:home-continue");
  await again.waitFor("id:cell-7-7");
  expect(again.shows("id:stone-1-1-b")).toBe(true);
  expect(again.shows("id:stone-2-2-w")).toBe(true);
  expect(again.shows("id:stone-3-3-b")).toBe(true);
  expect(has(again.texts(), "3 手")).toBe(true);
  expect(again.texts()).toContain("白棋落子");
});

test("主页帮助展示规则、棋型与开局说明", async () => {
  const app = await launch();
  await app.press("id:home-help");
  await app.waitFor("id:help-panel");
  const texts = app.texts();
  expect(texts).toContain("帮助与规则");
  expect(has(texts, "活四")).toBe(true);
  expect(has(texts, "冲四")).toBe(true);
  expect(has(texts, "开局布局")).toBe(true);
  expect(has(texts, "VCF")).toBe(true);
  expect(has(texts, "天元")).toBe(true);
  expect(app.shows("id:help-close")).toBe(true);

  await app.press("id:help-close");
  await app.waitUntil(() => !app.shows("id:help-panel"));
  expect(app.shows("id:home-new")).toBe(true);
});

test("对局菜单能打开帮助，帮助和菜单都会暂停倒计时", async () => {
  const app = await fresh({ clock: {} });
  await app.press("id:open-menu");
  await app.press("id:menu-help");
  await app.waitFor("id:help-panel");
  expect(has(app.texts(), "常见错误")).toBe(true);

  // 帮助打开期间不能落子，倒计时也不走
  await app.press("id:cell-7-7");
  await app.clock.fastForward(90000);
  expect(has(app.texts(), "0 手")).toBe(true);
  expect(has(app.texts(), "已替你落子")).toBe(false);

  await app.press("id:help-close");
  await app.waitUntil(() => !app.shows("id:help-panel"));
  // 关掉帮助后回到对局菜单，再关菜单才开始计时
  expect(app.shows("id:menu-close")).toBe(true);
  await app.press("id:menu-close");
  await app.clock.runFor(600);
  expect(has(app.texts(), "0 手")).toBe(true);
  expect(has(app.texts(), "已替你落子")).toBe(false);
});

test("地狱难度会用于新对局并写入设置", async () => {
  const app = await launch();
  await app.press("id:seg-hell");
  await app.press("id:home-new");
  await app.waitFor("id:cell-7-7");
  expect(has(app.texts(), "人机 · 地狱")).toBe(true);
  await app.waitUntil(() => {
    const raw = app.storage()["gomoku.v2"];
    return raw !== undefined && JSON.parse(raw).level === "hell";
  });
});

test("主页的对战设置会用于新对局", async () => {
  const app = await launch();
  await app.press("id:seg-hard");
  await app.press("id:seg-off");
  await app.press("id:home-new");
  await app.waitFor("id:cell-7-7");
  expect(has(app.texts(), "人机 · 困难")).toBe(true);
  expect(app.shows("id:timer-text")).toBe(false);
});

test("声音开关会保存，并在下次启动时恢复", async () => {
  const app = await launch();
  await app.press("id:home-sound");
  await app.waitUntil(() => {
    const raw = app.storage()["gomoku.v2"];
    return raw !== undefined && JSON.parse(raw).soundOn === false;
  });

  const again = await open("./App.tsx", { storage: app.storage() });
  // 存档里是关；再点一次应该变成开（如果没读档，默认开点了会变关）
  await again.press("id:home-sound");
  await again.waitUntil(() => {
    const raw = again.storage()["gomoku.v2"];
    return raw !== undefined && JSON.parse(raw).soundOn === true;
  });
});

test("退出游戏要连点两次确认", async () => {
  const app = await launch({ clock: {} });
  await app.press("id:home-exit");
  expect(has(app.texts(), "再点一次，确认退出")).toBe(true);
  await app.clock.fastForward(4100);
  expect(has(app.texts(), "再点一次，确认退出")).toBe(false);
  expect(app.shows("id:home-exit")).toBe(true);
});

test("重新开始会清掉未完成的存档", async () => {
  const app = await fresh();
  await toPvp(app);
  await app.press("id:cell-7-7");
  await app.waitUntil(() => app.storage()["gomoku.game.v1"] !== undefined);

  await app.press("id:restart");
  await app.waitUntil(() => app.storage()["gomoku.game.v1"] === undefined);
  await app.press("id:open-menu");
  await app.press("id:menu-home");
  await app.waitFor("id:home-new");
  expect(app.shows("id:home-continue")).toBe(false);
});
