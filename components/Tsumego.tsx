import {
  Input,
  Scroll,
  Text,
  View,
  computed,
  effect,
  signal,
} from "nsh";
import { Board, type BoardMark } from "./Board";
import { C, PressButton, Segmented, StoneDot } from "./ui";
import {
  TSUMEGO_PROBLEMS,
  TSUMEGO_LEVEL_NAME,
  playTsumego,
  queryTsumego,
  startTsumego,
  tsumegoHint,
  type TsumegoProblem,
  type TsumegoRegion,
  type TsumegoSession,
  type TsumegoSort,
} from "../lib/tsumego";
import { goStars } from "../lib/go";
import type { Difficulty } from "../lib/gomoku";

const PAGE_SIZE = 10;

const LEVELS: readonly { key: string; label: string }[] = [
  { key: "全部", label: "全部" },
  { key: "easy", label: "简单" },
  { key: "normal", label: "普通" },
  { key: "hard", label: "困难" },
  { key: "hell", label: "地狱" },
];

const REGIONS: readonly { key: TsumegoRegion; label: string }[] = [
  { key: "全部", label: "全部" },
  { key: "角部", label: "角部" },
  { key: "边上", label: "边上" },
  { key: "中腹", label: "中腹" },
];

const SORTS: readonly { key: TsumegoSort; label: string }[] = [
  { key: "no", label: "题号" },
  { key: "name", label: "名称" },
  { key: "level", label: "难度" },
];

const LEVEL_COLOR: Record<Difficulty, string> = {
  easy: "#2f7a58",
  normal: "#8a6a2f",
  hard: "#b2602e",
  hell: "#a3312a",
};

function Tag(props: { text: string; color?: string }) {
  return (
    <View
      style={{
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 6,
        backgroundColor: `${props.color ?? C.muted}18`,
      }}
    >
      <Text
        style={{
          fontSize: 9.5,
          fontWeight: "700",
          color: props.color ?? C.muted,
        }}
      >
        {props.text}
      </Text>
    </View>
  );
}

function Header(props: { title: string; sub: string; onBack: () => void }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 10,
        paddingTop: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "700",
            color: C.ink,
            letterSpacing: 2,
          }}
        >
          {props.title}
        </Text>
        <Text
          style={{
            fontSize: 10,
            fontWeight: "600",
            color: C.muted,
            letterSpacing: 1.6,
            marginTop: 3,
          }}
        >
          {props.sub}
        </Text>
      </View>
      <PressButton label="返回" testID="tsumego-back" onPress={props.onBack} />
    </View>
  );
}

function SolvedBadge() {
  return (
    <View
      style={{
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 6,
        backgroundColor: "rgba(47,122,88,0.12)",
      }}
    >
      <Text style={{ fontSize: 9.5, fontWeight: "700", color: "#2f7a58" }}>
        已解
      </Text>
    </View>
  );
}

function ProblemRow(props: {
  problem: TsumegoProblem;
  solved: boolean;
  onOpen: () => void;
}) {
  return (
    <View
      role="button"
      testID={`tsumego-open-${props.problem.id}`}
      accessibilityLabel={props.problem.name}
      onPress={props.onOpen}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 13,
        backgroundColor: C.panel,
        borderWidth: 1,
        borderColor: C.line,
      }}
      activeStyle={{ opacity: 0.7 }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(58,40,22,0.05)",
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: C.ink,
            fontVariant: ["tabular-nums"],
          }}
        >
          {props.problem.no}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: C.ink }}>
          {props.problem.name}
        </Text>
        <Text style={{ fontSize: 10, color: C.muted }}>
          {props.problem.series} · {props.problem.region} · {props.problem.size} 路
        </Text>
      </View>
      <Tag
        text={TSUMEGO_LEVEL_NAME[props.problem.level]}
        color={LEVEL_COLOR[props.problem.level]}
      />
      {props.solved ? <SolvedBadge /> : null}
    </View>
  );
}

/** 残局列表：按难度、区域、题名检索，分页显示 420 道题。 */
function ProblemList(props: {
  solved: readonly string[];
  onOpen: (problem: TsumegoProblem) => void;
  onBack: () => void;
}) {
  const level = signal<"全部" | Difficulty>("全部");
  const region = signal<TsumegoRegion>("全部");
  const sort = signal<TsumegoSort>("no");
  const text = signal("");
  const page = signal(0);

  const list = computed(() =>
    queryTsumego({
      level: level(),
      region: region(),
      text: text(),
      sort: sort(),
    }),
  );
  const pages = computed(() => Math.max(1, Math.ceil(list().length / PAGE_SIZE)));
  const current = computed(() => Math.min(page(), pages() - 1));
  const shown = computed(() => {
    const start = current() * PAGE_SIZE;
    return list().slice(start, start + PAGE_SIZE);
  });

  // 筛选条件变化后回到第一页，避免停在不存在的页码上
  effect(() => {
    level();
    region();
    sort();
    text();
    page.set(0);
  });

  const solvedCount = computed(() => {
    const set = new Set(props.solved);
    return TSUMEGO_PROBLEMS.filter((p) => set.has(p.id)).length;
  });

  return (
    <Scroll
      testID="tsumego-screen"
      style={{ flex: 1, width: "100%" }}
      contentStyle={{
        flexGrow: 1,
        alignItems: "center",
        paddingHorizontal: 14,
        paddingBottom: 24,
      }}
    >
      <View style={{ width: "100%", maxWidth: 560 }}>
        <Header
          title="残局挑战"
          sub={`死活 · 手筋 · 420 道 · 已解 ${solvedCount()} 道`}
          onBack={props.onBack}
        />

        <View
          style={{
            marginTop: 14,
            padding: 13,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: C.line,
            backgroundColor: C.panel,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <StoneDot player={1} size={16} />
            <Text style={{ fontSize: 12.5, color: C.ink, fontWeight: "600" }}>
              从角部开始，先算清变化再落子
            </Text>
          </View>
          <Input
            testID="tsumego-search"
            value={text()}
            placeholder="搜索题名、题号或系列"
            onChange={(value) => text.set(value)}
            style={{
              width: "100%",
              paddingVertical: 8,
              paddingHorizontal: 11,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: C.line,
              backgroundColor: "#fffdfa",
              fontSize: 12.5,
              color: C.ink,
            }}
          />
          <View style={{ gap: 8 }}>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 11, color: C.muted }}>难度</Text>
              <Segmented
                value={level}
                options={LEVELS}
                onChange={(k) => level.set(k as "全部" | Difficulty)}
                compact
                idPrefix="tsumego-level"
              />
            </View>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 11, color: C.muted }}>区域</Text>
              <Segmented
                value={region}
                options={REGIONS}
                onChange={region.set}
                compact
                idPrefix="tsumego-region"
              />
            </View>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 11, color: C.muted }}>排序</Text>
              <Segmented
                value={sort}
                options={SORTS}
                onChange={sort.set}
                compact
                idPrefix="tsumego-sort"
              />
            </View>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 12,
            marginBottom: 7,
          }}
        >
          <Text style={{ fontSize: 11.5, color: C.muted }}>
            共 {list().length} 道 · 第 {current() + 1} / {pages()} 页
          </Text>
          <Text style={{ fontSize: 10, color: C.muted }}>
            难度按正解长度与手筋复杂度划分
          </Text>
        </View>

        <View style={{ gap: 7 }}>
          {shown().length === 0 ? (
            <View
              style={{
                paddingVertical: 36,
                alignItems: "center",
                borderRadius: 14,
                borderWidth: 1,
                borderColor: C.line,
                backgroundColor: C.panel,
              }}
            >
              <Text style={{ fontSize: 12.5, color: C.muted }}>
                没有符合条件的题目，换个筛选试试
              </Text>
            </View>
          ) : (
            <Each of={shown()} key={(p) => p.id}>
              {(item) => (
                <ProblemRow
                  problem={item()}
                  solved={props.solved.includes(item().id)}
                  onOpen={() => props.onOpen(item())}
                />
              )}
            </Each>
          )}
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginTop: 11,
          }}
        >
          <PressButton
            label="上一页"
            testID="tsumego-prev-page"
            disabled={current() === 0}
            onPress={() => page.set(Math.max(0, current() - 1))}
            grow
          />
          <PressButton
            label="下一页"
            testID="tsumego-next-page"
            disabled={current() >= pages() - 1}
            onPress={() => page.set(Math.min(pages() - 1, current() + 1))}
            grow
          />
        </View>

        <Text
          style={{
            fontSize: 10,
            color: C.muted,
            lineHeight: 16,
            marginTop: 14,
          }}
        >
          题目来源：Go Game Guru Weekly Go Problems（An Younggil 8p / David
          Ormerod），CC BY-NC-SA 4.0。每道题都带正解树，错手不会污染棋盘，可以反复尝试。
        </Text>
      </View>
    </Scroll>
  );
}

/** 单题解答：正解分支、提示、白棋自动应手与完成进度。 */
function ProblemView(props: {
  problem: TsumegoProblem;
  solved: boolean;
  onSolved: (id: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const session = signal<TsumegoSession>(startTsumego(props.problem));
  const hint = signal(-1);
  const wrong = signal(-1);
  const feedback = signal<string | null>(null);
  const boardSize = signal(0);

  // 上一题 / 下一题只替换 props，组件本身可能复用，需要重置题目。
  let lastProblem = props.problem.id;
  effect(() => {
    if (props.problem.id === lastProblem) return;
    lastProblem = props.problem.id;
    session.set(startTsumego(props.problem));
    hint.set(-1);
    wrong.set(-1);
    feedback.set(null);
  });

  const board = computed(() => session().board);
  const last = computed(() => session().last);
  const complete = computed(() => session().solved);
  const marks = computed<BoardMark[]>(() => {
    const out: BoardMark[] = [];
    if (hint() >= 0) out.push({ i: hint(), label: "?", tone: "accent" });
    if (wrong() >= 0) out.push({ i: wrong(), label: "×", tone: "accent" });
    return out;
  });

  const canPlay = computed(() => !session().solved);

  function restart() {
    session.set(startTsumego(props.problem));
    hint.set(-1);
    wrong.set(-1);
    feedback.set(null);
  }

  function playAt(i: number) {
    if (complete()) return;
    const s = session();
    const size = props.problem.size;
    const x = i % size;
    const y = (i - x) / size;
    const result = playTsumego(props.problem, s, x, y);
    hint.set(-1);
    if (result === "wrong") {
      wrong.set(i);
      feedback.set("这一手不对，再算一遍：先看气，再看断点。");
      return;
    }
    wrong.set(-1);
    // playTsumego 原地修改 session，换一个对象让棋盘重新绘制
    session.set({
      ...s,
      board: s.board.slice(),
      moves: s.moves.slice(),
      pending: s.pending.slice(),
    });
    if (result === "solved") {
      feedback.set("正解完成！这道题已经记入进度。");
      if (!props.solved) props.onSolved(props.problem.id);
    } else {
      feedback.set("正解，白棋已应手，继续找下一手。");
    }
  }

  function showHint() {
    if (complete()) {
      feedback.set("这道题已经完成，可以重做或进入下一题。");
      return;
    }
    const p = tsumegoHint(session());
    if (!p) {
      feedback.set("当前没有可提示的正解分支。");
      return;
    }
    hint.set(p.y * props.problem.size + p.x);
    feedback.set("红圈是当前正解的第一手，先自己算清后续变化。");
  }

  return (
    <View
      testID="tsumego-problem"
      style={{
        flex: 1,
        width: "100%",
        maxWidth: 560,
        paddingHorizontal: 14,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 10,
          paddingTop: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 21,
              fontWeight: "700",
              color: C.ink,
              letterSpacing: 1,
            }}
          >
            {props.problem.name}
          </Text>
          <Text style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
            {props.problem.series} · {props.problem.region} ·{" "}
            {TSUMEGO_LEVEL_NAME[props.problem.level]} · 第 {props.problem.no} 题
          </Text>
        </View>
        <PressButton
          label="列表"
          testID="tsumego-list"
          onPress={props.onBack}
        />
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          height: 22,
          marginTop: 9,
          marginBottom: 4,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <StoneDot player={1} size={13} dim={complete()} />
          <Text
            style={{
              fontSize: 13.5,
              fontWeight: "600",
              color: complete() ? "#2f7a58" : C.ink,
            }}
          >
            {complete()
              ? "正解完成"
              : session().moves.length === 0
                ? "黑先，找出要点"
                : "继续：白棋已应手"}
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: C.muted }}>
          {session().moves.length} 手 · {props.problem.black.length + props.problem.white.length}{" "}
          子题面
        </Text>
      </View>

      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 4,
        }}
        onLayout={(bounds) => {
          const w = bounds.size.width;
          const h = bounds.size.height;
          const s = Math.max(0, Math.floor(Math.min(w, h, 560)));
          if (s !== boardSize()) boardSize.set(s);
        }}
      >
        <If when={boardSize() > 0}>
          <View style={{ width: boardSize(), height: boardSize() }}>
            <Board
              size={boardSize}
              n={props.problem.size}
              stars={goStars(19)}
              board={board}
              last={last}
              winLine={() => []}
              marks={marks}
              hover={() => -1}
              canPlay={canPlay}
              turn={() => 1}
              onPlay={playAt}
              setHover={() => {}}
              clearHover={() => {}}
            />
          </View>
        </If>
      </View>

      <View
        testID="tsumego-feedback"
        style={{
          minHeight: 34,
          paddingVertical: 7,
          paddingHorizontal: 11,
          borderRadius: 10,
          backgroundColor: complete()
            ? "rgba(47,122,88,0.09)"
            : wrong() >= 0
              ? "rgba(192,68,44,0.07)"
              : "rgba(58,40,22,0.045)",
          justifyContent: "center",
          marginBottom: 7,
        }}
      >
        <Text
          style={{
            fontSize: 11.5,
            lineHeight: 17,
            color: complete()
              ? "#2f7a58"
              : wrong() >= 0
                ? C.accent
                : C.muted,
          }}
        >
          {feedback() ??
            (complete()
              ? "正解完成，可以进入下一题。"
              : "点击棋盘落子。错手不会落子，也不会破坏题面。")}
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 8, paddingBottom: 10 }}>
        <PressButton
          label="提示"
          testID="tsumego-hint"
          onPress={showHint}
          disabled={complete()}
          grow
        />
        <PressButton
          label="重做"
          testID="tsumego-retry"
          onPress={restart}
          grow
        />
        <PressButton
          label="上一题"
          testID="tsumego-prev"
          onPress={props.onPrev}
          grow
        />
        <PressButton
          label="下一题"
          testID="tsumego-next"
          onPress={props.onNext}
          tone="primary"
          grow
        />
      </View>
    </View>
  );
}

/** 残局挑战入口。 */
export function Tsumego(props: {
  solved: readonly string[];
  onSolved: (id: string) => void;
  onBack: () => void;
}) {
  const selected = signal<TsumegoProblem | null>(null);

  function neighbor(dir: -1 | 1) {
    const p = selected();
    if (!p) return null;
    const at = TSUMEGO_PROBLEMS.findIndex((item) => item.id === p.id);
    if (at < 0) return TSUMEGO_PROBLEMS[0] ?? null;
    const next = (at + dir + TSUMEGO_PROBLEMS.length) % TSUMEGO_PROBLEMS.length;
    return TSUMEGO_PROBLEMS[next] ?? null;
  }

  return (
    <If when={selected()} else={<ProblemList {...props} onOpen={(p) => selected.set(p)} />}>
      {(current) => (
        <ProblemView
          problem={current()}
          solved={props.solved.includes(current().id)}
          onSolved={props.onSolved}
          onPrev={() => {
            const p = neighbor(-1);
            if (p) selected.set(p);
          }}
          onNext={() => {
            const p = neighbor(1);
            if (p) selected.set(p);
          }}
          onBack={() => selected.set(null)}
        />
      )}
    </If>
  );
}
