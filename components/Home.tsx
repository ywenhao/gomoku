import { Scroll, Text, View } from "nsh";
import { C, ConfirmButton, PressButton, Segmented, StoneDot } from "./ui";
import { formatDuration, formatStamp } from "../lib/score";
import type { Difficulty, Mode } from "../lib/gomoku";
import type { SavedGame } from "../lib/save";

const MODES: readonly { key: Mode; label: string }[] = [
  { key: "pve", label: "人机" },
  { key: "pvp", label: "双人" },
];

const LEVELS: readonly { key: Difficulty; label: string }[] = [
  { key: "easy", label: "简单" },
  { key: "normal", label: "普通" },
  { key: "hard", label: "困难" },
  { key: "hell", label: "地狱" },
];

const LIMITS: readonly { key: string; label: string }[] = [
  { key: "on", label: "开" },
  { key: "off", label: "关" },
];

const LEVEL_NAME: Record<Difficulty, string> = {
  easy: "简单",
  normal: "普通",
  hard: "困难",
  hell: "地狱",
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

function savedLabel(saved: SavedGame): string {
  const who =
    saved.mode === "pve" ? `人机 · ${LEVEL_NAME[saved.level]}` : "本地双人";
  const clock = saved.limitOn
    ? ` · 剩 ${formatDuration(Math.max(3, Math.ceil(saved.leftMs / 1000)))}`
    : "";
  return `${who} · ${saved.moves.length} 手${clock}`;
}

/** 启动页 / 游戏菜单：继续、新对局、设置、声音、退出。 */
export function Home(props: {
  saved: SavedGame | null;
  score: number;
  best: number;
  win: number;
  loss: number;
  draw: number;
  mode: Mode;
  level: Difficulty;
  limitOn: boolean;
  soundOn: boolean;
  onContinue: () => void;
  onNewGame: () => void;
  onMode: (m: Mode) => void;
  onLevel: (l: Difficulty) => void;
  onLimit: (on: boolean) => void;
  onSound: () => void;
  onHelp: () => void;
  onExit: () => void;
}) {
  return (
    <Scroll
      testID="home-screen"
      style={{ flex: 1, width: "100%" }}
      contentStyle={{
        flexGrow: 1,
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 20,
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 440,
          flexGrow: 1,
          justifyContent: "center",
        }}
      >
        <View style={{ alignItems: "center", marginBottom: 18 }}>
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
            <StoneDot player={1} size={23} />
            <StoneDot player={2} size={23} />
          </View>
          <Text
            style={{
              fontSize: 31,
              fontWeight: "700",
              color: C.ink,
              letterSpacing: 4,
              marginLeft: 4,
            }}
          >
            五子棋
          </Text>
          <Text
            style={{
              fontSize: 9.5,
              fontWeight: "600",
              color: C.muted,
              letterSpacing: 2.4,
              marginTop: 4,
            }}
          >
            GOMOKU · 15 × 15
          </Text>
          <Text style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>
            落子无悔 · 五连即胜
          </Text>
        </View>

        <View
          style={{
            width: "100%",
            backgroundColor: C.panel,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: C.line,
            padding: 18,
            boxShadow: "0 18px 44px rgba(40,26,12,0.14)",
          }}
        >
          <If
            when={props.saved}
            else={
              <PressButton
                label="开始新对局"
                hint="按下面的设置开一局"
                tone="primary"
                testID="home-new"
                onPress={props.onNewGame}
              />
            }
          >
            {(saved) => (
              <View style={{ gap: 10 }}>
                <View
                  testID="home-saved"
                  style={{
                    paddingVertical: 11,
                    paddingHorizontal: 13,
                    borderRadius: 14,
                    backgroundColor: "rgba(58,40,22,0.045)",
                    gap: 3,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "600",
                      color: C.accent,
                      letterSpacing: 1.4,
                    }}
                  >
                    上一局还没下完
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: C.ink,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {savedLabel(saved())}
                  </Text>
                  <Text style={{ fontSize: 10.5, color: C.muted }}>
                    保存于 {formatStamp(saved().savedAt)}
                  </Text>
                </View>
                <PressButton
                  label="继续游戏"
                  subLabel={savedLabel(saved())}
                  hint="恢复到上次退出的棋盘"
                  tone="primary"
                  testID="home-continue"
                  onPress={props.onContinue}
                />
                <PressButton
                  label="开始新对局"
                  hint="按下面的设置开一局，并放弃上一局存档"
                  testID="home-new"
                  onPress={props.onNewGame}
                />
              </View>
            )}
          </If>

          <SectionTitle text="对战设置" />
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
            <If when={props.mode === "pve"}>
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
            </If>
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
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View>
                <Text style={{ fontSize: 13.5, color: C.ink }}>声音</Text>
                <Text style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                  落子、倒计时与结算音效
                </Text>
              </View>
              <PressButton
                label={props.soundOn ? "开" : "关"}
                hint={props.soundOn ? "关闭声音" : "打开声音"}
                testID="home-sound"
                onPress={props.onSound}
              />
            </View>
          </View>
          <Text
            style={{
              fontSize: 10.5,
              color: C.muted,
              marginTop: 11,
              lineHeight: 17,
            }}
          >
            设置用于新对局；「继续游戏」沿用存档里的模式与难度。
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginTop: 14,
              paddingTop: 13,
              borderTopWidth: 1,
              borderColor: C.line,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: C.ink }}>玩法与帮助</Text>
              <Text style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                规则、棋型、开局布局与攻防顺序
              </Text>
            </View>
            <PressButton
              label="查看帮助"
              hint="打开五子棋规则与基础教学"
              testID="home-help"
              onPress={props.onHelp}
            />
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: C.line,
              marginTop: 16,
              marginBottom: 13,
            }}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 11, color: C.muted }}>
              总分{" "}
              <Text style={{ color: C.ink, fontWeight: "700" }}>
                {props.score}
              </Text>{" "}
              · 单局最高{" "}
              <Text style={{ color: C.ink, fontWeight: "700" }}>
                {props.best}
              </Text>
            </Text>
            <Text
              style={{
                fontSize: 11,
                color: C.muted,
                fontVariant: ["tabular-nums"],
              }}
            >
              {props.win} 胜 {props.loss} 负 {props.draw} 和
            </Text>
          </View>

          <ConfirmButton
            label="退出游戏"
            confirmLabel="再点一次，确认退出"
            hint="保存当前对局并关闭应用"
            testID="home-exit"
            onConfirm={props.onExit}
          />
        </View>

        <Text
          style={{
            fontSize: 10,
            color: C.muted,
            textAlign: "center",
            marginTop: 14,
            lineHeight: 16,
          }}
        >
          退出或被关闭前会自动保存对局，下次进来点「继续游戏」接着下。
        </Text>
      </View>
    </Scroll>
  );
}
