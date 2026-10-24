import { Input, Scroll, Text, View, computed, signal } from "nsh";
import { C, PressButton } from "./ui";
import { MultiBoard } from "./MultiBoard";
import {
  ENDGAMES,
  ENDGAME_CREDITS,
  startEndgame,
  playEndgame,
  endgameHint,
  queryEndgames,
  describeMove,
  type Endgame,
  type EndgameSession,
} from "../lib/endgames";
import {
  createRoyal,
  royalLegalMoves,
  type RoyalKind,
  type RoyalMove,
} from "../lib/royal";
import { type Match } from "../lib/multigame";
import { gameName } from "../lib/catalog";
export function Endgames(props: {
  initial: RoyalKind;
  solved: string[];
  onSolved: (id: string) => void;
  onBack: () => void;
}) {
  const credits = signal(false);
  const kind = signal<RoyalKind>(props.initial),
    search = signal(""),
    category = signal("全部"),
    level = signal("全部"),
    status = signal("全部"),
    page = signal(0);
  const session = signal<EndgameSession | null>(null),
    selected = signal(-1),
    hint = signal<RoyalMove | null>(null),
    review = signal<number | null>(null),
    size = signal(340);
  const promotion = signal<{ from: number; to: number } | null>(null);
  const list = computed(() =>
    queryEndgames(
      kind(),
      search(),
      category(),
      level(),
      props.solved,
      status(),
    ),
  );
  const visible = computed(() => list().slice(page() * 12, page() * 12 + 12));
  const view = computed(() => {
    const s = session();
    if (!s) return createRoyal(kind());
    return review() === null
      ? s.state
      : s.steps[Math.min(review()!, s.steps.length - 1)];
  });
  const targets = computed(() =>
    session()
      ? hint()
        ? [hint()!.from, hint()!.to]
        : royalLegalMoves(view())
            .filter((m) => m.from === selected())
            .map((m) => m.to)
      : [],
  );
  function open(p: Endgame) {
    session.set(null);
    session.set(startEndgame(p));
    selected.set(-1);
    hint.set(null);
    review.set(null);
    promotion.set(null);
  }
  function play(m: RoyalMove) {
    const s = session();
    if (!s) return;
    const n = playEndgame(s, m);
    session.set(n);
    selected.set(-1);
    hint.set(null);
    promotion.set(null);
    if (n.solved) props.onSolved(n.problem.id);
  }
  function cell(i: number) {
    const s = session();
    if (!s || review() !== null || s.solved) return;
    const v = s.state.board[i],
      p = v > 0 ? 1 : v < 0 ? 2 : 0;
    if (p === s.state.turn) {
      selected.set(i);
      hint.set(null);
      return;
    }
    if (
      royalLegalMoves(s.state).some(
        (m) => m.from === selected() && m.to === i && m.promotion,
      )
    )
      promotion.set({ from: selected(), to: i });
    else if (selected() >= 0) play({ from: selected(), to: i });
  }
  return (
    <Scroll
      testID="endgames-screen"
      style={{ flex: 1, width: "100%" }}
      contentStyle={{ alignItems: "center", padding: 16 }}
    >
      <View style={{ width: "100%", maxWidth: 650, gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: C.ink, fontSize: 24, fontWeight: "700" }}>
            残局与战术
          </Text>
          <PressButton
            label="返回首页"
            testID="endgames-back"
            onPress={props.onBack}
          />
        </View>
        <If
          when={session() === null}
          else={
            <>
              <Text style={{ color: C.ink, fontSize: 18, fontWeight: "600" }}>
                {session()?.problem.name}
              </Text>
              <Text style={{ color: C.muted, fontSize: 12 }}>
                {session()?.problem.category} ·{" "}
                {session()?.problem.kind === "chess"
                  ? `Lichess ${session()?.problem.rating}`
                  : "公开残局资料"}
              </Text>
              <Text
                testID="endgame-feedback"
                style={{
                  color: session()?.solved ? "#347354" : C.accent,
                  fontSize: 14,
                  lineHeight: 22,
                }}
              >
                {session()?.notice}
              </Text>
              <If when={hint()}>
                <Text testID="endgame-hint-text" style={{ color: C.muted }}>
                  提示：
                  {hint() && session()
                    ? describeMove(session()!.state, hint()!)
                    : ""}
                  。
                  {session()?.problem.proof || session()?.problem.line.length
                    ? "先计算对方的最佳应手。"
                    : "这是启发式AI建议，不是理论正解。"}
                </Text>
              </If>
              <View
                onLayout={(e) =>
                  size.set(Math.max(200, Math.min(520, e.size.width)))
                }
                style={{ width: "100%", alignItems: "center" }}
              >
                <If when={session()}>
                  {(s) => (
                    <MultiBoard
                      match={() =>
                        ({ kind: s().problem.kind, state: view() }) as Match
                      }
                      size={size}
                      selected={() => hint()?.from ?? selected()}
                      targets={targets}
                      onCell={cell}
                      disabled={review() !== null || s().solved}
                    />
                  )}
                </If>
              </View>
              <If when={promotion()}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Each
                    of={[
                      { t: 5, label: "后" },
                      { t: 4, label: "车" },
                      { t: 3, label: "象" },
                      { t: 2, label: "马" },
                    ]}
                  >
                    {(p) => (
                      <PressButton
                        label={p().label}
                        testID={`endgame-promote-${p().t}`}
                        onPress={() => {
                          const m = promotion();
                          if (m) play({ ...m, promotion: p().t });
                        }}
                      />
                    )}
                  </Each>
                </View>
              </If>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <PressButton
                  label="提示"
                  testID="endgame-hint"
                  disabled={!!session()?.solved || review() !== null}
                  onPress={() => {
                    if (session()) {
                      hint.set(endgameHint(session()!));
                      session.update((s) =>
                        s ? { ...s, hints: s.hints + 1 } : s,
                      );
                    }
                  }}
                />
                <PressButton
                  label="重试"
                  testID="endgame-retry"
                  onPress={() => {
                    if (session()) open(session()!.problem);
                  }}
                />
                <PressButton
                  label="返回题库"
                  testID="endgame-list"
                  onPress={() => session.set(null)}
                />
                <PressButton
                  label="下一题"
                  testID="endgame-next"
                  onPress={() => {
                    const s = session();
                    if (!s) return;
                    const a = list(),
                      i = a.findIndex((p) => p.id === s.problem.id);
                    if (a.length) open(a[(i + 1) % a.length]);
                  }}
                />
              </View>
              <Text style={{ color: C.muted, fontSize: 12 }}>
                复盘 {review() ?? session()?.steps.length! - 1} /{" "}
                {(session()?.steps.length ?? 1) - 1} · 回看期间不能走子
              </Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <PressButton
                  label="上一步"
                  testID="endgame-prev"
                  disabled={(review() ?? session()?.steps.length! - 1) <= 0}
                  onPress={() =>
                    review.set(
                      Math.max(
                        0,
                        (review() ?? session()!.steps.length - 1) - 1,
                      ),
                    )
                  }
                />
                <PressButton
                  label="下一步"
                  testID="endgame-forward"
                  disabled={
                    review() === null ||
                    review()! >= session()!.steps.length - 1
                  }
                  onPress={() =>
                    review.update((v) =>
                      Math.min(session()!.steps.length - 1, (v ?? 0) + 1),
                    )
                  }
                />
                <PressButton
                  label="继续解题"
                  testID="endgame-current"
                  onPress={() => review.set(null)}
                />
              </View>
              <Text style={{ color: C.muted, fontSize: 12, lineHeight: 20 }}>
                {session()?.problem.kind === "chess"
                  ? "学习要点：将军、吃子和威胁，逐一检查对方应手。战术题完成解答线即过关。"
                  : "学习要点：先检查将帅安全与对方所有应将，再观察车马炮配合。无校验正解的研习局面只在实战获胜时记为已解。"}
              </Text>
            </>
          }
        >
          <View style={{ flexDirection: "row", gap: 8 }}>
            <PressButton
              label="国际象棋"
              testID="endgames-chess"
              tone={kind() === "chess" ? "primary" : "default"}
              onPress={() => {
                kind.set("chess");
                category.set("全部");
                page.set(0);
              }}
            />
            <PressButton
              label="中国象棋"
              testID="endgames-xiangqi"
              tone={kind() === "xiangqi" ? "primary" : "default"}
              onPress={() => {
                kind.set("xiangqi");
                category.set("全部");
                page.set(0);
              }}
            />
          </View>
          <Text style={{ color: C.muted, fontSize: 12, lineHeight: 20 }}>
            {gameName(kind())}共{" "}
            {ENDGAMES.filter((p) => p.kind === kind()).length} 题；已解{" "}
            {
              props.solved.filter((id) =>
                ENDGAMES.some((p) => p.kind === kind() && p.id === id),
              ).length
            }{" "}
            题。
            {kind() === "chess"
              ? "Lichess CC0 · 保留题库评级与原始编号。"
              : "含强制将杀挑战及实用残局研习；研习局面无统一标准答案。"}
          </Text>
          <Input
            value={search()}
            placeholder="搜索名称、编号或杀法 / fork / endgame"
            testID="endgames-search"
            onChange={(v) => {
              search.set(v);
              page.set(0);
            }}
          />
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Each
              of={
                kind() === "chess"
                  ? ["全部", "战术挑战", "实用残局"]
                  : ["全部", "杀法挑战", "经典杀法", "实用残局"]
              }
            >
              {(c) => (
                <PressButton
                  label={c()}
                  testID={`endgames-category-${c()}`}
                  tone={category() === c() ? "primary" : "default"}
                  onPress={() => {
                    category.set(c());
                    page.set(0);
                  }}
                />
              )}
            </Each>
          </View>
          <If when={kind() === "chess"}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Each of={["全部", "入门", "进阶", "挑战"]}>
                {(c) => (
                  <PressButton
                    label={c()}
                    testID={`endgames-level-${c()}`}
                    onPress={() => {
                      level.set(c());
                      page.set(0);
                    }}
                  />
                )}
              </Each>
            </View>
          </If>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Each of={["全部", "未解", "已解"]}>
              {(c) => (
                <PressButton
                  label={c()}
                  testID={`endgames-status-${c()}`}
                  onPress={() => {
                    status.set(c());
                    page.set(0);
                  }}
                />
              )}
            </Each>
          </View>
          <Text testID="endgames-count" style={{ color: C.muted }}>
            找到 {list().length} 题
          </Text>
          <Each of={visible()}>
            {(p) => (
              <PressButton
                label={(props.solved.includes(p().id) ? "✓ " : "") + p().name}
                subLabel={`${p().category}${p().rating ? " · " + p().rating : ""}`}
                testID={`endgame-open-${p().id}`}
                onPress={() => open(p())}
              />
            )}
          </Each>
          <If when={!list().length}>
            <Text style={{ color: C.muted }}>
              没有匹配的题目，可调整筛选条件。
            </Text>
          </If>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <PressButton
              label="上一页"
              testID="endgames-page-prev"
              disabled={page() === 0}
              onPress={() => page.update((v) => v - 1)}
            />
            <Text style={{ color: C.muted }}>
              第 {page() + 1} / {Math.max(1, Math.ceil(list().length / 12))} 页
            </Text>
            <PressButton
              label="下一页"
              testID="endgames-page-next"
              disabled={(page() + 1) * 12 >= list().length}
              onPress={() => page.update((v) => v + 1)}
            />
          </View>
        </If>
        <PressButton
          label="数据来源与许可"
          testID="endgames-credits"
          onPress={() => credits.update((v) => !v)}
        />
        <If when={credits()}>
          <Text style={{ color: C.muted, fontSize: 11, lineHeight: 18 }}>
            {ENDGAME_CREDITS}
          </Text>
        </If>
      </View>
    </Scroll>
  );
}
