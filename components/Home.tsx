import {
  MODE_LABELS,
  GAMES,
  gameName,
  gameMeta,
  isComplexGame,
} from "../lib/catalog";
import {
  formatClock,
  sideOf,
  TIME_CONTROLS,
  timeControlSummary,
  type TimeControl,
} from "../lib/clock";
import { savedMoveCount } from "../lib/save";
import { Scroll, Text, View } from "nsh";
import { C, ConfirmButton, PressButton, Segmented, StoneDot } from "./ui";
import { formatDuration, formatStamp } from "../lib/score";
import type { Difficulty, GameKind, Mode } from "../lib/gomoku";
import type { GoSize } from "../lib/go";
import type { SavedGame } from "../lib/save";

const MODES: readonly { key: Mode; label: string }[] = [
  { key: "pve", label: MODE_LABELS.pve },
  { key: "pvp", label: "双人" },
  { key: "aiai", label: MODE_LABELS.aiai },
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

const SIZES: readonly { key: string; label: string }[] = [
  { key: "9", label: "9 路" },
  { key: "13", label: "13 路" },
  { key: "19", label: "19 路" },
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

function TimeChoice(props: {
  control: TimeControl;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <View
      role="button"
      testID={`clock-${props.control.id}`}
      accessibilityLabel={props.control.label}
      accessibilityState={{ selected: props.selected }}
      accessibilityHint={timeControlSummary(props.control)}
      onPress={props.onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: props.selected ? "#caa56d" : C.line,
        backgroundColor: props.selected ? "#fbf3e5" : C.panel,
      }}
      activeStyle={{ opacity: 0.72 }}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: 1.5,
          borderColor: props.selected ? C.accent : C.muted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <If when={props.selected}>
          <View
            style={{
              width: 9,
              height: 9,
              borderRadius: 4.5,
              backgroundColor: C.accent,
            }}
          />
        </If>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: "600", color: C.ink }}>
          {props.control.label}
        </Text>
        <Text style={{ fontSize: 11, lineHeight: 17, color: C.muted }}>
          {timeControlSummary(props.control)}
        </Text>
      </View>
      <If when={props.selected}>
        <Text style={{ color: C.accent, fontSize: 10 }}>已选</Text>
      </If>
    </View>
  );
}

function savedLabel(saved: SavedGame): string {
  const name = gameName(saved.kind);
  const who =
    saved.mode === "pve"
      ? `对战 AI · ${LEVEL_NAME[saved.level]}`
      : saved.mode === "aiai"
        ? "AI 观战"
        : "本地双人";
  const size = saved.kind === "go" ? ` · ${saved.goSize ?? 19} 路` : "";
  const clock = saved.limitOn
    ? saved.clock
      ? ` · 剩 ${formatClock(sideOf(saved.clock, saved.clock.turn), saved.clock.control)}`
      : ` · 剩 ${formatDuration(Math.max(3, Math.ceil(saved.leftMs / 1000)))}`
    : "";
  const count = savedMoveCount(saved);
  return `${name}${size} · ${who} · ${count} 手${clock}`;
}

function KindCard(props: {
  kind: GameKind;
  selected: boolean;
  title: string;
  latin: string;
  desc: string;
  onPress: () => void;
}) {
  return (
    <View
      role="button"
      testID={`seg-game-${props.kind}`}
      accessibilityLabel={props.title}
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      style={{
        flexGrow: 1,
        flexBasis: "45%",
        minWidth: 128,
        paddingVertical: 12,
        paddingHorizontal: 13,
        borderRadius: 16,
        backgroundColor: props.selected ? "#fbf3e5" : C.panel,
        borderWidth: 1,
        borderColor: props.selected ? C.accent : C.line,
        gap: 5,
        boxShadow: props.selected
          ? "0 3px 8px rgba(40,26,12,0.08)"
          : "0 1px 2px rgba(58,40,22,0.06)",
      }}
      activeStyle={{ opacity: 0.72 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <StoneDot player={1} size={15} />
        <StoneDot player={2} size={15} />
        <Text
          style={{
            fontSize: 15,
            fontWeight: "700",
            color: C.ink,
            letterSpacing: 1,
            marginLeft: 2,
          }}
        >
          {props.title}
        </Text>
      </View>
      <Text
        style={{
          fontSize: 8.5,
          fontWeight: "600",
          letterSpacing: 1.6,
          color: C.muted,
        }}
      >
        {props.latin}
      </Text>
      <Text
        style={{
          fontSize: 10.5,
          lineHeight: 15,
          color: C.muted,
        }}
      >
        {props.desc}
      </Text>
    </View>
  );
}

function Entry(props: {
  testID: string;
  title: string;
  sub: string;
  badge?: string;
  onPress: () => void;
}) {
  return (
    <View
      role="button"
      testID={props.testID}
      accessibilityLabel={props.title}
      accessibilityHint={props.sub}
      onPress={props.onPress}
      style={{
        flexGrow: 1,
        flexBasis: 0,
        minWidth: 136,
        paddingVertical: 12,
        paddingHorizontal: 13,
        borderRadius: 15,
        backgroundColor: C.panel,
        borderWidth: 1,
        borderColor: C.line,
        gap: 3,
        boxShadow: "0 1px 2px rgba(58,40,22,0.06)",
      }}
      activeStyle={{ opacity: 0.7 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text
          style={{
            fontSize: 13.5,
            fontWeight: "700",
            color: C.ink,
            letterSpacing: 0.6,
          }}
        >
          {props.title}
        </Text>
        <If when={props.badge}>
          <View
            style={{
              paddingHorizontal: 5,
              paddingVertical: 1,
              borderRadius: 5,
              backgroundColor: C.accentSoft,
            }}
          >
            <Text style={{ fontSize: 8.5, fontWeight: "700", color: C.accent }}>
              {props.badge ?? ""}
            </Text>
          </View>
        </If>
      </View>
      <Text style={{ fontSize: 10, color: C.muted, lineHeight: 14 }}>
        {props.sub}
      </Text>
    </View>
  );
}

/** 启动页：选棋类、继续或新开一局，以及残局 / 学棋 / 棋谱入口。 */
export function Home(props: {
  saved: SavedGame | null;
  kind: GameKind;
  goSize: GoSize;
  timeControl: string;
  onTimeControl: (id: string) => void;
  mode: Mode;
  level: Difficulty;
  limitOn: boolean;
  soundOn: boolean;
  score: number;
  best: number;
  win: number;
  loss: number;
  draw: number;
  recordCount: number;
  learnDone: number;
  learnTotal: number;
  tsumegoDone: number;
  tsumegoTotal: number;
  onContinue: () => void;
  onNewGame: () => void;
  onAiai: () => void;
  onKind: (kind: GameKind) => void;
  onMode: (m: Mode) => void;
  onLevel: (l: Difficulty) => void;
  onLimit: (on: boolean) => void;
  onGoSize: (size: GoSize) => void;
  onSound: () => void;
  onHelp: () => void;
  onExit: () => void;
  onTsumego: () => void;
  onLearn: () => void;
  onRecords: () => void;
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
          maxWidth: 460,
          flexGrow: 1,
          justifyContent: "center",
        }}
      >
        <View style={{ alignItems: "center", marginBottom: 16 }}>
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
            <StoneDot player={1} size={22} />
            <StoneDot player={2} size={22} />
          </View>
          <Text
            style={{
              fontSize: 33,
              fontWeight: "700",
              color: C.ink,
              letterSpacing: 8,
              marginLeft: 8,
            }}
          >
            弈境
          </Text>
          <Text
            style={{
              fontSize: 9.5,
              fontWeight: "600",
              color: C.muted,
              letterSpacing: 2.6,
              marginTop: 3,
            }}
          >
            YI JING · 八种棋类
          </Text>
          <Text style={{ fontSize: 11.5, color: C.muted, marginTop: 7 }}>
            一枰天地 · 与 AI 手谈 · 从残局与课程入门
          </Text>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Each of={GAMES}>
            {(g) => (
              <KindCard
                kind={g().kind}
                selected={props.kind === g().kind}
                title={g().name}
                latin={g().latin + " · " + g().board}
                desc={g().desc}
                onPress={() => props.onKind(g().kind)}
              />
            )}
          </Each>
        </View>

        <View
          style={{
            width: "100%",
            backgroundColor: C.panel,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: C.line,
            padding: 17,
            marginTop: 14,
            boxShadow: "0 18px 44px rgba(40,26,12,0.14)",
          }}
        >
          <If
            when={props.saved}
            else={
              <View style={{ gap: 9 }}>
                <PressButton
                  label={"开始" + gameName(props.kind)}
                  subLabel={
                    props.mode === "aiai"
                      ? "AI 对 AI · 约 2 秒一手"
                      : props.mode === "pve"
                        ? `对战 AI · ${LEVEL_NAME[props.level]}`
                        : "本地双人轮流落子"
                  }
                  hint="按下面的设置开一局"
                  tone="primary"
                  size="large"
                  testID="home-new"
                  onPress={props.onNewGame}
                />
              </View>
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
                  size="large"
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

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 9,
              marginTop: 11,
            }}
          >
            <Entry
              testID="home-aiai"
              title="AI 观战"
              sub="AI 对 AI · 可暂停、回放与保存棋谱"
              badge="观战"
              onPress={props.onAiai}
            />
            <Entry
              testID="home-tsumego"
              title="残局挑战"
              sub={
                props.kind === "chess" || props.kind === "xiangqi"
                  ? "实用残局、杀法与战术题库"
                  : `${props.tsumegoDone} / ${props.tsumegoTotal} 道已解`
              }
              badge={
                props.kind === "chess" || props.kind === "xiangqi"
                  ? gameName(props.kind)
                  : "围棋"
              }
              onPress={props.onTsumego}
            />
            <Entry
              testID="home-learn"
              title="学棋"
              sub={
                props.kind === "go"
                  ? `${props.learnDone} / ${props.learnTotal} 课 · 按段位进阶`
                  : gameMeta(props.kind).learn + " · 操作引导与测验"
              }
              onPress={props.onLearn}
            />
            <Entry
              testID="home-records"
              title="棋谱库"
              sub={`${props.recordCount} 份手动保存的棋谱`}
              onPress={props.onRecords}
            />
          </View>

          <SectionTitle text="对局设置" />
          <View style={{ gap: 11 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
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
            <If when={props.mode !== "pvp"}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <Text style={{ fontSize: 13.5, color: C.ink }}>
                  {props.mode === "aiai" ? "AI 难度（双方）" : "AI 难度"}
                </Text>
                <Segmented
                  value={() => props.level}
                  options={LEVELS}
                  onChange={props.onLevel}
                  compact
                />
              </View>
            </If>
            <If when={props.kind === "go"}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <View>
                  <Text style={{ fontSize: 13.5, color: C.ink }}>棋盘路数</Text>
                  <Text style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                    19 路为标准棋盘，9 路适合入门
                  </Text>
                </View>
                <Segmented
                  value={() => String(props.goSize)}
                  options={SIZES}
                  onChange={(k) => props.onGoSize(Number(k) as GoSize)}
                  compact
                  idPrefix="go"
                />
              </View>
            </If>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <Text style={{ fontSize: 13.5, color: C.ink }}>
                {isComplexGame(props.kind) ? "比赛棋钟" : "每回合30秒"}
              </Text>
              <Segmented
                value={() => (props.limitOn ? "on" : "off")}
                options={LIMITS}
                onChange={(k) => props.onLimit(k === "on")}
                compact
              />
            </View>
            <If when={isComplexGame(props.kind)}>
              <View style={{ gap: 6 }}>
                <Text style={{ color: C.ink, fontSize: 13 }}>
                  时间规则（新对局生效）
                </Text>
                <Each of={TIME_CONTROLS[props.kind]}>
                  {(t) => (
                    <TimeChoice
                      control={t()}
                      selected={props.timeControl === t().id}
                      onPress={() => props.onTimeControl(t().id)}
                    />
                  )}
                </Each>
                <Text style={{ color: C.muted, fontSize: 11, lineHeight: 18 }}>
                  选择的时限用于新对局；快棋、加秒与读秒的含义可在「玩法与帮助」查看。
                </Text>
              </View>
            </If>
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
            设置用于新对局；「继续游戏」沿用存档里的棋类、模式与难度。 AI
            观战由两个 AI 自动对弈，可随时暂停和逐步回看。
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
                {gameMeta(props.kind).learn}
              </Text>
            </View>
            <PressButton
              label="查看帮助"
              hint="打开规则与基础教学"
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
