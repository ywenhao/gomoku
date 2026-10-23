import {
  batch,
  computed,
  effect,
  mount,
  signal,
  Text,
  untracked,
  View,
} from "nsh";
import { SafeAreaView } from "nsh/base";
import { keymap } from "nsh/keymap";
import { Storage } from "nsh/storage";
import { Board } from "./components/Board";
import { MenuPanel } from "./components/Menu";
import { ResultPanel } from "./components/Result";
import { C, PressButton, StoneDot } from "./components/ui";
import { fallbackMove, findBestMove, type AiChoice } from "./lib/ai";
import {
  SIZE,
  applyMove,
  boardFromMoves,
  createBoard,
  idx,
  other,
  type Difficulty,
  type GameResult,
  type Move,
  type Player,
} from "./lib/gomoku";
import {
  HISTORY_LIMIT,
  MOVE_SECONDS,
  TIMEOUT_PENALTY,
  UNDO_PENALTY,
  formatDuration,
  outcomeLabel,
  scoreGame,
  type Breakdown,
  type GameRecord,
  type Outcome,
} from "./lib/score";

const HUMAN: Player = 1;
const AI: Player = 2;
const SAVE_KEY = "gomoku.v2";
const NO_LINE: number[] = [];

type Mode = "pve" | "pvp";

const LEVEL_NAME: Record<Difficulty, string> = {
  easy: "简单",
  normal: "普通",
  hard: "困难",
};

/** 落盘的进度（分数 + 战绩 + 设置） */
interface Progress {
  score: number;
  best: number;
  streak: number;
  win: number;
  loss: number;
  draw: number;
  history: GameRecord[];
}

const EMPTY: Progress = {
  score: 0,
  best: 0,
  streak: 0,
  win: 0,
  loss: 0,
  draw: 0,
  history: [],
};

/** 一局结束时的结算快照，供结算浮层渲染 */
interface Settle {
  outcome: Outcome;
  title: string;
  scored: boolean;
  breakdown: Breakdown;
  seconds: number;
  moves: number;
  streak: number;
  total: number;
  best: number;
}

const num = (v: unknown, fallback = 0) =>
  typeof v === "number" && isFinite(v) ? v : fallback;

function readProgress(raw: string | null): Progress | null {
  if (!raw) return null;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const list = Array.isArray(data.history) ? (data.history as GameRecord[]) : [];
  return {
    score: num(data.score),
    best: num(data.best),
    streak: num(data.streak),
    win: num(data.win),
    loss: num(data.loss),
    draw: num(data.draw),
    history: list
      .filter((r) => r && typeof r.at === "number" && typeof r.outcome === "string")
      .slice(0, HISTORY_LIMIT),
  };
}

function App() {
  /* ---------------------------- 状态 ---------------------------- */
  const board = signal<number[]>(createBoard());
  const moves = signal<Move[]>([]);
  const turn = signal<Player>(1);
  const over = signal<GameResult | null>(null);
  const mode = signal<Mode>("pve");
  const level = signal<Difficulty>("normal");
  const thinking = signal(false);
  const hover = signal(-1);
  /** 每次重置/悔棋自增，用来作废正在进行的 AI 计算 */
  const round = signal(0);
  const boardSize = signal(0);

  const progress = signal<Progress>(EMPTY);
  const limitOn = signal(true);
  const leftMs = signal(MOVE_SECONDS * 1000);
  const undos = signal(0);
  const timeouts = signal(0);
  const startedAt = signal(0);

  const menu = signal(false);
  const settle = signal<Settle | null>(null);
  const resultOpen = signal(false);
  const notice = signal<string | null>(null);
  const loaded = signal(false);

  /* ---------------------------- 派生 ---------------------------- */
  const lastIndex = computed(() => {
    const m = moves();
    if (m.length === 0) return -1;
    const last = m[m.length - 1];
    return idx(last.x, last.y);
  });

  const winLine = computed(() => {
    const o = over();
    return o && o.kind === "win" ? o.line : NO_LINE;
  });

  const canPlay = computed(
    () =>
      over() === null &&
      !thinking() &&
      !menu() &&
      !resultOpen() &&
      (mode() === "pvp" || turn() === HUMAN),
  );

  /** 是否该给人倒计时（AI 回合、终局、关闭限时都不计时） */
  const timed = computed(
    () =>
      limitOn() &&
      over() === null &&
      (mode() === "pvp" || turn() === HUMAN),
  );

  const secondsLeft = computed(() => Math.max(0, Math.ceil(leftMs() / 1000)));
  const timeRatio = computed(() =>
    over() !== null
      ? 0
      : Math.max(0, Math.min(1, leftMs() / (MOVE_SECONDS * 1000))),
  );
  const lowTime = computed(() => timed() && secondsLeft() <= 8);

  const statusText = computed(() => {
    const o = over();
    if (o) {
      if (o.kind === "draw") return "和棋";
      return o.winner === 1 ? "黑棋获胜" : "白棋获胜";
    }
    if (mode() === "pve") {
      if (turn() === AI) return thinking() ? "AI 思考中…" : "AI 落子";
      return "轮到你落子";
    }
    return turn() === 1 ? "黑棋落子" : "白棋落子";
  });

  /* ---------------------------- 动作 ---------------------------- */
  function flash(text: string) {
    notice.set(text);
  }

  /** 结算：算分、写战绩、弹结算浮层 */
  function finish(r: GameResult, count: number) {
    const pve = mode() === "pve";
    const outcome: Outcome =
      r.kind === "draw" ? "draw" : r.winner === HUMAN ? "win" : "loss";
    const start = startedAt();
    const seconds = Math.max(
      1,
      Math.round((Date.now() - (start > 0 ? start : Date.now() - 1000)) / 1000),
    );

    const prev = progress();
    const streak = pve
      ? outcome === "win"
        ? prev.streak + 1
        : 0
      : prev.streak;

    const breakdown: Breakdown = pve
      ? scoreGame({
          outcome,
          level: level(),
          moves: count,
          seconds,
          undos: undos(),
          timeouts: timeouts(),
          streak,
        })
      : { lines: [], total: 0, stars: 0 };

    const delta = breakdown.total;
    // 总分为负会让"分数"变得没意义，扣到底就停在 0
    const total = pve ? Math.max(0, prev.score + delta) : prev.score;
    const best = pve ? Math.max(prev.best, delta) : prev.best;
    const record: GameRecord = {
      at: Date.now(),
      outcome,
      level: level(),
      mode: mode(),
      moves: count,
      seconds,
      delta,
      stars: breakdown.stars,
    };
    const history = [record, ...prev.history].slice(0, HISTORY_LIMIT);

    const next: Progress = {
      score: total,
      best,
      streak,
      win: prev.win + (outcome === "win" ? 1 : 0),
      loss: prev.loss + (outcome === "loss" ? 1 : 0),
      draw: prev.draw + (outcome === "draw" ? 1 : 0),
      history,
    };

    const title = pve
      ? outcomeLabel(outcome)
      : r.kind === "draw"
        ? "和棋"
        : r.winner === 1
          ? "黑棋获胜"
          : "白棋获胜";

    batch(() => {
      progress.set(next);
      settle.set({
        outcome,
        title,
        scored: pve,
        breakdown,
        seconds,
        moves: count,
        streak,
        total,
        best,
      });
      menu.set(false);
      resultOpen.set(true);
    });
  }

  function commit(x: number, y: number, p: Player) {
    const i = idx(x, y);
    if (board()[i] !== 0) return;
    if (over() !== null) return;
    if (moves().length === 0) startedAt.set(Date.now());

    const res = applyMove(board(), moves(), { x, y, p });
    batch(() => {
      board.set(res.board);
      moves.set(res.moves);
      hover.set(-1);
      if (res.result) {
        over.set(res.result);
        thinking.set(false);
      } else {
        turn.set(other(p));
      }
    });
    if (res.result) finish(res.result, res.moves.length);
  }

  function playAt(i: number) {
    if (!canPlay()) return;
    if (board()[i] !== 0) return;
    const x = i % SIZE;
    commit(x, (i - x) / SIZE, turn());
  }

  function reset() {
    batch(() => {
      round.update((n) => n + 1);
      board.set(createBoard());
      moves.set([]);
      turn.set(1);
      over.set(null);
      thinking.set(false);
      hover.set(-1);
      undos.set(0);
      timeouts.set(0);
      startedAt.set(0);
      leftMs.set(MOVE_SECONDS * 1000);
      settle.set(null);
      resultOpen.set(false);
      notice.set(null);
    });
  }

  function undo() {
    if (over() !== null) return;
    const m = moves();
    if (m.length === 0) return;
    const drop =
      mode() === "pve" && m[m.length - 1].p === AI && m.length >= 2 ? 2 : 1;
    const kept = m.slice(0, Math.max(0, m.length - drop));
    batch(() => {
      round.update((n) => n + 1);
      moves.set(kept);
      board.set(boardFromMoves(kept));
      over.set(null);
      thinking.set(false);
      hover.set(-1);
      turn.set(kept.length % 2 === 0 ? 1 : 2);
      undos.update((n) => n + 1);
      leftMs.set(MOVE_SECONDS * 1000);
      if (kept.length === 0) startedAt.set(0);
    });
    flash(mode() === "pve" ? `悔棋 −${UNDO_PENALTY} 分` : "已悔棋");
  }

  /** 超时：替玩家落一手（就近的弱手），并计入超时扣分 */
  function timeoutMove() {
    const p = turn();
    let spot: AiChoice | null = null;
    try {
      spot = fallbackMove(board());
    } catch {
      spot = null;
    }
    if (!spot) {
      const b = board();
      for (let i = 0; i < b.length; i++) {
        if (b[i] === 0) {
          spot = { x: i % SIZE, y: (i - (i % SIZE)) / SIZE };
          break;
        }
      }
    }
    if (!spot) return;
    timeouts.update((n) => n + 1);
    flash(
      mode() === "pve"
        ? `超时 · 已替你落子 −${TIMEOUT_PENALTY} 分`
        : "超时 · 已替你落子",
    );
    commit(spot.x, spot.y, p);
  }

  function switchMode(next: Mode) {
    if (mode() === next) return;
    batch(() => {
      mode.set(next);
      reset();
    });
  }

  function switchLevel(next: Difficulty) {
    if (level() === next) return;
    level.set(next);
    flash(`难度：${LEVEL_NAME[next]}`);
  }

  function switchLimit(on: boolean) {
    if (limitOn() === on) return;
    limitOn.set(on);
    leftMs.set(MOVE_SECONDS * 1000);
  }

  function clearHistory() {
    batch(() => {
      progress.set({ ...EMPTY, history: [] });
      flash("战绩已清空");
    });
  }

  /* ---------------------------- 副作用 ---------------------------- */
  // 读取存档（分数、战绩、设置）
  effect(() => {
    Storage.getItem(SAVE_KEY)
      .then((raw) => {
        const saved = readProgress(raw);
        batch(() => {
          if (saved) progress.set(saved);
          try {
            const meta = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
            const lv = meta.level;
            if (lv === "easy" || lv === "normal" || lv === "hard") {
              level.set(lv);
            }
            const md = meta.mode;
            if (md === "pve" || md === "pvp") mode.set(md);
            if (typeof meta.limitOn === "boolean") limitOn.set(meta.limitOn);
          } catch {
            /* 存档损坏时忽略设置，沿用默认值 */
          }
          loaded.set(true);
        });
      })
      .catch(() => loaded.set(true));
  });

  // 写存档：只在加载完成后写，避免开局用默认值覆盖旧记录
  effect(() => {
    const p = progress();
    const lv = level();
    const md = mode();
    const lim = limitOn();
    if (!loaded()) return;
    Storage.setItem(
      SAVE_KEY,
      JSON.stringify({ ...p, level: lv, mode: md, limitOn: lim }),
    ).catch(() => {});
  });

  // 落子倒计时：菜单打开时暂停，回来后接着走，不会靠开关菜单刷新时间
  let deadline = 0;
  let pausedLeft = 0;
  effect(() => {
    const active = timed();
    const paused = menu() || resultOpen();
    const r = round();

    if (!active) {
      deadline = 0;
      pausedLeft = 0;
      leftMs.set(MOVE_SECONDS * 1000);
      return;
    }

    if (paused) {
      pausedLeft =
        deadline > 0
          ? Math.max(0, deadline - Date.now())
          : untracked(() => leftMs());
      deadline = 0;
      return;
    }

    const start = pausedLeft > 0 ? pausedLeft : MOVE_SECONDS * 1000;
    pausedLeft = 0;
    deadline = Date.now() + start;
    leftMs.set(start);

    const timer = setInterval(() => {
      const left = deadline - Date.now();
      if (left > 0) {
        leftMs.set(left);
        return;
      }
      clearInterval(timer);
      leftMs.set(0);
      if (untracked(() => round()) !== r) return;
      if (untracked(() => over()) !== null) return;
      if (!untracked(() => timed())) return;
      timeoutMove();
    }, 100);
    return () => clearInterval(timer);
  });

  // AI 落子：思考放在定时器里，重置/悔棋会作废旧任务
  effect(() => {
    const r = round();
    const m = mode();
    const t = turn();
    const o = over();
    const lv = level();

    if (m !== "pve" || o !== null || t !== AI) {
      thinking.set(false);
      return;
    }

    thinking.set(true);
    const timer = setTimeout(() => {
      if (untracked(() => round()) !== r) return;
      if (untracked(() => over()) !== null) return;
      if (untracked(() => turn()) !== AI) return;

      let choice: AiChoice | null = null;
      try {
        choice = findBestMove(untracked(() => board()), AI, lv);
      } catch {
        choice = null;
      }
      if (!choice) {
        // 极端情况下的兜底，保证对局不会卡住
        try {
          choice = fallbackMove(untracked(() => board()));
        } catch {
          choice = null;
        }
      }

      if (untracked(() => round()) !== r) return;
      if (untracked(() => over()) !== null) return;
      thinking.set(false);

      if (choice) {
        const i = idx(choice.x, choice.y);
        if (untracked(() => board())[i] === 0) commit(choice.x, choice.y, AI);
      }
    }, 110);

    return () => clearTimeout(timer);
  });

  // 提示条自动消失
  effect(() => {
    const n = notice();
    if (n === null) return;
    const t = setTimeout(() => {
      if (untracked(() => notice()) === n) notice.set(null);
    }, 1700);
    return () => clearTimeout(t);
  });

  // 桌面端快捷键
  effect(() => {
    return keymap.bind({
      u: () => {
        if (!menu() && !resultOpen()) undo();
      },
      r: () => {
        if (!menu()) reset();
      },
      m: () => menu.update((v) => !v),
      escape: () => {
        if (menu()) menu.set(false);
        else if (resultOpen()) resultOpen.set(false);
      },
    });
  });

  /* ---------------------------- 界面 ---------------------------- */
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, alignItems: "center", backgroundColor: C.bg }}>
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 540,
            paddingHorizontal: 14,
          }}
        >
          {/* 标题栏 */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              justifyContent: "space-between",
              paddingTop: 12,
            }}
          >
            <View>
              <Text
                style={{
                  fontSize: 25,
                  fontWeight: "700",
                  color: C.ink,
                  letterSpacing: 2,
                }}
              >
                五子棋
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "600",
                  color: C.muted,
                  letterSpacing: 2.2,
                  marginTop: 3,
                }}
              >
                {mode() === "pve"
                  ? `人机 · ${LEVEL_NAME[level()]}`
                  : "本地双人"}{" "}
                · 15 × 15
              </Text>
            </View>
            <PressButton
              label="菜单"
              testID="open-menu"
              onPress={() => menu.set(true)}
            />
          </View>

          {/* 状态条 */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 12,
              marginBottom: 6,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <StoneDot player={turn()} size={13} dim={over() !== null} />
              <Text style={{ fontSize: 14.5, fontWeight: "600", color: C.ink }}>
                {statusText()}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 12,
                color: C.muted,
                fontVariant: ["tabular-nums"],
              }}
            >
              {moves().length} 手 · {progress().score} 分
            </Text>
          </View>

          {/* 倒计时 */}
          <If when={limitOn()}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                height: 16,
                marginBottom: 4,
                opacity: timed() ? 1 : 0.32,
              }}
            >
              <View
                style={{
                  flex: 1,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: "rgba(58,40,22,0.10)",
                  overflow: "hidden",
                }}
              >
                <View
                  testID="timer-fill"
                  style={{
                    width: `${Math.max(0, Math.min(100, (timeRatio() * 1000) / 10))}%`,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: lowTime() ? C.accent : "#c8a250",
                  }}
                />
              </View>
              <Text
                testID="timer-text"
                style={{
                  fontSize: 11.5,
                  fontWeight: "700",
                  color: lowTime() ? C.accent : C.muted,
                  fontVariant: ["tabular-nums"],
                  width: 30,
                  textAlign: "right",
                }}
              >
                {over() !== null ? "—" : formatDuration(secondsLeft())}
              </Text>
            </View>
          </If>

          {/* 棋盘 */}
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 6,
            }}
            onLayout={(bounds) => {
              const w = bounds.size.width;
              const h = bounds.size.height;
              const s = Math.max(0, Math.floor(Math.min(w, h, 620)));
              if (s !== boardSize()) boardSize.set(s);
            }}
          >
            <If when={boardSize() > 0}>
              <View style={{ width: boardSize(), height: boardSize() }}>
                <Board
                  size={boardSize}
                  board={board}
                  last={lastIndex}
                  winLine={winLine}
                  hover={hover}
                  canPlay={canPlay}
                  turn={turn}
                  onPlay={playAt}
                  setHover={(i) => hover.set(i)}
                  clearHover={(i) => {
                    if (hover() === i) hover.set(-1);
                  }}
                />

                {/* 轻提示：悔棋 / 超时 / 换难度 */}
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 0,
                    right: 0,
                    alignItems: "center",
                    opacity: notice() === null ? 0 : 1,
                    transform: [
                      { translateY: notice() === null ? -6 : 0 },
                    ],
                    transitionProperty: "transform, opacity",
                    transitionDuration: 220,
                  }}
                >
                  <View
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 14,
                      borderRadius: 16,
                      backgroundColor: "rgba(43,36,28,0.9)",
                      boxShadow: "0 6px 16px rgba(40,26,12,0.26)",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12.5,
                        fontWeight: "600",
                        color: "#fdfaf3",
                      }}
                    >
                      {notice() ?? ""}
                    </Text>
                  </View>
                </View>
              </View>
            </If>
          </View>

          {/* 底部操作 */}
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              paddingTop: 6,
              paddingBottom: 10,
            }}
          >
            <PressButton
              label="悔棋"
              hint={`撤销上一步，扣 ${UNDO_PENALTY} 分`}
              testID="undo"
              onPress={undo}
              disabled={moves().length === 0 || over() !== null}
              grow
            />
            <PressButton
              label="重新开始"
              hint="清空棋盘，黑棋先行"
              testID="restart"
              onPress={reset}
              tone="primary"
              grow
            />
          </View>
        </View>
      </View>

      {/* 菜单 */}
      <If when={menu()}>
        <MenuPanel
          score={progress().score}
          best={progress().best}
          streak={progress().streak}
          win={progress().win}
          loss={progress().loss}
          draw={progress().draw}
          history={progress().history}
          mode={mode()}
          level={level()}
          limitOn={limitOn()}
          onMode={switchMode}
          onLevel={switchLevel}
          onLimit={switchLimit}
          onClear={clearHistory}
          onClose={() => menu.set(false)}
        />
      </If>

      {/* 结算 */}
      <If when={resultOpen() && settle() !== null}>
        <ResultPanel
          outcome={settle()!.outcome}
          title={settle()!.title}
          scored={settle()!.scored}
          level={level()}
          moves={settle()!.moves}
          seconds={settle()!.seconds}
          breakdown={settle()!.breakdown}
          total={settle()!.total}
          best={settle()!.best}
          streak={settle()!.streak}
          onClose={() => resultOpen.set(false)}
          onRestart={reset}
        />
      </If>
    </SafeAreaView>
  );
}

mount(App);
