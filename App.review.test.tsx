import { expect, open, test } from "nsh/test";
import { createClock, defaultTimeControl } from "./lib/clock";
import { makeRecord } from "./lib/records";

async function resumeJunqi(mode: "pvp" | "pve" = "pvp") {
  const app = await open("./App.tsx", {
    clock: {},
    storage: {
      "gomoku.game.v1": JSON.stringify({
        kind: "junqi",
        mode,
        level: "normal",
        limitOn: false,
        moves: [],
        actions: [],
        undos: 0,
        timeouts: 0,
        startedAt: 1,
        savedAt: 1,
        clock: createClock(defaultTimeControl("junqi")),
      }),
    },
  });
  await app.waitFor("id:home-continue");
  await app.press("id:home-continue");
  await app.waitFor("id:junqi-screen");
  return app;
}

test("军棋恢复双人对局先遮盖，结束前禁止公开保存棋谱", async () => {
  const app = await resumeJunqi();
  expect(app.shows("id:extra-cell-0")).toBe(false);
  expect(app.shows("id:junqi-handoff")).toBe(true);
  await app.press("id:junqi-handoff");
  expect(app.shows("id:extra-cell-0")).toBe(true);
  expect(app.enabled("id:extra-record")).toBe(false);
  await app.press("id:extra-menu");
  expect(app.enabled("id:extra-save")).toBe(false);
});

test("旧版未结束军棋棋谱不会公开暗子，结束棋谱仍可查看", async () => {
  const ongoing = makeRecord({
    game: "junqi",
    mode: "pvp",
    level: "normal",
    actions: [],
    savedAt: 1000,
  });
  const ended = makeRecord({
    game: "junqi",
    mode: "pvp",
    level: "normal",
    actions: [],
    result: "玩家2胜 · 认输",
    savedAt: 2000,
  });
  const app = await open("./App.tsx", {
    clock: {},
    storage: { "gomoku.records.v1": JSON.stringify([ongoing, ended]) },
  });
  await app.waitFor("id:home-records");
  await app.press("id:home-records");
  await app.press(`id:record-open-${ongoing.id}`);
  expect(app.shows("id:extra-cell-0")).toBe(false);
  expect(app.shows("id:record-junqi-hidden")).toBe(true);
  await app.press("id:record-back");
  await app.press(`id:record-open-${ended.id}`);
  expect(app.shows("id:extra-cell-0")).toBe(true);
});

test("军棋AI 观战开局自动行棋，无需玩家布阵", async () => {
  const app = await open("./App.tsx", { storage: {}, clock: {} });
  await app.press("id:seg-game-junqi");
  await app.press("id:home-aiai");
  await app.waitFor("id:junqi-screen");
  expect(app.shows("id:junqi-ready")).toBe(false);
  await app.clock.runFor(1000);
  expect(app.texts().some((t) => t.includes("玩家2"))).toBe(true);
});

test("对战AI悔棋撤回双方加秒和手数，不返还已经用掉的时间", async () => {
  const app = await open("./App.tsx", { storage: {}, clock: {} });
  await app.press("id:seg-game-chess");
  await app.press("id:home-new");
  await app.clock.runFor(2000);
  await app.press("id:extra-cell-52");
  await app.press("id:extra-cell-36");
  await app.clock.runFor(500);
  await app.press("id:extra-undo");
  await app.press("id:extra-back");
  const saved = JSON.parse(app.storage()["gomoku.game.v1"]);
  expect(saved.actions.length).toBe(0);
  expect(saved.clock.moveNo).toBe(0);
  expect(saved.clock.p1.mainMs <= 15 * 60_000 - 2000).toBe(true);
  expect(saved.clock.p2.mainMs <= 15 * 60_000 - 450).toBe(true);
});

test("不限时国际象棋走子后能从存档继续，模式名称明确区分", async () => {
  const app = await open("./App.tsx", { storage: {}, clock: {} });
  expect(app.texts()).toContain("对战 AI");
  expect(app.texts()).toContain("AI 观战");
  expect(app.texts().some((t) => t.includes("人机大战"))).toBe(false);
  await app.press("id:seg-game-chess");
  await app.press("id:seg-pvp");
  await app.press("id:seg-off");
  await app.press("id:home-new");
  await app.press("id:extra-cell-52");
  await app.press("id:extra-cell-36");
  await app.press("id:extra-back");
  const again = await open("./App.tsx", { storage: app.storage(), clock: {} });
  await again.waitFor("id:home-continue");
  await again.press("id:home-continue");
  expect(again.texts().some((t) => t.includes("轮到玩家2"))).toBe(true);
});

test("双人军棋认输记负，不误记为和棋", async () => {
  const app = await resumeJunqi();
  await app.press("id:junqi-handoff");
  await app.press("id:extra-resign");
  await app.press("id:extra-resign");
  await app.press("id:extra-back");
  const progress = JSON.parse(app.storage()["gomoku.v2"]);
  expect(progress.history[0].outcome).toBe("loss");
  expect(progress.loss).toBe(1);
  expect(progress.draw).toBe(0);
});

test("围棋默认19路，帮助说明快棋、加秒和读秒", async () => {
  const app = await open("./App.tsx", { storage: {}, clock: {} });
  await app.press("id:seg-game-go");
  await app.press("id:home-help");
  await app.waitFor("id:help-panel");
  expect(app.texts().some((t) => t.includes("快棋、超快棋表示比赛用时"))).toBe(
    true,
  );
  expect(
    app.texts().some((t) => t.includes("主时间用尽后有 3 次 30 秒读秒")),
  ).toBe(true);
  await app.press("id:help-tab-chess");
  expect(app.texts().some((t) => t.includes("加秒在完成一手后"))).toBe(true);
  expect(app.texts().some((t) => t.includes("第 40 步完成后"))).toBe(true);
  await app.press("id:help-close");
  await app.press("id:home-new");
  await app.waitFor("id:go-pass");
  expect(app.texts().some((t) => t.includes("19 路"))).toBe(true);
  expect(app.shows("id:cell-18-18")).toBe(true);
});

test("双人围棋白胜记负，不把数子胜负记为和棋", async () => {
  const app = await open("./App.tsx", { storage: {}, clock: {} });
  await app.press("id:seg-game-go");
  await app.press("id:seg-pvp");
  await app.press("id:home-new");
  await app.press("id:go-pass");
  await app.press("id:go-pass");
  await app.press("id:go-score-confirm");
  await app.press("id:go-result-home");
  const progress = JSON.parse(app.storage()["gomoku.v2"]);
  expect(progress.history[0].outcome).toBe("loss");
  expect(progress.draw).toBe(0);
});
