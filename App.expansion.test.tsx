import { expect, open, test } from "nsh/test";
import { ENDGAMES, startEndgame, endgameHint } from "./lib/endgames";
const has = (app: Awaited<ReturnType<typeof open>>, text: string) =>
  app.texts().some((t) => t.includes(text));
const launch = () =>
  open("./App.tsx", { storage: {}, clock: {}, width: 390, height: 844 });
test("八棋种都有独立首页入口、规则与教学", async () => {
  const app = await launch();
  for (const kind of [
    "gomoku",
    "go",
    "connect6",
    "ludo",
    "checkers",
    "chess",
    "xiangqi",
    "junqi",
  ]) {
    expect(app.shows(`id:seg-game-${kind}`)).toBe(true);
    await app.press(`id:seg-game-${kind}`);
    await app.press("id:home-help");
    await app.waitFor("id:help-panel");
    expect(app.shows(`id:help-tab-${kind}`)).toBe(true);
    expect(has(app, "操作引导")).toBe(true);
    await app.press("id:help-close");
    await app.waitUntil(() => !app.shows("id:help-panel"));
  }
});
test("六子冲走子、存档恢复与棋谱重放", async () => {
  const app = await launch();
  await app.press("id:seg-game-connect6");
  await app.press("id:seg-pvp");
  await app.press("id:home-new");
  await app.waitFor("id:connect6-screen");
  await app.waitFor("id:extra-cell-8");
  await app.press("id:extra-cell-8");
  await app.press("id:extra-cell-9");
  await app.waitFor("id:c6-piece-9-b");
  expect(has(app, "玩家2")).toBe(true);
  await app.press("id:extra-cell-4");
  await app.press("id:extra-cell-5");
  await app.waitFor("id:c6-piece-5-w");
  await app.waitUntil(() => !app.shows("id:c6-piece-9-b"));
  await app.press("id:extra-record");
  await app.press("id:extra-back");
  await app.waitFor("id:home-continue");
  expect(has(app, "六子冲")).toBe(true);
  const saved = JSON.parse(app.storage()["gomoku.game.v1"]);
  expect(saved.actions.length).toBe(2);
  const again = await open("./App.tsx", {
    storage: app.storage(),
    clock: {},
    width: 390,
    height: 844,
  });
  await again.waitFor("id:home-continue");
  await again.press("id:home-continue");
  await again.waitFor("id:connect6-screen");
  await again.waitFor("id:c6-piece-5-w");
  await again.waitFor("id:c6-piece-11-b");
  expect(again.shows("id:c6-piece-9-b")).toBe(false);
  await again.press("id:extra-back");
  await again.press("id:home-records");
  const records = JSON.parse(again.storage()["gomoku.records.v1"]);
  await again.press(`id:record-open-${records[0].id}`);
  await again.waitFor("id:record-view");
  await again.press("id:record-first");
  expect(has(again, "第 0 / 2 步")).toBe(true);
  await again.press("id:record-next");
  expect(has(again, "第 1 / 2 步")).toBe(true);
});

test("国际象棋累计棋钟、加秒、菜单暂停、超时判负", async () => {
  const app = await launch();
  await app.press("id:seg-game-chess");
  await app.press("id:seg-pvp");
  await app.press("id:clock-chess-5-3");
  await app.press("id:home-new");
  await app.waitFor("id:chess-screen");
  await app.clock.runFor(10000);
  await app.press("id:extra-cell-52");
  await app.press("id:extra-cell-36");
  expect(has(app, "4:53")).toBe(true);
  await app.clock.runFor(20000);
  await app.press("id:extra-menu");
  const before = app.texts().find((t) => t.includes("玩家2 4:"));
  await app.clock.runFor(60000);
  expect(app.texts().find((t) => t.includes("玩家2 4:"))).toBe(before);
  await app.press("id:extra-menu-close");
  await app.clock.runFor(281000);
  expect(has(app, "对局结束")).toBe(true);
  expect(has(app, "玩家1获胜")).toBe(true);
  await app.press("id:extra-back");
  const progress = JSON.parse(app.storage()["gomoku.v2"]);
  expect(progress.history[0].result.includes("超时")).toBe(true);
  expect(progress.history[0].game).toBe("chess");
});
test("军棋布阵及双人暗棋交接，跳棋和飞行棋可开始", async () => {
  const app = await launch();
  await app.press("id:seg-game-junqi");
  await app.press("id:seg-pvp");
  await app.press("id:home-new");
  await app.waitFor("id:junqi-ready");
  expect(has(app, "玩家1布阵")).toBe(true);
  await app.press("id:junqi-ready");
  expect(app.shows("id:extra-cell-0")).toBe(false);
  await app.press("id:junqi-handoff");
  expect(has(app, "玩家2布阵")).toBe(true);
  await app.press("id:junqi-ready");
  await app.press("id:junqi-handoff");
  expect(has(app, "輪到玩家1") || has(app, "轮到玩家1")).toBe(true);
  await app.press("id:extra-back");
  await app.press("id:seg-game-checkers");
  await app.press("id:home-new");
  await app.waitFor("id:checkers-screen");
  expect(app.shows("id:extra-cell-120")).toBe(true);
  await app.press("id:extra-back");
  await app.press("id:seg-game-ludo");
  await app.press("id:home-new");
  await app.waitFor("id:ludo-roll");
  expect(app.shows("id:plane-4-3")).toBe(true);
  await app.press("id:ludo-roll");
  expect(has(app, "骰子") || has(app, "玩家2")).toBe(true);
});
test("320×568 小屏军旗对局保持一屏，关键操作与棋盘都在场", async () => {
  const app = await open("./App.tsx", {
    storage: {},
    clock: {},
    width: 320,
    height: 568,
    safeArea: { top: 24, bottom: 16 },
    platform: "android",
  });
  await app.press("id:seg-game-junqi");
  await app.press("id:seg-pvp");
  await app.press("id:home-new");
  await app.waitFor("id:junqi-screen");
  for (let i = 0; i < 60; i++)
    expect(app.shows(`id:extra-cell-${i}`)).toBe(true);
  expect(app.shows("id:junqi-ready")).toBe(true);

  await app.press("id:junqi-ready");
  await app.press("id:junqi-handoff");
  await app.press("id:junqi-ready");
  await app.press("id:junqi-handoff");

  for (const id of [
    "extra-undo",
    "extra-pause",
    "extra-record",
    "extra-back",
    "extra-resign",
    "extra-draw",
  ])
    expect(app.shows(`id:${id}`)).toBe(true);
  for (let i = 0; i < 60; i++)
    expect(app.shows(`id:extra-cell-${i}`)).toBe(true);

  // 对局页不是滚动容器；整页滚动会破坏棋盘与操作区的沉浸感。
  await expect(() => app.scroll("id:junqi-screen", 300)).rejects.toThrow();
});

test("五子棋教学有引导与测验，两个象棋都有大量可筛选残局", async () => {
  const app = await launch();
  await app.press("id:home-learn");
  await app.waitFor("id:academy-screen");
  await app.press("id:academy-option-1");
  expect(has(app, "再想一想")).toBe(true);
  await app.press("id:academy-option-0");
  expect(has(app, "已记录学习进度")).toBe(true);
  await app.press("id:academy-back");
  await app.press("id:seg-game-chess");
  await app.press("id:home-tsumego");
  await app.waitFor("id:endgames-screen");
  expect(has(app, "600 题")).toBe(true);
  await app.press("id:endgames-xiangqi");
  expect(has(app, "900 题")).toBe(true);
  await app.press("id:endgames-category-杀法挑战");
  expect(has(app, "找到 30 题")).toBe(true);
});
test("围棋读秒耗尽判负且不自动虚手，双方余时独立", async () => {
  const app = await launch();
  await app.press("id:seg-game-go");
  await app.press("id:seg-pvp");
  await app.press("id:home-new");
  await app.waitFor("id:go-clock-black");
  await app.clock.runFor(310000);
  expect(has(app, "黑 0:20")).toBe(true);
  expect(has(app, "白 5:00")).toBe(true);
  await app.clock.runFor(81000);
  expect(has(app, "超时判负")).toBe(true);
  expect(has(app, "0 手")).toBe(true);
});

test("象棋残局实际解题、重试与切换棋种不会留下旧棋盘", async () => {
  const app = await launch();
  await app.press("id:seg-game-chess");
  await app.press("id:home-tsumego");
  const p = ENDGAMES.find((p) => p.kind === "chess")!,
    s = startEndgame(p)!,
    m = endgameHint(s)!;
  await app.press(`id:endgame-open-${p.id}`);
  await app.press("id:endgame-hint");
  await app.press(`id:extra-cell-${m.from}`);
  await app.press(`id:extra-cell-${m.to}`);
  if (m.promotion) await app.press(`id:endgame-promote-${m.promotion}`);
  expect(has(app, "已记录进度")).toBe(true);
  await app.press("id:endgame-retry");
  expect(app.enabled("id:endgame-hint")).toBe(true);
  await app.press("id:endgame-list");
  await app.press("id:endgames-xiangqi");
  await app.press("id:endgames-category-杀法挑战");
  const xq = ENDGAMES.find((p) => p.kind === "xiangqi" && p.proof)!;
  await app.press(`id:endgame-open-${xq.id}`);
  expect(app.shows("id:extra-cell-89")).toBe(true);
  expect(app.shows("id:extra-cell-90")).toBe(false);
});

test("围棋数子可以保存后恢复，AI 观战不覆盖玩家存档", async () => {
  const app = await launch();
  await app.press("id:seg-game-go");
  await app.press("id:seg-pvp");
  await app.press("id:home-new");
  await app.press("id:cell-2-2");
  await app.press("id:go-pass");
  await app.press("id:go-pass");
  await app.press("id:open-menu");
  await app.press("id:menu-home");
  await app.waitFor("id:home-continue");
  const initial = app.storage()["gomoku.game.v1"];
  expect(JSON.parse(initial).scoring).toBe(true);
  await app.press("id:seg-game-chess");
  await app.press("id:home-aiai");
  await app.clock.runFor(2200);
  await app.press("id:extra-back");
  expect(app.storage()["gomoku.game.v1"]).toBe(initial);
  await app.press("id:home-continue");
  expect(app.shows("id:go-scoring")).toBe(true);
});
