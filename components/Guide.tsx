import { Scroll, Text, View, signal } from "nsh";
import { C, PressButton } from "./ui";
import { GAMES, gameName } from "../lib/catalog";
import { GUIDES } from "../lib/guides";
import type { GameKind } from "../lib/gomoku";
export function GuideStrip(props: {
  kind: GameKind;
  defaultOpen?: boolean;
  compact?: boolean;
}) {
  const step = signal(0),
    open = signal(props.defaultOpen ?? true);
  return (
    <View
      testID={`guide-${props.kind}`}
      style={{
        backgroundColor: C.panel,
        borderRadius: 12,
        padding: props.compact ? 6 : 10,
        gap: props.compact ? 4 : 6,
      }}
    >
      <View
        onPress={() => open.update((v) => !v)}
        role="button"
        testID="guide-toggle"
      >
        <Text
          style={{
            color: C.accent,
            fontSize: props.compact ? 10 : 12,
            fontWeight: "600",
          }}
        >
          操作引导 · {step() + 1}/{GUIDES[props.kind].steps.length} ·{" "}
          {open() ? "收起" : "展开"}
        </Text>
      </View>
      <If when={open()}>
        <Text
          style={{
            color: C.ink,
            fontSize: props.compact ? 11 : 12,
            lineHeight: props.compact ? 17 : 19,
          }}
        >
          {GUIDES[props.kind].steps[step()]}
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <PressButton
            label="上一步"
            disabled={step() === 0}
            onPress={() => step.update((v) => v - 1)}
            testID="guide-prev"
            size={props.compact ? "small" : "default"}
          />
          <PressButton
            label={
              step() === GUIDES[props.kind].steps.length - 1
                ? "完成引导"
                : "下一步"
            }
            testID="guide-next"
            size={props.compact ? "small" : "default"}
            onPress={() => {
              if (step() === GUIDES[props.kind].steps.length - 1)
                open.set(false);
              else step.update((v) => v + 1);
            }}
          />
        </View>
      </If>
    </View>
  );
}
export function Academy(props: {
  initial: GameKind;
  completed: string[];
  onComplete: (id: string) => void;
  onBack: () => void;
  onGoLearn: () => void;
}) {
  const kind = signal(props.initial),
    answer = signal<number | null>(null);
  return (
    <Scroll
      testID="academy-screen"
      style={{ flex: 1, width: "100%" }}
      contentStyle={{ padding: 16, alignItems: "center" }}
    >
      <View style={{ width: "100%", maxWidth: 620, gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 24, color: C.ink, fontWeight: "700" }}>
            学棋与操作引导
          </Text>
          <PressButton
            label="返回"
            testID="academy-back"
            onPress={props.onBack}
          />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Each of={GAMES}>
            {(g) => (
              <PressButton
                label={g().name}
                tone={kind() === g().kind ? "primary" : "default"}
                testID={`academy-${g().kind}`}
                onPress={() => {
                  kind.set(g().kind);
                  answer.set(null);
                }}
              />
            )}
          </Each>
        </View>
        <Text style={{ fontSize: 20, color: C.ink, fontWeight: "700" }}>
          {gameName(kind())} · 入门
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 23, color: C.ink }}>
          {GUIDES[kind()].intro}
        </Text>
        <Each of={GUIDES[kind()].steps}>
          {(text, i) => (
            <Text style={{ fontSize: 13, lineHeight: 22, color: C.muted }}>
              {i() + 1}. {text()}
            </Text>
          )}
        </Each>
        <Each of={GUIDES[kind()].rules}>
          {(r) => (
            <View
              style={{
                padding: 14,
                backgroundColor: C.panel,
                borderRadius: 14,
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 15, color: C.ink, fontWeight: "700" }}>
                {r().title}
              </Text>
              <Text style={{ fontSize: 13, color: C.muted, lineHeight: 22 }}>
                {r().text}
              </Text>
            </View>
          )}
        </Each>
        <Text style={{ fontSize: 15, color: C.ink, fontWeight: "600" }}>
          随堂练习 · {GUIDES[kind()].question}
        </Text>
        <Each of={GUIDES[kind()].options}>
          {(option, i) => (
            <PressButton
              label={option()}
              testID={`academy-option-${i()}`}
              onPress={() => {
                answer.set(i());
                if (i() === GUIDES[kind()].answer)
                  props.onComplete(`guide-${kind()}`);
              }}
            />
          )}
        </Each>
        <If when={answer() !== null}>
          <Text
            testID="academy-feedback"
            style={{
              color: answer() === GUIDES[kind()].answer ? "#347354" : C.accent,
              fontSize: 14,
              lineHeight: 22,
            }}
          >
            {answer() === GUIDES[kind()].answer
              ? "答对了，已记录学习进度。"
              : "再想一想。"}{" "}
            {GUIDES[kind()].explanation}
          </Text>
        </If>
        <If when={props.completed.includes(`guide-${kind()}`)}>
          <Text style={{ color: "#347354" }}>✓ 已完成本棋种入门</Text>
        </If>
        <If when={kind() === "go"}>
          <PressButton
            label="围棋进阶 · 四条路线21课"
            onPress={props.onGoLearn}
            testID="academy-go-advanced"
          />
        </If>
        <Text style={{ fontSize: 11, lineHeight: 19, color: C.muted }}>
          规则参考：{GUIDES[kind()].source}
        </Text>
      </View>
    </Scroll>
  );
}
