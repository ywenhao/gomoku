import { Text, View, effect, signal } from "nsh";
import { C, PressButton } from "./ui";
import { formatDuration, type Breakdown, type Outcome } from "../lib/score";
import type { Difficulty, Mode } from "../lib/gomoku";

const LEVEL_NAME: Record<Difficulty, string> = {
  easy: "简单",
  normal: "普通",
  hard: "困难",
  hell: "地狱",
};

/** 结算文案：按结果和星级给不同的情绪反馈 */
function flavor(
  outcome: Outcome,
  stars: number,
  scored: boolean,
  mode?: Mode,
): string {
  if (mode === "aiai") return "AI 观战对局，不计入积分。";
  if (!scored) return "本地双人对局，不计入积分。";
  if (outcome === "win") {
    if (stars >= 3) return "完美的一局，AI 全程没找到机会。";
    if (stars === 2) return "干净利落，赢得漂亮。";
    return "拿下了，不过还能更利落。";
  }
  if (outcome === "draw") return "棋盘满了，势均力敌。";
  return "就差一口气，再来一局扳回来？";
}

const STAR_ON = "#dfa03c";
const STAR_OFF = "#e2d9c9";

export function ResultPanel(props: {
  outcome: Outcome;
  title: string;
  scored: boolean;
  mode?: Mode;
  level: Difficulty;
  moves: number;
  seconds: number;
  breakdown: Breakdown;
  total: number;
  best: number;
  streak: number;
  onRestart: () => void;
  onClose: () => void;
  onSave?: () => void;
}) {
  const shown = signal(false);
  const count = signal(0);

  // 入场：挂载后下一帧切到目标样式，由 transition 完成动画
  effect(() => {
    const t = setTimeout(() => shown.set(true), 24);
    return () => clearTimeout(t);
  });

  // 分数从 0 滚到实际得分
  effect(() => {
    const target = props.breakdown.total;
    let timer: number | undefined;
    const delay = setTimeout(() => {
      const start = Date.now();
      timer = setInterval(() => {
        const k = Math.min(1, (Date.now() - start) / 680);
        const eased = 1 - Math.pow(1 - k, 3);
        count.set(Math.round(target * eased));
        if (k >= 1 && timer !== undefined) clearInterval(timer);
      }, 40);
    }, 260);
    return () => {
      clearTimeout(delay);
      if (timer !== undefined) clearInterval(timer);
    };
  });

  const win = props.outcome === "win";
  const draw = props.outcome === "draw";
  const titleColor = !props.scored
    ? C.ink
    : win
      ? C.accent
      : draw
        ? C.ink
        : "#7a6f62";
  const delta = props.breakdown.total;

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(38,28,18,0.32)",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 372,
          borderRadius: 22,
          backgroundColor: C.panel,
          borderWidth: 1,
          borderColor: C.line,
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 16,
          alignItems: "center",
          boxShadow: "0 24px 60px rgba(40,26,12,0.34)",
          backgroundImage: win
            ? "radial-gradient(circle at 50% 0%, #fff4dc 0%, #fffdf9 56%)"
            : "radial-gradient(circle at 50% 0%, #f4f1eb 0%, #fffdf9 56%)",
          opacity: shown() ? 1 : 0,
          transform: [{ scale: shown() ? 1 : 0.86 }],
          transitionProperty: "transform, opacity",
          transitionDuration: 360,
          transitionTimingFunction: "cubic-bezier(0.22, 1.2, 0.36, 1)",
        }}
      >
        {/* 星级：只在赢棋时出现，输棋不强调"零颗星" */}
        <If when={props.scored && props.outcome === "win"}>
          <View style={{ flexDirection: "row", gap: 6, height: 34 }}>
            <Each of={[0, 1, 2]} key="index">
              {(i) => (
                <Text
                  style={{
                    fontSize: 29,
                    lineHeight: 34,
                    color: props.breakdown.stars > i() ? STAR_ON : STAR_OFF,
                    opacity: shown() ? 1 : 0,
                    transform: [{ scale: shown() ? 1 : 0.35 }],
                    transitionProperty: "transform, opacity",
                    transitionDuration: 320,
                    transitionDelay: 140 + i() * 110,
                    transitionTimingFunction:
                      "cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }}
                >
                  ★
                </Text>
              )}
            </Each>
          </View>
        </If>

        <Text
          style={{
            fontSize: props.scored ? 31 : 26,
            fontWeight: "700",
            color: titleColor,
            letterSpacing: props.scored ? 6 : 2,
            marginTop: props.scored ? 8 : 4,
            marginLeft: props.scored ? 6 : 0,
          }}
        >
          {props.title}
        </Text>

        <Text
          style={{
            fontSize: 12.5,
            color: C.muted,
            marginTop: 7,
            fontVariant: ["tabular-nums"],
          }}
        >
          {LEVEL_NAME[props.level]} · {props.moves} 手 ·{" "}
          {formatDuration(props.seconds)}
        </Text>

        <Text
          style={{
            fontSize: 12.5,
            color: C.muted,
            marginTop: 9,
            textAlign: "center",
            lineHeight: 19,
          }}
        >
          {flavor(
            props.outcome,
            props.breakdown.stars,
            props.scored,
            props.mode,
          )}
        </Text>

        {/* 计分明细 */}
        <If when={props.scored && props.breakdown.lines.length > 0}>
          <View
            style={{
              width: "100%",
              marginTop: 14,
              paddingTop: 12,
              borderTopWidth: 1,
              borderColor: C.line,
              gap: 6,
            }}
          >
            <Each of={props.breakdown.lines} key={(line) => line.label}>
              {(line) => (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 13, color: C.muted }}>
                    {line().label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13.5,
                      fontWeight: "600",
                      color: line().value >= 0 ? C.ink : C.accent,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {line().value > 0 ? `+${line().value}` : `${line().value}`}
                  </Text>
                </View>
              )}
            </Each>
          </View>
        </If>

        {/* 本局得分 / 累计 */}
        <If when={props.scored}>
          <View
            style={{
              width: "100%",
              marginTop: 10,
              paddingTop: 12,
              borderTopWidth: 1,
              borderColor: C.line,
              flexDirection: "row",
              alignItems: "flex-end",
              justifyContent: "space-between",
            }}
          >
            <View>
              <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 1 }}>
                本局得分
              </Text>
              <Text
                style={{
                  fontSize: 30,
                  fontWeight: "700",
                  color: delta >= 0 ? C.ink : C.accent,
                  marginTop: 1,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {count() > 0 ? `+${count()}` : `${count()}`}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 3, paddingBottom: 3 }}>
              <Text style={{ fontSize: 12, color: C.muted }}>
                总分{" "}
                <Text style={{ color: C.ink, fontWeight: "700" }}>
                  {props.total}
                </Text>
              </Text>
              <Text style={{ fontSize: 12, color: C.muted }}>
                单局最高 {props.best}
              </Text>
            </View>
          </View>
        </If>

        {/* 连胜徽章 */}
        <If when={props.scored && props.streak >= 2}>
          <View
            style={{
              marginTop: 10,
              paddingVertical: 5,
              paddingHorizontal: 13,
              borderRadius: 20,
              backgroundColor: C.accentSoft,
              opacity: shown() ? 1 : 0,
              transform: [{ translateY: shown() ? 0 : 6 }],
              transitionProperty: "transform, opacity",
              transitionDuration: 300,
              transitionDelay: 520,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: C.accent }}>
              连续 {props.streak} 场胜利
            </Text>
          </View>
        </If>

        <If when={props.onSave !== undefined}>
          <View style={{ width: "100%", marginTop: 14 }}>
            <PressButton
              label="保存棋谱"
              hint="存进棋谱库，之后可以逐步回放"
              onPress={props.onSave!}
              testID="result-save"
              grow
            />
          </View>
        </If>

        <View
          style={{
            flexDirection: "row",
            gap: 10,
            marginTop: 16,
            width: "100%",
          }}
        >
          <PressButton
            label="看看棋盘"
            onPress={props.onClose}
            grow
            testID="result-close"
          />
          <PressButton
            label="再来一局"
            onPress={props.onRestart}
            tone="primary"
            grow
            testID="result-restart"
          />
        </View>
      </View>
    </View>
  );
}
