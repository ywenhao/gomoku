import {
  Scroll,
  Text,
  View,
  computed,
  effect,
  signal,
  untracked,
} from "nsh";
import { Board } from "./Board";
import { C, ConfirmButton, PressButton } from "./ui";
import { recordMoveCount, type StoredRecord } from "../lib/records";
import { boardFromMoves, type Difficulty } from "../lib/gomoku";
import { createGoBoard, goStars, goStateFromMoves } from "../lib/go";
import { formatStamp } from "../lib/score";

const LEVEL_NAME: Record<Difficulty, string> = {
  easy: "简单",
  normal: "普通",
  hard: "困难",
  hell: "地狱",
};

const MODE_NAME = {
  pve: "人机",
  pvp: "本地双人",
  aiai: "人机大战",
} as const;

function Header(props: {
  title: string;
  sub: string;
  back: string;
  testID: string;
  onBack: () => void;
}) {
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
      <PressButton
        label={props.back}
        testID={props.testID}
        onPress={props.onBack}
      />
    </View>
  );
}

function RecordRow(props: { record: StoredRecord; onOpen: () => void }) {
  const go = props.record.game === "go";
  const count = recordMoveCount(props.record);
  return (
    <View
      role="button"
      testID={`record-open-${props.record.id}`}
      accessibilityLabel={props.record.name}
      onPress={props.onOpen}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: C.line,
        backgroundColor: C.panel,
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
          backgroundColor: go ? "rgba(47,122,88,0.10)" : "rgba(58,40,22,0.06)",
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: go ? "#2f7a58" : C.ink,
          }}
        >
          {go ? "围" : "五"}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 12.5, fontWeight: "600", color: C.ink }}>
          {props.record.name}
        </Text>
        <Text style={{ fontSize: 10, color: C.muted }}>
          {MODE_NAME[props.record.mode]} · {LEVEL_NAME[props.record.level]} ·{" "}
          {go ? `${props.record.goSize ?? 19} 路 · ` : ""}
          {count} 手 · {formatStamp(props.record.savedAt)}
        </Text>
      </View>
      <Text style={{ fontSize: 11, color: C.muted }}>查看 ›</Text>
    </View>
  );
}

function RecordView(props: {
  record: StoredRecord;
  onBack: () => void;
  onDelete: () => void;
}) {
  const total = recordMoveCount(props.record);
  const step = signal(total);
  const playing = signal(false);
  const boardSize = signal(0);
  const go = props.record.game === "go";
  const size = (props.record.goSize ?? 19) as 9 | 13 | 19;

  // 切换到另一份棋谱时回到终局
  let lastId = props.record.id;
  effect(() => {
    if (props.record.id === lastId) return;
    lastId = props.record.id;
    step.set(recordMoveCount(untracked(() => props.record)));
    playing.set(false);
  });

  const goView = computed(() => {
    const at = Math.max(0, Math.min(step(), total));
    return (props.record.goMoves ?? []).slice(0, at);
  });
  const gomokuView = computed(() => {
    const at = Math.max(0, Math.min(step(), total));
    return props.record.moves.slice(0, at);
  });

  const board = computed(() => {
    if (go) {
      const state = goStateFromMoves(size, goView());
      return state?.board ?? createGoBoard(size);
    }
    return boardFromMoves(gomokuView());
  });

  const last = computed(() => {
    if (go) {
      const list = goView();
      const m = list[list.length - 1];
      return !m || m.pass ? -1 : m.y * size + m.x;
    }
    const list = gomokuView();
    const m = list[list.length - 1];
    return m ? m.y * 15 + m.x : -1;
  });

  const next = computed(() => {
    const list = go ? (props.record.goMoves ?? []) : props.record.moves;
    const at = step();
    const m = list[at];
    if (!m) return null;
    return (m as { p: 1 | 2 }).p === 1 ? 2 : 1;
  });

  effect(() => {
    if (!playing()) return;
    const timer = setInterval(() => {
      const at = untracked(() => step());
      const all = untracked(() => total);
      if (at >= all) {
        playing.set(false);
        return;
      }
      step.set(at + 1);
    }, 520);
    return () => clearInterval(timer);
  });

  function togglePlay() {
    if (playing()) {
      playing.set(false);
      return;
    }
    if (step() >= total) step.set(0);
    playing.set(true);
  }

  return (
    <View
      testID="record-view"
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
              fontSize: 20,
              fontWeight: "700",
              color: C.ink,
              letterSpacing: 1,
            }}
          >
            {props.record.name}
          </Text>
          <Text style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
            {MODE_NAME[props.record.mode]} · {LEVEL_NAME[props.record.level]} ·{" "}
            {go ? `${size} 路 · ` : "15 路 · "}
            {total} 手
            {props.record.result ? ` · ${props.record.result}` : ""}
          </Text>
        </View>
        <PressButton label="列表" testID="record-back" onPress={props.onBack} />
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
        <Text
          style={{
            fontSize: 12.5,
            fontWeight: "600",
            color: playing() ? "#2f7a58" : C.ink,
          }}
        >
          {playing()
            ? "自动回放中…"
            : step() === total
              ? "终局局面"
              : `回看第 ${step()} / ${total} 手`}
        </Text>
        <Text style={{ fontSize: 11, color: C.muted }}>
          {step() < total
            ? `下一手：${next() === 1 ? "黑棋" : "白棋"}`
            : formatStamp(props.record.savedAt)}
        </Text>
      </View>

      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 5,
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
              n={go ? size : 15}
              stars={go ? goStars(size) : undefined}
              board={board}
              last={last}
              winLine={() => []}
              hover={() => -1}
              canPlay={() => false}
              turn={() => next() ?? 1}
              onPlay={() => {}}
              setHover={() => {}}
              clearHover={() => {}}
            />
          </View>
        </If>
      </View>

      <View style={{ flexDirection: "row", gap: 7, paddingBottom: 5 }}>
        <PressButton
          label="起点"
          testID="record-first"
          onPress={() => {
            playing.set(false);
            step.set(0);
          }}
          disabled={step() === 0}
          grow
        />
        <PressButton
          label="上一步"
          testID="record-prev"
          onPress={() => {
            playing.set(false);
            step.set(Math.max(0, step() - 1));
          }}
          disabled={step() === 0}
          grow
        />
        <PressButton
          label={playing() ? "暂停" : "播放"}
          testID="record-play"
          onPress={togglePlay}
          tone="primary"
          grow
        />
        <PressButton
          label="下一步"
          testID="record-next"
          onPress={() => {
            playing.set(false);
            step.set(Math.min(total, step() + 1));
          }}
          disabled={step() >= total}
          grow
        />
        <PressButton
          label="终点"
          testID="record-last"
          onPress={() => {
            playing.set(false);
            step.set(total);
          }}
          disabled={step() >= total}
          grow
        />
      </View>

      <View style={{ paddingBottom: 10 }}>
        <ConfirmButton
          label="删除这份棋谱"
          confirmLabel="再点一次，确认删除"
          testID="record-delete"
          onConfirm={props.onDelete}
        />
      </View>
    </View>
  );
}

/** 棋谱库：手动保存的五子棋 / 围棋整局棋，逐步或自动回放。 */
export function Records(props: {
  records: readonly StoredRecord[];
  onDelete: (id: string) => void;
  onBack: () => void;
}) {
  const selectedId = signal<string | null>(null);
  const selected = computed(
    () => props.records.find((r) => r.id === selectedId()) ?? null,
  );

  return (
    <If when={selected()} else={
      <Scroll
        testID="records-screen"
        style={{ flex: 1, width: "100%" }}
        contentStyle={{
          flexGrow: 1,
          alignItems: "center",
          paddingHorizontal: 14,
          paddingBottom: 26,
        }}
      >
        <View style={{ width: "100%", maxWidth: 560 }}>
          <Header
            title="棋谱库"
            sub={`手动保存的整局棋 · ${props.records.length} 份`}
            back="返回"
            testID="records-back"
            onBack={props.onBack}
          />

          <Text
            style={{
              fontSize: 11.5,
              lineHeight: 18,
              color: C.muted,
              marginTop: 12,
              marginBottom: 10,
            }}
          >
            对局菜单和人机大战控制栏都能保存棋谱。保存的是完整手顺，可以逐步回看、自动播放，
            也可以在这里删除。棋谱与「继续游戏」互不影响。
          </Text>

          {props.records.length === 0 ? (
            <View
              style={{
                paddingVertical: 44,
                alignItems: "center",
                borderRadius: 15,
                borderWidth: 1,
                borderColor: C.line,
                backgroundColor: C.panel,
                gap: 5,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: C.ink }}>
                还没有保存的棋谱
              </Text>
              <Text style={{ fontSize: 11, color: C.muted }}>
                下完一局后打开菜单，点「保存棋谱」。
              </Text>
            </View>
          ) : (
            <View style={{ gap: 7 }}>
              <Each of={props.records} key={(r) => r.id}>
                {(item) => (
                  <RecordRow
                    record={item()}
                    onOpen={() => selectedId.set(item().id)}
                  />
                )}
              </Each>
            </View>
          )}

          <Text
            style={{
              fontSize: 10,
              lineHeight: 16,
              color: C.muted,
              marginTop: 14,
            }}
          >
            棋谱保存在本机 storage 中，最多保留 60 份；删除后无法恢复。
          </Text>
        </View>
      </Scroll>
    }>
      {(current) => (
        <RecordView
          record={current()}
          onBack={() => selectedId.set(null)}
          onDelete={() => {
            props.onDelete(current().id);
            selectedId.set(null);
          }}
        />
      )}
    </If>
  );
}
