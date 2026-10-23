import { Scroll, Text, View, effect, signal } from "nsh";
import { windowSize } from "nsh/device";
import { C, PressButton, Segmented } from "./ui";
import { formatDuration, formatStamp, type GameRecord } from "../lib/score";
import type { Difficulty } from "../lib/gomoku";

type Mode = "pve" | "pvp";

const MODES: readonly { key: Mode; label: string }[] = [
  { key: "pve", label: "人机" },
  { key: "pvp", label: "双人" },
];

const LEVELS: readonly { key: Difficulty; label: string }[] = [
  { key: "easy", label: "简单" },
  { key: "normal", label: "普通" },
  { key: "hard", label: "困难" },
];

const LIMITS: readonly { key: string; label: string }[] = [
  { key: "on", label: "开" },
  { key: "off", label: "关" },
];

const LEVEL_NAME: Record<Difficulty, string> = {
  easy: "简单",
  normal: "普通",
  hard: "困难",
};

function SectionTitle(props: { text: string }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: "600",
        color: C.muted,
        letterSpacing: 2,
        marginTop: 18,
        marginBottom: 8,
      }}
    >
      {props.text}
    </Text>
  );
}

function StatCell(props: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text
        style={{
          fontSize: 19,
          fontWeight: "700",
          color: props.accent ? C.accent : C.ink,
          fontVariant: ["tabular-nums"],
        }}
      >
        {props.value}
      </Text>
      <Text style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>
        {props.label}
      </Text>
    </View>
  );
}

const OUTCOME_TEXT: Record<string, string> = {
  win: "胜",
  loss: "负",
  draw: "和",
};

const OUTCOME_COLOR: Record<string, string> = {
  win: "#2f7a58",
  loss: C.accent,
  draw: "#8d8173",
};

export function MenuPanel(props: {
  score: number;
  best: number;
  streak: number;
  win: number;
  loss: number;
  draw: number;
  history: GameRecord[];
  mode: Mode;
  level: Difficulty;
  limitOn: boolean;
  onMode: (m: Mode) => void;
  onLevel: (l: Difficulty) => void;
  onLimit: (on: boolean) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const confirming = signal(false);

  // 4 秒内没有再点一次就取消确认，避免误触清空
  effect(() => {
    if (!confirming()) return;
    const t = setTimeout(() => confirming.set(false), 4000);
    return () => clearTimeout(t);
  });

  const maxHeight = Math.max(280, Math.min(600, windowSize().height - 72));
  const total = props.win + props.loss + props.draw;

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(38,28,18,0.38)",
        }}
        onPress={props.onClose}
      />

      <Scroll
        testID="menu-panel"
        style={{
          width: "100%",
          maxWidth: 400,
          maxHeight,
          backgroundColor: C.panel,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: C.line,
          boxShadow: "0 24px 60px rgba(40,26,12,0.34)",
        }}
        contentStyle={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text style={{ fontSize: 19, fontWeight: "700", color: C.ink }}>
              菜单
            </Text>
            <Text
              style={{
                fontSize: 9.5,
                fontWeight: "600",
                color: C.muted,
                letterSpacing: 2.2,
                marginTop: 2,
              }}
            >
              GOMOKU · 15 × 15
            </Text>
          </View>
          <View
            role="button"
            testID="menu-close"
            accessibilityLabel="关闭菜单"
            onPress={props.onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(58,40,22,0.06)",
            }}
            activeStyle={{ opacity: 0.6 }}
          >
            <Text style={{ fontSize: 20, color: C.muted, lineHeight: 22 }}>
              ×
            </Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            marginTop: 14,
            paddingVertical: 12,
            borderRadius: 14,
            backgroundColor: "rgba(58,40,22,0.045)",
          }}
        >
          <StatCell label="总分" value={`${props.score}`} accent />
          <StatCell label="单局最高" value={`${props.best}`} />
          <StatCell label="连胜" value={`${props.streak}`} />
        </View>

        <Text
          style={{
            fontSize: 11.5,
            color: C.muted,
            marginTop: 8,
            textAlign: "center",
          }}
        >
          共 {total} 局 · {props.win} 胜 {props.loss} 负 {props.draw} 和
        </Text>

        <SectionTitle text="设置" />
        <View style={{ gap: 11 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ fontSize: 13.5, color: C.ink }}>对战模式</Text>
            <Segmented
              value={() => props.mode}
              options={MODES}
              onChange={props.onMode}
              compact
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ fontSize: 13.5, color: C.ink }}>AI 难度</Text>
            <Segmented
              value={() => props.level}
              options={LEVELS}
              onChange={props.onLevel}
              compact
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ fontSize: 13.5, color: C.ink }}>
              限时落子 30 秒
            </Text>
            <Segmented
              value={() => (props.limitOn ? "on" : "off")}
              options={LIMITS}
              onChange={(k) => props.onLimit(k === "on")}
              compact
            />
          </View>
        </View>

        <SectionTitle text={`历史战绩（${props.history.length} 局）`} />
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: C.line,
            backgroundColor: "#fffdfa",
            padding: 6,
            gap: 4,
          }}
        >
          {props.history.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <Text style={{ fontSize: 12.5, color: C.muted }}>
                还没有对局记录，先下几局吧
              </Text>
            </View>
          ) : (
            <Each of={props.history} key={(r, i) => `${r.at}-${i}`}>
              {(item, index) => (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 6,
                    paddingHorizontal: 6,
                    borderRadius: 9,
                    backgroundColor:
                      index() % 2 === 0
                        ? "rgba(58,40,22,0.035)"
                        : "transparent",
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: `${OUTCOME_COLOR[item().outcome]}1f`,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: OUTCOME_COLOR[item().outcome],
                      }}
                    >
                      {OUTCOME_TEXT[item().outcome]}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: C.ink }}>
                      {LEVEL_NAME[item().level]} · {item().moves} 手 ·{" "}
                      {formatDuration(item().seconds)}
                      {item().mode === "pvp" ? " · 双人" : ""}
                    </Text>
                    <Text
                      style={{ fontSize: 10, color: C.muted, marginTop: 1 }}
                    >
                      {formatStamp(item().at)}
                      {item().stars > 0 ? ` · ${"★".repeat(item().stars)}` : ""}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color:
                        item().delta > 0
                          ? "#2f7a58"
                          : item().delta < 0
                            ? C.accent
                            : C.muted,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {item().delta > 0
                      ? `+${item().delta}`
                      : item().delta === 0
                        ? "—"
                        : `${item().delta}`}
                  </Text>
                </View>
              )}
            </Each>
          )}
        </View>

        <View style={{ marginTop: 14 }}>
          <PressButton
            label={confirming() ? "再点一次，确认清空" : "清空全部记录"}
            testID="clear-history"
            onPress={() => {
              if (!confirming()) {
                confirming.set(true);
                return;
              }
              confirming.set(false);
              props.onClear();
            }}
            grow
          />
        </View>

        <Text
          style={{
            fontSize: 10.5,
            color: C.muted,
            marginTop: 12,
            lineHeight: 17,
          }}
        >
          计分：胜利基础分随难度（100 / 180 / 300），另加速度、效率与连胜奖励；
          悔棋 −15、超时 −10。清空记录会同时重置总分、最高分与连胜。
        </Text>
      </Scroll>
    </View>
  );
}
