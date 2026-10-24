import { Scroll, Text, View, computed, effect, signal, untracked } from "nsh";
import { Board, type BoardMark } from "./Board";
import { C, PressButton } from "./ui";
import { goStars } from "../lib/go";
import {
  LEARN_TRACKS,
  findTrack,
  type LearnDiagram,
  type LearnLesson,
  type LearnTrack,
  type LearnTrackId,
} from "../lib/learn";

const TRACK_COLOR: Record<LearnTrackId, string> = {
  beginner: "#2f7a58",
  basic: "#8a6a2f",
  advanced: "#b2602e",
  dan: "#a3312a",
};

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

function Diagram(props: { diagram: LearnDiagram }) {
  const n = 9;
  const px = 202;
  const stones = props.diagram.stones;
  const board = new Array<number>(n * n).fill(0);
  for (const s of stones) {
    if (s.x >= 0 && s.x < n && s.y >= 0 && s.y < n) {
      board[s.y * n + s.x] = s.p;
    }
  }
  const marks: BoardMark[] = (props.diagram.marks ?? []).map((m) => ({
    i: m.y * n + m.x,
    label: m.label,
    tone: "accent" as const,
  }));

  return (
    <View style={{ alignItems: "center", gap: 6, marginVertical: 7 }}>
      <View
        style={{
          width: px,
          height: px,
          borderRadius: 13,
          overflow: "hidden",
          boxShadow: "0 6px 16px rgba(74,48,20,0.16)",
        }}
      >
        <Board
          size={() => px}
          n={n}
          stars={goStars(9)}
          board={() => board}
          last={() => -1}
          winLine={() => []}
          marks={() => marks}
          dead={() => []}
          hover={() => -1}
          canPlay={() => false}
          turn={() => 1}
          onPlay={() => {}}
          setHover={() => {}}
          clearHover={() => {}}
        />
      </View>
      <Text
        style={{
          fontSize: 10.5,
          lineHeight: 15,
          color: C.muted,
          textAlign: "center",
          maxWidth: 300,
        }}
      >
        {props.diagram.caption}
      </Text>
    </View>
  );
}

function TrackCard(props: {
  track: LearnTrack;
  done: number;
  selected: boolean;
  onPress: () => void;
}) {
  const total = props.track.lessons.length;
  const color = TRACK_COLOR[props.track.id];
  return (
    <View
      role="button"
      testID={`learn-track-${props.track.id}`}
      accessibilityLabel={`${props.track.name}路线`}
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      style={{
        flexGrow: 1,
        flexBasis: "45%",
        minWidth: 138,
        paddingVertical: 11,
        paddingHorizontal: 12,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: props.selected ? C.ink : C.line,
        backgroundColor: props.selected ? C.ink : C.panel,
        gap: 3,
      }}
      activeStyle={{ opacity: 0.72 }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 7,
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: "700",
            color: props.selected ? "#fdfaf3" : C.ink,
            letterSpacing: 0.6,
          }}
        >
          {props.track.name}
        </Text>
        <View
          style={{
            paddingVertical: 1,
            paddingHorizontal: 5,
            borderRadius: 5,
            backgroundColor: `${color}${props.selected ? "44" : "1c"}`,
          }}
        >
          <Text
            style={{
              fontSize: 9,
              fontWeight: "700",
              color: props.selected ? "#fdfaf3" : color,
            }}
          >
            {props.done}/{total}
          </Text>
        </View>
      </View>
      <Text
        style={{
          fontSize: 9.5,
          fontWeight: "600",
          letterSpacing: 0.5,
          color: props.selected ? "rgba(253,250,243,0.62)" : C.muted,
        }}
      >
        {props.track.range}
      </Text>
      <Text
        style={{
          fontSize: 10,
          lineHeight: 14,
          color: props.selected ? "rgba(253,250,243,0.78)" : C.muted,
        }}
      >
        {props.track.intro}
      </Text>
    </View>
  );
}

function LessonRow(props: {
  lesson: LearnLesson;
  index: number;
  done: boolean;
  onPress: () => void;
}) {
  return (
    <View
      role="button"
      testID={`learn-lesson-${props.lesson.id}`}
      accessibilityLabel={props.lesson.title}
      onPress={props.onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 11,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: C.line,
        backgroundColor: C.panel,
      }}
      activeStyle={{ opacity: 0.7 }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: props.done
            ? "rgba(47,122,88,0.12)"
            : "rgba(58,40,22,0.055)",
        }}
      >
        <Text
          style={{
            fontSize: 11.5,
            fontWeight: "700",
            color: props.done ? "#2f7a58" : C.ink,
          }}
        >
          {props.done ? "✓" : props.index + 1}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 12.5, fontWeight: "600", color: C.ink }}>
          {props.lesson.title}
        </Text>
        <Text style={{ fontSize: 10, lineHeight: 14, color: C.muted }}>
          {props.lesson.summary}
        </Text>
      </View>
      <Text style={{ fontSize: 9.5, color: C.muted }}>
        {props.lesson.minutes} 分钟
      </Text>
    </View>
  );
}

function Quiz(props: {
  lesson: LearnLesson;
  awarded: boolean;
  choice: number;
  onChoose: (i: number) => void;
}) {
  const quiz = computed(() => props.lesson.quiz);
  const right = computed(() => props.choice === quiz().answer);

  return (
    <View
      style={{
        marginTop: 18,
        padding: 13,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: C.line,
        backgroundColor: "rgba(58,40,22,0.035)",
        gap: 8,
      }}
    >
      <Text style={{ fontSize: 12.5, fontWeight: "700", color: C.ink }}>
        随堂小测
      </Text>
      <Text style={{ fontSize: 12.5, lineHeight: 19, color: C.ink }}>
        {quiz().question}
      </Text>
      <View style={{ gap: 6 }}>
        <Each of={quiz().options} key="index">
          {(option, index) => {
            const picked = computed(() => props.choice === index());
            const correct = computed(
              () => props.awarded && index() === quiz().answer,
            );
            return (
              <View
                role="button"
                testID={`learn-option-${index()}`}
                accessibilityState={{ selected: picked() }}
                onPress={() => props.onChoose(index())}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 9,
                  borderWidth: 1,
                  borderColor: correct()
                    ? "#2f7a58"
                    : picked()
                      ? C.accent
                      : C.line,
                  backgroundColor: correct()
                    ? "rgba(47,122,88,0.08)"
                    : picked()
                      ? "rgba(192,68,44,0.06)"
                      : "#fffdfa",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
                activeStyle={{ opacity: 0.7 }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: correct()
                      ? "#2f7a58"
                      : picked()
                        ? C.accent
                        : C.muted,
                    width: 14,
                  }}
                >
                  {"ABC"[index()] ?? "?"}
                </Text>
                <Text style={{ fontSize: 12, color: C.ink, flex: 1 }}>
                  {option()}
                </Text>
              </View>
            );
          }}
        </Each>
      </View>

      <If when={props.choice >= 0}>
        <View
          testID="learn-quiz-result"
          style={{
            padding: 9,
            borderRadius: 9,
            backgroundColor: right()
              ? "rgba(47,122,88,0.09)"
              : "rgba(192,68,44,0.07)",
          }}
        >
          <Text
            style={{
              fontSize: 11.5,
              lineHeight: 17,
              color: right() ? "#2f7a58" : C.accent,
            }}
          >
            {right()
              ? `答对了。${quiz().explain}`
              : "还不对，再读一遍上面的讲解，然后重选一次。"}
          </Text>
        </View>
      </If>
    </View>
  );
}

function LessonView(props: {
  track: LearnTrack;
  lesson: LearnLesson;
  index: number;
  done: boolean;
  onComplete: (id: string) => void;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const choice = signal(-1);
  const awarded = signal(props.done);

  // 切换课程时清空测验状态；完成进度从 props 里取最新值。
  let lastLesson = props.lesson.id;
  effect(() => {
    if (props.lesson.id === lastLesson) return;
    lastLesson = props.lesson.id;
    choice.set(-1);
    awarded.set(untracked(() => props.done));
  });

  function choose(i: number) {
    if (awarded()) return;
    choice.set(i);
    if (i === props.lesson.quiz.answer) {
      awarded.set(true);
      props.onComplete(props.lesson.id);
    }
  }

  return (
    <Scroll
      testID="learn-lesson-view"
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
          title={props.lesson.title}
          sub={`${props.track.name}路线 · ${props.track.range} · 约 ${props.lesson.minutes} 分钟`}
          back="课程表"
          testID="learn-lesson-back"
          onBack={props.onBack}
        />

        <View
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 13,
            backgroundColor: "rgba(58,40,22,0.045)",
          }}
        >
          <Text style={{ fontSize: 12, lineHeight: 18, color: C.muted }}>
            {props.lesson.summary}
          </Text>
        </View>

        <Each of={props.lesson.sections} key="index">
          {(section, index) => (
            <View style={{ marginTop: 16 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 7,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(192,68,44,0.09)",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: C.accent,
                    }}
                  >
                    {index() + 1}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: C.ink,
                    letterSpacing: 0.5,
                  }}
                >
                  {section().title}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 12.5,
                  lineHeight: 21,
                  color: C.muted,
                }}
              >
                {section().body}
              </Text>
              <If when={(section().bullets?.length ?? 0) > 0}>
                <View style={{ gap: 4, marginTop: 6 }}>
                  <Each of={section().bullets ?? []} key="index">
                    {(bullet) => (
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 7,
                          alignItems: "flex-start",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            lineHeight: 20,
                            color: C.accent,
                          }}
                        >
                          •
                        </Text>
                        <Text
                          style={{
                            flex: 1,
                            fontSize: 12,
                            lineHeight: 20,
                            color: C.muted,
                          }}
                        >
                          {bullet()}
                        </Text>
                      </View>
                    )}
                  </Each>
                </View>
              </If>
              <If when={section().diagram !== undefined}>
                <Diagram diagram={section().diagram!} />
              </If>
            </View>
          )}
        </Each>

        <Quiz
          lesson={props.lesson}
          awarded={awarded()}
          choice={choice()}
          onChoose={choose}
        />

        <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
          <PressButton
            label="上一课"
            testID="learn-prev-lesson"
            onPress={props.onPrev}
            disabled={props.index === 0}
            grow
          />
          <PressButton
            label={awarded() ? "下一课" : "先完成小测"}
            testID="learn-next-lesson"
            onPress={props.onNext}
            disabled={!awarded()}
            tone="primary"
            grow
          />
        </View>
        <Text
          style={{
            fontSize: 10,
            lineHeight: 16,
            color: C.muted,
            textAlign: "center",
            marginTop: 10,
          }}
        >
          完成小测才会记录课程进度；可以随时回来重读图文和重做测验。
        </Text>
      </View>
    </Scroll>
  );
}

/** 分路线的新手教程：启蒙 / 基础 / 进阶 / 段位。 */
export function Learn(props: {
  completed: readonly string[];
  onComplete: (id: string) => void;
  onBack: () => void;
}) {
  const trackId = signal<LearnTrackId>("beginner");
  const openIndex = signal<number | null>(null);
  const track = computed(() => findTrack(trackId()));
  const lesson = computed(() => {
    const at = openIndex();
    return at === null ? null : (track().lessons[at] ?? null);
  });

  function done(trackItem: LearnTrack): number {
    return trackItem.lessons.filter((l) => props.completed.includes(l.id)).length;
  }

  function go(dir: -1 | 1) {
    const at = openIndex();
    if (at === null) return;
    const next = at + dir;
    if (next < 0) return;
    if (next >= track().lessons.length) {
      openIndex.set(null);
      return;
    }
    openIndex.set(next);
  }

  return (
    <If when={lesson()} else={
      <Scroll
        testID="learn-screen"
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
            title="学棋"
            sub={`围棋新手引导 · 四条路线 · ${LEARN_TRACKS.reduce(
              (n, t) => n + t.lessons.length,
              0,
            )} 课 · 已学 ${props.completed.length} 课`}
            back="返回"
            testID="learn-back"
            onBack={props.onBack}
          />

          <Text
            style={{
              fontSize: 12,
              lineHeight: 19,
              color: C.muted,
              marginTop: 12,
              marginBottom: 10,
            }}
          >
            按段位选一条路线：从棋盘和气开始，逐步学到做活、手筋、定式、官子和复盘。
            每课都有图解、要点和一道小测，完成小测才记为学会。
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Each of={LEARN_TRACKS} key={(t) => t.id}>
              {(item) => (
                <TrackCard
                  track={item()}
                  done={done(item())}
                  selected={trackId() === item().id}
                  onPress={() => {
                    trackId.set(item().id);
                    openIndex.set(null);
                  }}
                />
              )}
            </Each>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 16,
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: C.ink }}>
              {track().name}路线 · {track().range}
            </Text>
            <Text style={{ fontSize: 10.5, color: C.muted }}>
              {done(track())} / {track().lessons.length} 完成
            </Text>
          </View>

          <View style={{ gap: 7 }}>
            <Each of={track().lessons} key={(l) => l.id}>
              {(item, index) => (
                <LessonRow
                  lesson={item()}
                  index={index()}
                  done={props.completed.includes(item().id)}
                  onPress={() => openIndex.set(index())}
                />
              )}
            </Each>
          </View>

          <Text
            style={{
              fontSize: 10,
              lineHeight: 16,
              color: C.muted,
              marginTop: 14,
            }}
          >
            推荐顺序：先把启蒙路线走完，再按基础、进阶、段位逐级推进。看不懂的课可以先跳过，
            下几盘棋、做几道残局之后再回来。
          </Text>
        </View>
      </Scroll>
    }>
      {(current) => (
        <LessonView
          track={track()}
          lesson={current()}
          index={openIndex() ?? 0}
          done={props.completed.includes(current().id)}
          onComplete={props.onComplete}
          onBack={() => openIndex.set(null)}
          onPrev={() => go(-1)}
          onNext={() => go(1)}
        />
      )}
    </If>
  );
}
