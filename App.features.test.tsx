import { expect, open, test } from "nsh/test";

const has = (texts: string[], part: string) =>
  texts.some((t) => t.includes(part));

const launch = (extra: Record<string, unknown> = {}) =>
  open("./App.tsx", { storage: {}, ...extra });

/** 主页选择围棋后开新局 */
async function newGo(
  app: Awaited<ReturnType<typeof open>>,
  size: "9" | "13" | "19" = "9",
) {
  await app.press("id:seg-game-go");
  await app.press(`id:go-${size}`);
  await app.press("id:home-new");
  await app.waitFor("id:go-pass");
}

/** 主页切到本地双人（围棋 / 五子棋通用） */
async function homePvp(app: Awaited<ReturnType<typeof open>>) {
  await app.press("id:seg-pvp");
}

test("首页是「弈境」：多棋类入口、AI 观战、残局、学棋与棋谱库都在首屏", async () => {
  const app = await launch();
  const texts = app.texts();
  expect(texts).toContain("弈境");
  expect(has(texts, "八种棋类")).toBe(true);
  expect(texts).toContain("五子棋");
  expect(texts).toContain("围棋");
  expect(has(texts, "AI 观战")).toBe(true);
  expect(has(texts, "残局挑战")).toBe(true);
  expect(has(texts, "学棋")).toBe(true);
  expect(has(texts, "棋谱库")).toBe(true);
  expect(app.shows("id:seg-game-gomoku")).toBe(true);
  expect(app.shows("id:seg-game-go")).toBe(true);
  expect(app.shows("id:home-aiai")).toBe(true);
  expect(app.shows("id:home-tsumego")).toBe(true);
  expect(app.shows("id:home-learn")).toBe(true);
  expect(app.shows("id:home-records")).toBe(true);
  // 围棋路数只在选围棋时出现
  expect(app.shows("id:go-19")).toBe(false);
  await app.press("id:seg-game-go");
  expect(app.shows("id:go-9")).toBe(true);
  expect(app.shows("id:go-13")).toBe(true);
  expect(app.shows("id:go-19")).toBe(true);
});

test("围棋帮助有独立的图文规则，五子棋标签仍可切回", async () => {
  const app = await launch();
  await app.press("id:seg-game-go");
  await app.press("id:home-help");
  await app.waitFor("id:help-panel");
  let texts = app.texts();
  expect(has(texts, "围棋 · 规则与教学")).toBe(true);
  for (const word of ["气", "提子", "打劫", "数子", "胜负"]) {
    expect(has(texts, word)).toBe(true);
  }
  expect(app.shows("id:help-tab-go")).toBe(true);

  await app.press("id:help-tab-gomoku");
  await app.waitUntil(() => has(app.texts(), "五子棋 · 规则与教学"));
  const gomokuTexts = app.texts();
  expect(has(gomokuTexts, "活四")).toBe(true);
  expect(has(gomokuTexts, "VCF")).toBe(true);
});

test("围棋 9 路对局：落子、悔棋、两次虚手进入数子并可确认结果", async () => {
  const app = await launch();
  await homePvp(app);
  await newGo(app);
  expect(has(app.texts(), "9 路")).toBe(true);
  expect(app.shows("id:cell-8-8")).toBe(true);
  expect(app.shows("id:cell-9-9")).toBe(false);
  expect(app.shows("id:go-pass")).toBe(true);

  await app.press("id:cell-4-4");
  expect(app.shows("id:stone-4-4-b")).toBe(true);
  expect(has(app.texts(), "1 手")).toBe(true);

  await app.press("id:go-undo");
  expect(has(app.texts(), "0 手")).toBe(true);
  expect(app.count("id:stone-4-4-b")).toBe(0);

  await app.press("id:cell-4-4");
  await app.press("id:go-pass");
  await app.press("id:go-pass");
  await app.waitFor("id:go-scoring");
  expect(has(app.texts(), "数子")).toBe(true);
  expect(has(app.texts(), "黑")).toBe(true);
  expect(has(app.texts(), "白")).toBe(true);

  // 标记死子会改变数子结果
  await app.press("id:go-dead-toggle");
  await app.press("id:cell-4-4");
  await app.waitUntil(() => has(app.texts(), "死子已标记 1 颗"));
  await app.press("id:go-score-confirm");
  await app.waitFor("id:go-result-close");
  expect(has(app.texts(), "点胜")).toBe(true);

  await app.press("id:go-result-save");
  await app.waitUntil(() => {
    const raw = app.storage()["gomoku.records.v1"];
    return raw !== undefined && JSON.parse(raw).length === 1;
  });
  const saved = JSON.parse(app.storage()["gomoku.records.v1"])[0];
  expect(saved.game).toBe("go");
  expect(saved.goSize).toBe(9);
  expect(saved.goMoves.length).toBe(3);
});

test("围棋可以换 13 / 19 路，难度也能在菜单里切到地狱", async () => {
  const app = await launch();
  await newGo(app, "13");
  expect(has(app.texts(), "13 路")).toBe(true);
  await app.press("id:open-menu");
  await app.press("id:seg-hell");
  await app.press("id:menu-close");
  await app.waitUntil(() => !app.shows("id:menu-close"));
  expect(has(app.texts(), "地狱")).toBe(true);
  await app.press("id:open-menu");
  await app.press("id:menu-go-19");
  await app.waitUntil(() => !app.shows("id:menu-close"));
  expect(has(app.texts(), "19 路")).toBe(true);
});

test("围棋未下完的棋可以返回首页继续，重开应用后也能恢复", async () => {
  const app = await launch();
  await homePvp(app);
  await newGo(app);
  await app.press("id:cell-2-2");
  await app.press("id:cell-6-6");
  await app.press("id:open-menu");
  await app.press("id:menu-home");
  await app.waitFor("id:home-continue");
  expect(has(app.texts(), "围棋 · 9 路")).toBe(true);
  expect(has(app.texts(), "2 手")).toBe(true);

  const again = await open("./App.tsx", { storage: app.storage() });
  await again.waitFor("id:home-continue");
  await again.press("id:home-continue");
  await again.waitFor("id:go-pass");
  expect(again.shows("id:stone-2-2-b")).toBe(true);
  expect(again.shows("id:stone-6-6-w")).toBe(true);
  expect(has(again.texts(), "2 手")).toBe(true);
  expect(has(again.texts(), "黑棋落子")).toBe(true);
});

test("AI 观战约两秒一手，能暂停、逐步回看、整局回放并保存棋谱", async () => {
  const app = await launch({ clock: {} });
  await app.press("id:seg-easy");
  await app.press("id:home-aiai");
  await app.waitFor("id:cell-7-7");
  expect(has(app.texts(), "AI 观战")).toBe(true);
  expect(has(app.texts(), "0 手")).toBe(true);

  // 不到 2 秒不落子，过了 2 秒走第一手
  await app.clock.runFor(1700);
  expect(has(app.texts(), "0 手")).toBe(true);
  await app.clock.runFor(400);
  await app.waitUntil(() => has(app.texts(), "1 手"));

  await app.clock.runFor(2200);
  await app.waitUntil(() => has(app.texts(), "2 手"));

  await app.press("id:aiai-pause");
  expect(has(app.texts(), "已暂停")).toBe(true);
  await app.clock.runFor(6000);
  expect(has(app.texts(), "2 手")).toBe(true);

  // 上一步可以退到起点，起点与终点两侧的边界按钮禁用
  await app.press("id:aiai-step-back");
  expect(has(app.texts(), "回看第 1 手")).toBe(true);
  await app.press("id:aiai-step-back");
  expect(has(app.texts(), "回看第 0 手")).toBe(true);
  expect(app.enabled("id:aiai-step-back")).toBe(false);
  expect(app.enabled("id:aiai-step-forward")).toBe(true);
  await app.press("id:aiai-step-forward");
  await app.press("id:aiai-step-forward");
  expect(has(app.texts(), "第 2 / 2 手")).toBe(true);
  expect(app.enabled("id:aiai-step-forward")).toBe(false);

  // 整局回放：从起点自动走到终点后停下
  await app.press("id:aiai-replay");
  await app.waitUntil(() => has(app.texts(), "整局回放"));
  await app.clock.runFor(1500);
  await app.waitUntil(() => has(app.texts(), "第 2 / 2 手"));

  // 保存棋谱，再进棋谱库回放与删除
  await app.press("id:aiai-save");
  await app.waitUntil(() => {
    const raw = app.storage()["gomoku.records.v1"];
    return raw !== undefined && JSON.parse(raw).length === 1;
  });
  const saved = JSON.parse(app.storage()["gomoku.records.v1"])[0];
  expect(saved.game).toBe("gomoku");
  expect(saved.moves.length).toBe(2);

  await app.press("id:open-menu");
  await app.press("id:menu-home");
  await app.waitFor("id:home-records");
  await app.press("id:home-records");
  await app.waitFor("id:records-screen");
  expect(has(app.texts(), "1 份")).toBe(true);
  await app.press(`id:record-open-${saved.id}`);
  await app.waitFor("id:record-view");
  expect(has(app.texts(), "2 手")).toBe(true);

  await app.press("id:record-first");
  expect(has(app.texts(), "第 0 / 2 手")).toBe(true);
  expect(app.enabled("id:record-prev")).toBe(false);
  await app.press("id:record-next");
  expect(has(app.texts(), "第 1 / 2 手")).toBe(true);
  await app.press("id:record-last");
  expect(has(app.texts(), "终局局面")).toBe(true);
  expect(app.enabled("id:record-next")).toBe(false);

  await app.press("id:record-delete");
  await app.press("id:record-delete");
  await app.waitFor("id:records-screen");
  expect(has(app.texts(), "还没有保存的棋谱")).toBe(true);
  await app.waitUntil(() => {
    const raw = app.storage()["gomoku.records.v1"];
    return raw !== undefined && JSON.parse(raw).length === 0;
  });
});

test("围棋AI 观战也能暂停、回看并保存棋谱", async () => {
  const app = await launch({ clock: {} });
  await app.press("id:seg-easy");
  await app.press("id:seg-game-go");
  await app.press("id:go-9");
  await app.press("id:home-aiai");
  await app.waitFor("id:go-pause");
  expect(has(app.texts(), "AI 观战")).toBe(true);
  expect(has(app.texts(), "9 路")).toBe(true);

  await app.clock.runFor(1800);
  expect(has(app.texts(), "0 手")).toBe(true);
  await app.clock.runFor(400);
  await app.waitUntil(() => has(app.texts(), "1 手"));
  await app.clock.runFor(2000);
  await app.waitUntil(() => has(app.texts(), "2 手"));

  await app.press("id:go-pause");
  expect(has(app.texts(), "已暂停")).toBe(true);
  await app.clock.runFor(5000);
  expect(has(app.texts(), "2 手")).toBe(true);

  await app.press("id:go-step-back");
  expect(has(app.texts(), "第 1 / 2 手")).toBe(true);
  await app.press("id:go-step-back");
  expect(app.enabled("id:go-step-back")).toBe(false);
  await app.press("id:go-step-forward");
  await app.press("id:go-step-forward");
  expect(app.enabled("id:go-step-forward")).toBe(false);

  await app.press("id:go-save");
  await app.waitUntil(() => {
    const raw = app.storage()["gomoku.records.v1"];
    return raw !== undefined && JSON.parse(raw).length === 1;
  });
  const saved = JSON.parse(app.storage()["gomoku.records.v1"])[0];
  expect(saved.game).toBe("go");
  expect(saved.goSize).toBe(9);
  expect(saved.goMoves.length).toBe(2);
});

test("残局挑战：筛选、提示、错手不污染棋盘，解出后记录进度", async () => {
  const app = await launch();
  await app.press("id:home-tsumego");
  await app.waitFor("id:tsumego-screen");
  expect(has(app.texts(), "420 道")).toBe(true);
  expect(app.shows("id:tsumego-open-easy-001")).toBe(true);

  await app.press("id:tsumego-level-easy");
  await app.waitFor("id:tsumego-open-easy-001");
  await app.type("id:tsumego-search", "001");
  await app.waitUntil(() => has(app.texts(), "共 1 道"));

  await app.press("id:tsumego-open-easy-001");
  await app.waitFor("id:tsumego-problem");
  expect(has(app.texts(), "角部死活 001")).toBe(true);

  // 错手只给提示，不落子
  await app.press("id:cell-0-0");
  expect(has(app.texts(), "这一手不对")).toBe(true);
  expect(has(app.texts(), "0 手")).toBe(true);

  await app.press("id:tsumego-hint");
  expect(has(app.texts(), "红圈是当前正解")).toBe(true);

  await app.press("id:cell-17-18");
  await app.waitUntil(() => has(app.texts(), "2 手"));
  expect(has(app.texts(), "白棋已应手")).toBe(true);
  await app.press("id:cell-13-18");
  await app.waitUntil(() => has(app.texts(), "正解完成"));
  await app.waitUntil(() => {
    const raw = app.storage()["gomoku.study.v1"];
    return raw !== undefined && JSON.parse(raw).tsumego.includes("easy-001");
  });

  await app.press("id:tsumego-next");
  await app.waitFor("id:tsumego-problem");
  expect(has(app.texts(), "角部死活 002")).toBe(true);
  await app.press("id:tsumego-list");
  await app.waitFor("id:tsumego-screen");
  expect(app.shows("id:tsumego-open-easy-001")).toBe(true);
});

test("学棋：按段位选路线，完成小测才记录进度并可进入下一课", async () => {
  const app = await launch();
  await app.press("id:seg-game-go");
  await app.press("id:home-learn");
  await app.waitFor("id:learn-screen");
  let texts = app.texts();
  expect(has(texts, "四条路线")).toBe(true);
  expect(has(texts, "启蒙")).toBe(true);
  expect(has(texts, "基础")).toBe(true);
  expect(has(texts, "进阶")).toBe(true);
  expect(has(texts, "段位")).toBe(true);
  expect(has(texts, "30 级 – 20 级")).toBe(true);

  await app.press("id:learn-track-basic");
  expect(has(app.texts(), "基础路线")).toBe(true);
  await app.press("id:learn-lesson-n1");
  await app.waitFor("id:learn-lesson-view");
  expect(has(app.texts(), "第 1 课")).toBe(true);
  expect(app.enabled("id:learn-next-lesson")).toBe(false);

  await app.press("id:learn-option-0");
  expect(has(app.texts(), "还不对")).toBe(true);
  expect(app.enabled("id:learn-next-lesson")).toBe(false);

  await app.press("id:learn-option-1");
  expect(has(app.texts(), "答对了")).toBe(true);
  expect(app.enabled("id:learn-next-lesson")).toBe(true);
  await app.waitUntil(() => {
    const raw = app.storage()["gomoku.study.v1"];
    return raw !== undefined && JSON.parse(raw).lessons.includes("n1");
  });

  await app.press("id:learn-next-lesson");
  await app.waitFor("id:learn-lesson-view");
  expect(has(app.texts(), "第 2 课")).toBe(true);
  await app.press("id:learn-lesson-back");
  await app.waitFor("id:learn-screen");
  expect(has(app.texts(), "1 / 5 完成")).toBe(true);
});
