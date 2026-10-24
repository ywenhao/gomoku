import {
  batch,
  computed,
  effect,
  signal,
  Text,
  untracked,
  View,
  type Accessor,
} from "nsh";
import { GuideStrip } from "./Guide";
import {
  createClock,
  restoreClock,
  findTimeControl,
  clockAfterMove,
  tickClock,
  formatClock,
  remainingMs,
  sideOf,
} from "../lib/clock";
import { Board } from "./Board";
import { MenuPanel } from "./Menu";
import { C, PressButton, StoneDot } from "./ui";
import {
  GO_KOMI,
  createGoBoard,
  goOther,
  goResultText,
  goStars,
  goGroup,
  goStateFromMoves,
  playGo,
  scoreGo,
  type GoMove,
  type GoScoreDetail,
  type GoSize,
} from "../lib/go";
import { fallbackGoMove, findGoMove } from "../lib/go-ai";
import {
  MOVE_SECONDS,
  formatDuration,
  type GameRecord,
  type Outcome,
} from "../lib/score";
import type { Difficulty, Mode, Player } from "../lib/gomoku";
import type { RecordInput } from "../lib/records";
import type { SavedGame } from "../lib/save";
import type { SoundName } from "../lib/sound";

export interface GoFinish {
  result: string;
  outcome: Outcome;
  moves: number;
  seconds: number;
  undos?: number;
  timeouts?: number;
}

const NO_LINE: number[] = [];

const LEVEL_NAME: Record<Difficulty, string> = {
  easy: "简单",
  normal: "普通",
  hard: "困难",
  hell: "地狱",
};

const MODE_NAME: Record<Mode, string> = {
  pve: "人机",
  pvp: "本地双人",
  aiai: "人机大战",
};

/** 围棋对局。从 App 挂载时一次性初始化，之后自己管理棋盘与 AI。 */
export function GoGame(props: {
  initial: SavedGame | null;
  timeControl: string;
  mode: Mode;
  level: Difficulty;
  limitOn: boolean;
  goSize: GoSize;
  soundOn: boolean;
  helpOpen: boolean;
  score: number;
  best: number;
  streak: number;
  win: number;
  loss: number;
  draw: number;
  history: GameRecord[];
  onSnapshot: (game: SavedGame | null) => void;
  onFinish: (finish: GoFinish) => void;
  onRecord: (record: RecordInput) => void;
  onHome: () => void;
  onExit: () => void;
  onHelp: () => void;
  onClear: () => void;
  onSound: () => void;
  onMode: (mode: Mode) => void;
  onLevel: (level: Difficulty) => void;
  onLimit: (on: boolean) => void;
  onGoSize: (size: GoSize) => void;
  playSound: (name: SoundName) => void;
}) {
  const initialGame =
    props.initial && props.initial.kind === "go" ? props.initial : null;
  const initialSize = (initialGame?.goSize ?? props.goSize) as GoSize;
  const initial =
    initialGame && initialGame.goMoves
      ? goStateFromMoves(initialSize, initialGame.goMoves)
      : null;

  const size = signal<GoSize>(initialSize);
  const moves = signal<GoMove[]>(initial?.moves ?? []);
  const board = signal<number[]>(initial?.board ?? createGoBoard(initialSize));
  const ko = signal(initial?.ko ?? -1);
  const passes = signal(initial?.passes ?? 0);
  const captures = signal<{ 1: number; 2: number }>(
    initial?.captures ?? { 1: 0, 2: 0 },
  );

  const mode = signal<Mode>(initialGame?.mode ?? props.mode);
  const level = signal<Difficulty>(initialGame?.level ?? props.level);
  const limitOn = signal<boolean>(initialGame?.limitOn ?? props.limitOn);

  const paused = signal(initialGame?.scoring ?? false);
  const thinking = signal(false);
  const scoring = signal(initialGame?.scoring ?? false);
  const over = signal<GoScoreDetail | null>(null);
  const resultOpen = signal(false);
  const resultSeconds = signal(0);
  const dead = signal<number[]>(initialGame?.dead ?? []);
  const deadMode = signal(false);
  const menu = signal(false);
  const notice = signal<string | null>(null);
  const reviewAt = signal<number | null>(null);
  const replaying = signal(false);
  const round = signal(0);

  const undos = signal(initialGame?.undos ?? 0);
  const timeouts = signal(initialGame?.timeouts ?? 0);
  const startedAt = signal(initialGame?.startedAt ?? 0);
  const leftMs = signal(
    Math.max(
      3000,
      Math.min(MOVE_SECONDS * 1000, initialGame?.leftMs ?? MOVE_SECONDS * 1000),
    ),
  );
  const boardSize = signal(0);
  const control = findTimeControl(
    "go",
    initialGame?.timeControl ?? props.timeControl,
  );
  const clock = signal(
    restoreClock(
      "go",
      initialGame?.clock,
      initial?.moves.length && initial.moves.length % 2 ? 2 : 1,
    ) ??
      createClock(
        control,
        initial?.moves.length && initial.moves.length % 2 ? 2 : 1,
      ),
  );
  const positions = signal(initial?.positions ?? [board().join("")]);

  const turn = computed<Player>(() => {
    const list = moves();
    return list.length === 0 ? 1 : goOther(list[list.length - 1].p);
  });

  const canPlay = computed(
    () =>
      over() === null &&
      !scoring() &&
      !paused() &&
      !thinking() &&
      !menu() &&
      !props.helpOpen &&
      !resultOpen() &&
      reviewAt() === null &&
      !replaying() &&
      (mode() === "pvp" || (mode() === "pve" && turn() === 1)),
  );

  const timed = computed(
    () =>
      limitOn() &&
      mode() !== "aiai" &&
      over() === null &&
      !scoring() &&
      !paused() &&
      !resultOpen() &&
      reviewAt() === null &&
      !menu() &&
      !props.helpOpen &&
      !replaying(),
  );

  const secondsLeft = computed(() => Math.max(0, Math.ceil(leftMs() / 1000)));
  const timeRatio = computed(() =>
    over() !== null
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            leftMs() /
              (sideOf(clock(), clock().turn).mainMs > 0
                ? control.mainMs
                : control.byoyomiMs),
          ),
        ),
  );

  const viewMoves = computed(() => {
    const at = reviewAt();
    if (at === null) return moves();
    return moves().slice(0, Math.max(0, Math.min(at, moves().length)));
  });

  const viewed = computed(() =>
    reviewAt() === null ? null : goStateFromMoves(size(), viewMoves()),
  );

  const viewBoard = computed(() => viewed()?.board ?? board());
  const viewLast = computed(() => {
    const list = viewMoves();
    const last = list[list.length - 1];
    return last && !last.pass ? last.y * size() + last.x : -1;
  });

  const scoreDetail = computed(() => scoreGo(board(), size(), dead(), GO_KOMI));

  const moveCount = computed(() => moves().length);
  const lastMove = computed(() => {
    const list = moves();
    const last = list[list.length - 1];
    return last && !last.pass ? last.y * size() + last.x : -1;
  });

  const statusText = computed(() => {
    const result = over();
    if (result) return goResultText(result);
    if (scoring()) {
      return deadMode() ? "点击死子进行标记" : "数子阶段：确认死子后结算";
    }
    if (mode() === "aiai") {
      if (paused()) return "人机大战已暂停";
      if (thinking()) return "AI 思考中…";
      return turn() === 1 ? "黑方 AI 落子" : "白方 AI 落子";
    }
    if (mode() === "pve") {
      if (turn() === 1) return "轮到你落子";
      return thinking() ? "AI 思考中…" : "AI 落子";
    }
    return turn() === 1 ? "黑棋落子" : "白棋落子";
  });

  /* ---------------------------- 动作 ---------------------------- */

  function flash(text: string) {
    notice.set(text);
  }

  function applyState(list: GoMove[]) {
    const state = goStateFromMoves(size(), list);
    if (!state) return;
    batch(() => {
      moves.set(state.moves);
      board.set(state.board);
      ko.set(state.ko);
      passes.set(state.passes);
      positions.set(state.positions);
      clock.update((c) => ({
        ...c,
        turn: state.moves.length % 2 ? 2 : 1,
        lastAt: Date.now(),
      }));
      captures.set(state.captures);
    });
  }

  function reset() {
    batch(() => {
      round.update((n) => n + 1);
      moves.set([]);
      board.set(createGoBoard(size()));
      ko.set(-1);
      passes.set(0);
      captures.set({ 1: 0, 2: 0 });
      paused.set(false);
      thinking.set(false);
      scoring.set(false);
      over.set(null);
      resultOpen.set(false);
      dead.set([]);
      deadMode.set(false);
      notice.set(null);
      reviewAt.set(null);
      replaying.set(false);
      undos.set(0);
      timeouts.set(0);
      startedAt.set(0);
      leftMs.set(MOVE_SECONDS * 1000);
      menu.set(false);
      clock.set(createClock(control));
      positions.set([createGoBoard(size()).join("")]);
    });
  }

  function enterScoring() {
    batch(() => {
      scoring.set(true);
      paused.set(true);
      dead.set([]);
      deadMode.set(false);
      reviewAt.set(null);
      replaying.set(false);
    });
    flash("双方连续虚手，进入数子");
  }

  function commit(x: number, y: number) {
    const p = turn();
    if (board()[y * size() + x] !== 0) return;
    const r = playGo(board(), size(), x, y, p, ko());
    if (!r.ok) {
      flash(
        r.reason === "ko"
          ? "打劫：不能立即回提"
          : r.reason === "suicide"
            ? "禁入点：这手棋没有气"
            : "这里已经有棋子",
      );
      return;
    }
    if (positions().includes(r.board.join(""))) {
      flash("全局同形再现：请选择其他落点");
      return;
    }
    if (!advanceClock(p)) return;
    const at = moves().length;
    batch(() => {
      positions.update((v) => v.concat([r.board.join("")]));
      if (at === 0) startedAt.set(Date.now());
      moves.update((list) => list.concat([{ x, y, p, pass: false }]));
      board.set(r.board);
      ko.set(r.ko);
      passes.set(0);
      captures.update((c) => ({
        ...c,
        [p]: c[p] + r.captured.length,
      }));
      reviewAt.set(null);
      replaying.set(false);
    });
    props.playSound("place");
  }

  function doPass() {
    const p = turn();
    if (!advanceClock(p)) return;
    const nextPasses = passes() + 1;
    batch(() => {
      if (moves().length === 0) startedAt.set(Date.now());
      moves.update((list) => list.concat([{ x: -1, y: -1, p, pass: true }]));
      ko.set(-1);
      passes.set(nextPasses);
      reviewAt.set(null);
      replaying.set(false);
    });
    props.playSound("place");
    flash(p === 1 ? "黑棋虚手" : "白棋虚手");
    if (nextPasses >= 2) enterScoring();
  }

  function pass() {
    if (!canPlay()) return;
    doPass();
  }

  function timeoutLoss(p: Player) {
    if (over()) return;
    timeouts.update((n) => n + 1);
    props.playSound("timeout");
    const detail = {
      ...scoreGo(board(), size(), [], GO_KOMI),
      winner: goOther(p),
      reason: "超时判负",
    };
    const seconds = Math.max(
      1,
      Math.round((Date.now() - (startedAt() || Date.now())) / 1000),
    );
    batch(() => {
      over.set(detail);
      paused.set(true);
      resultOpen.set(true);
      resultSeconds.set(seconds);
      scoring.set(false);
    });
    props.onFinish({
      result: goResultText(detail),
      outcome: mode() === "pve" ? (p === 1 ? "loss" : "win") : "draw",
      moves: moves().length,
      undos: undos(),
      timeouts: timeouts(),
      seconds,
    });
  }
  function advanceClock(p: Player): boolean {
    if (!limitOn() || mode() === "aiai") {
      clock.update((c) => ({ ...c, turn: goOther(p), lastAt: Date.now() }));
      return true;
    }
    const r = clockAfterMove(clock(), p, Date.now());
    clock.set(r.clock);
    if (r.timeout !== null) {
      timeoutLoss(r.timeout);
      return false;
    }
    return true;
  }

  function playAt(i: number) {
    if (scoring()) {
      if (deadMode()) {
        if (board()[i] === 0) return;
        const group = goGroup(board(), size(), i)?.stones ?? [i];
        dead.update((list) =>
          list.includes(i)
            ? list.filter((x) => !group.includes(x))
            : [...new Set(list.concat(group))],
        );
        return;
      }
      flash("请先标记死子，或确认数子");
      return;
    }
    if (!canPlay()) return;
    const x = i % size();
    const y = (i - x) / size();
    if (board()[i] !== 0) return;
    commit(x, y);
  }

  function undo() {
    if (over() !== null || scoring()) return;
    const list = moves();
    if (list.length === 0) return;
    const last = list[list.length - 1];
    const drop = mode() === "pve" && last.p === 2 && list.length >= 2 ? 2 : 1;
    const kept = list.slice(0, Math.max(0, list.length - drop));
    batch(() => {
      round.update((n) => n + 1);
      applyState(kept);
      over.set(null);
      scoring.set(false);
      resultOpen.set(false);
      paused.set(false);
      thinking.set(false);
      reviewAt.set(null);
      replaying.set(false);
      undos.update((n) => n + 1);
      leftMs.set(MOVE_SECONDS * 1000);
      if (kept.length === 0) startedAt.set(0);
    });
    flash(mode() === "pve" ? "已退回上一手" : "已悔棋");
  }

  function resumeAfterScore() {
    const list = moves();
    const kept =
      list.length >= 2 &&
      list[list.length - 1].pass &&
      list[list.length - 2].pass
        ? list.slice(0, -2)
        : list;
    batch(() => {
      scoring.set(false);
      over.set(null);
      resultOpen.set(false);
      dead.set([]);
      deadMode.set(false);
      paused.set(false);
      applyState(kept);
    });
    flash("继续对弈");
  }

  function confirmScore() {
    if (over() !== null) return;
    const detail = scoreDetail();
    const seconds = Math.max(
      1,
      Math.round(
        (Date.now() - (startedAt() > 0 ? startedAt() : Date.now() - 1000)) /
          1000,
      ),
    );
    const outcome: Outcome =
      mode() === "pve"
        ? detail.winner === 1
          ? "win"
          : detail.winner === 2
            ? "loss"
            : "draw"
        : "draw";
    batch(() => {
      scoring.set(false);
      paused.set(true);
      over.set(detail);
      resultSeconds.set(seconds);
      resultOpen.set(true);
    });
    props.onFinish({
      result: goResultText(detail),
      outcome,
      moves: moves().length,
      undos: undos(),
      timeouts: timeouts(),
      seconds,
    });
    props.playSound(
      detail.winner === 2 && mode() === "pve"
        ? "loss"
        : detail.winner === 0
          ? "draw"
          : "win",
    );
  }

  function changeMode(next: Mode) {
    if (mode() === next) return;
    props.onMode(next);
    batch(() => {
      mode.set(next);
      reset();
    });
  }

  function changeLevel(next: Difficulty) {
    if (level() === next) return;
    level.set(next);
    props.onLevel(next);
    flash(`难度：${LEVEL_NAME[next]}`);
  }

  function changeLimit(on: boolean) {
    if (limitOn() === on) return;
    limitOn.set(on);
    props.onLimit(on);
    leftMs.set(MOVE_SECONDS * 1000);
  }

  function changeSize(next: GoSize) {
    if (size() === next) return;
    props.onGoSize(next);
    batch(() => {
      size.set(next);
      reset();
    });
    flash(`棋盘：${next} 路`);
  }

  function togglePause() {
    if (over() !== null || scoring()) return;
    if (paused()) {
      batch(() => {
        paused.set(false);
        reviewAt.set(null);
        replaying.set(false);
      });
    } else {
      batch(() => {
        paused.set(true);
        thinking.set(false);
      });
    }
  }

  function stepBack() {
    const list = moves();
    if (list.length === 0) return;
    replaying.set(false);
    paused.set(true);
    const at = reviewAt() === null ? list.length : reviewAt()!;
    reviewAt.set(Math.max(0, at - 1));
  }

  function stepForward() {
    const list = moves();
    const at = reviewAt();
    if (at === null) return;
    replaying.set(false);
    paused.set(true);
    reviewAt.set(Math.min(list.length, at + 1));
  }

  function startReplay() {
    const list = moves();
    if (list.length < 2) {
      flash("至少两手才能回放");
      return;
    }
    batch(() => {
      paused.set(true);
      reviewAt.set(0);
      replaying.set(true);
      menu.set(false);
    });
  }

  function saveRecord() {
    if (moves().length === 0) {
      flash("还没有落子，无法保存");
      return;
    }
    const result = over() ? goResultText(over()!) : undefined;
    props.onRecord({
      game: "go",
      mode: mode(),
      level: level(),
      goSize: size(),
      goMoves: moves(),
      result,
    });
    flash("棋谱已保存到棋谱库");
  }

  function snapshot(): SavedGame | null {
    const list = moves();
    if (list.length === 0 || over() !== null) return null;
    return {
      kind: "go",
      moves: [],
      goMoves: list,
      goSize: size(),
      mode: mode(),
      level: level(),
      limitOn: limitOn(),
      leftMs: untracked(() => leftMs()),
      undos: undos(),
      timeouts: timeouts(),
      startedAt: startedAt(),
      savedAt: Date.now(),
      clock: untracked(() => clock()),
      timeControl: control.id,
      scoring: scoring(),
      dead: dead(),
    };
  }

  /* ---------------------------- 副作用 ---------------------------- */

  // 每次落子 / 虚手 / 设置变化后同步存档；App 负责写 storage 与首页的继续入口。
  effect(() => {
    const game = snapshot();
    props.onSnapshot(game);
  });

  // 倒计时期间每 5 秒刷新一次剩余时间，进程被杀时少丢一点。
  effect(() => {
    if (moves().length === 0 || over() !== null || scoring()) return;
    const timer = setInterval(() => {
      props.onSnapshot(untracked(snapshot));
    }, 5000);
    return () => clearInterval(timer);
  });

  // AI 落子：人机模式执白，人机大战双方都由 AI 走。
  effect(() => {
    const md = mode();
    const t = turn();
    const result = over();
    const scoringNow = scoring();
    const pausedNow = paused();
    const review = reviewAt();
    const replay = replaying();
    const menuNow = menu();
    const help = props.helpOpen;
    const aiTurn = md === "aiai" || (md === "pve" && t === 2);

    if (
      !aiTurn ||
      result !== null ||
      scoringNow ||
      pausedNow ||
      review !== null ||
      replay ||
      menuNow ||
      help
    ) {
      thinking.set(false);
      return;
    }

    thinking.set(true);
    const r = round();
    const delay = md === "aiai" ? 1900 : 240;
    const timer = setTimeout(() => {
      if (untracked(() => round()) !== r) return;
      if (untracked(() => over()) !== null) return;
      if (untracked(() => scoring())) return;
      if (untracked(() => paused())) return;
      if (untracked(() => reviewAt()) !== null) return;
      if (untracked(() => replaying())) return;
      if (untracked(() => menu())) return;
      if (untracked(() => props.helpOpen)) return;

      // 人机大战下到很晚仍无胜负时，主动虚手结束，避免无限对局。
      if (
        md === "aiai" &&
        untracked(() => moves().length) > size() * size() * 1.5
      ) {
        thinking.set(false);
        untracked(doPass);
        return;
      }

      let choice: { x: number; y: number; pass: boolean } | null = null;
      try {
        choice = findGoMove(
          untracked(() => board()),
          untracked(() => size()),
          untracked(() => turn()),
          untracked(() => level()),
          untracked(() => ko()),
          { deadlineMs: md === "aiai" ? 900 : 1250 },
        );
      } catch {
        choice = null;
      }
      if (
        !choice ||
        (!choice.pass &&
          !playGo(
            untracked(() => board()),
            untracked(() => size()),
            choice.x,
            choice.y,
            untracked(() => turn()),
            untracked(() => ko()),
          ).ok)
      ) {
        try {
          choice = fallbackGoMove(
            untracked(() => board()),
            untracked(() => size()),
            untracked(() => turn()),
            untracked(() => ko()),
          );
        } catch {
          choice = null;
        }
      }

      if (untracked(() => round()) !== r) return;
      if (untracked(() => over()) !== null) return;
      if (untracked(() => paused())) return;
      if (untracked(() => reviewAt()) !== null) return;
      if (untracked(() => menu())) return;
      thinking.set(false);

      if (choice && !choice.pass) {
        const chosen = playGo(
          untracked(board),
          untracked(size),
          choice.x,
          choice.y,
          untracked(turn),
          untracked(ko),
        );
        if (
          !chosen.ok ||
          untracked(positions).includes(chosen.board.join(""))
        ) {
          choice = null;
          for (let i = 0; i < untracked(board).length; i++) {
            if (untracked(board)[i]) continue;
            const trial = playGo(
              untracked(board),
              untracked(size),
              i % untracked(size),
              Math.floor(i / untracked(size)),
              untracked(turn),
              untracked(ko),
            );
            if (
              trial.ok &&
              !untracked(positions).includes(trial.board.join(""))
            ) {
              choice = {
                x: i % untracked(size),
                y: Math.floor(i / untracked(size)),
                pass: false,
              };
              break;
            }
          }
        }
      }
      if (!choice || choice.pass) {
        untracked(doPass);
      } else {
        untracked(() => commit(choice!.x, choice!.y));
      }
    }, delay);

    return () => clearTimeout(timer);
  });

  // 回放：每隔 650ms 自动前进一手，到末尾自动停。
  effect(() => {
    if (!replaying()) return;
    const timer = setInterval(() => {
      const at = untracked(() => reviewAt());
      if (at === null) {
        replaying.set(false);
        return;
      }
      const total = untracked(() => moves().length);
      if (at >= total) {
        replaying.set(false);
        return;
      }
      reviewAt.set(at + 1);
    }, 650);
    return () => clearInterval(timer);
  });

  // Both sides spend their own time, including AI. Local overlays pause without resetting it.
  effect(() => {
    const active = timed();
    untracked(() => clock.update((c) => ({ ...c, lastAt: Date.now() })));
    if (!active) return;
    const timer = setInterval(
      () =>
        untracked(() => {
          const r = tickClock(clock(), Date.now());
          clock.set(r.clock);
          leftMs.set(remainingMs(sideOf(r.clock, r.clock.turn)));
          if (r.timeout !== null) timeoutLoss(r.timeout);
        }),
      100,
    );
    return () => {
      clearInterval(timer);
      untracked(() => {
        const r = tickClock(clock(), Date.now());
        clock.set(r.clock);
        leftMs.set(remainingMs(sideOf(r.clock, r.clock.turn)));
        if (r.timeout !== null && over() === null) timeoutLoss(r.timeout);
      });
    };
  });

  // 轻提示自动消失
  effect(() => {
    const n = notice();
    if (n === null) return;
    const t = setTimeout(() => {
      if (untracked(() => notice()) === n) notice.set(null);
    }, 1900);
    return () => clearTimeout(t);
  });

  const lastIndex = computed(() =>
    reviewAt() === null ? lastMove() : viewLast(),
  );

  /* ---------------------------- 界面 ---------------------------- */
  return (
    <View
      style={{
        flex: 1,
        width: "100%",
        maxWidth: 560,
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
            围棋
          </Text>
          <Text
            style={{
              fontSize: 10,
              fontWeight: "600",
              color: C.muted,
              letterSpacing: 1.8,
              marginTop: 3,
            }}
          >
            {MODE_NAME[mode()]} · {LEVEL_NAME[level()]} · {size()} 路 · 贴{" "}
            {GO_KOMI} 点
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
          height: 22,
          marginTop: 12,
          marginBottom: 6,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <StoneDot player={turn()} size={13} dim={over() !== null} />
          <Text
            style={{
              fontSize: 14.5,
              lineHeight: 20,
              fontWeight: "600",
              color: C.ink,
            }}
          >
            {statusText()}
          </Text>
        </View>
        <Text
          style={{
            fontSize: 11.5,
            lineHeight: 16,
            color: C.muted,
            fontVariant: ["tabular-nums"],
          }}
        >
          {moveCount()} 手 · 提子 {captures()[1]}/{captures()[2]}
        </Text>
      </View>

      <GuideStrip kind="go" />
      <If when={limitOn() && mode() !== "aiai"}>
        <View style={{ flexDirection: "row", gap: 12, marginVertical: 6 }}>
          <Text testID="go-clock-black" style={{ color: C.ink, fontSize: 14 }}>
            黑 {formatClock(clock().p1, control)}
          </Text>
          <Text testID="go-clock-white" style={{ color: C.ink, fontSize: 14 }}>
            白 {formatClock(clock().p2, control)}
          </Text>
        </View>
      </If>
      {/* 倒计时 */}
      <If when={limitOn() && mode() !== "aiai"}>
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
            testID={secondsLeft() <= 5 ? "timer-urgent" : "timer-track"}
            style={{
              flex: 1,
              height: 7,
              borderRadius: 4,
              borderWidth: 1,
              borderColor:
                secondsLeft() <= 5 && timed() ? C.accent : "transparent",
              backgroundColor: "rgba(58,40,22,0.10)",
              overflow: "hidden",
            }}
          >
            <View
              testID="timer-fill"
              style={{
                width: `${Math.max(0, Math.min(100, timeRatio() * 100))}%`,
                height: 5,
                borderRadius: 3,
                backgroundColor:
                  secondsLeft() <= 5 && timed() ? C.accent : "#c8a250",
              }}
            />
          </View>
          <Text
            testID="timer-text"
            style={{
              fontSize: 11.5,
              fontWeight: "700",
              color: secondsLeft() <= 5 && timed() ? C.accent : C.muted,
              fontVariant: ["tabular-nums"],
              width: 30,
              textAlign: "right",
            }}
          >
            {over() !== null ? "—" : formatDuration(secondsLeft())}
          </Text>
        </View>
      </If>

      {/* 回放 / 暂停提示 */}
      <If when={reviewAt() !== null}>
        <View
          style={{
            marginBottom: 4,
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: 8,
            backgroundColor: "rgba(192,68,44,0.08)",
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ fontSize: 10.5, color: C.accent, fontWeight: "600" }}>
            {replaying() ? "整局回放中" : "回看模式"} · 第 {reviewAt() ?? 0} /{" "}
            {moveCount()} 手
          </Text>
          <Text style={{ fontSize: 10.5, color: C.muted }}>
            点「继续」回到当前局面
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
              n={size()}
              stars={goStars(size())}
              board={viewBoard}
              last={lastIndex}
              winLine={() => NO_LINE}
              dead={dead}
              hover={() => -1}
              canPlay={canPlay}
              turn={turn}
              onPlay={playAt}
              setHover={() => {}}
              clearHover={() => {}}
            />

            {/* 轻提示 */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 10,
                left: 0,
                right: 0,
                alignItems: "center",
                opacity: notice() === null ? 0 : 1,
                transform: [{ translateY: notice() === null ? -6 : 0 }],
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

      {/* 数子面板 */}
      <If when={scoring()}>
        <View
          testID="go-scoring"
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "rgba(192,68,44,0.24)",
            backgroundColor: "rgba(192,68,44,0.055)",
            padding: 11,
            gap: 7,
            marginBottom: 6,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: C.ink }}>
              数子（白贴 {GO_KOMI} 点）
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: C.muted,
                fontVariant: ["tabular-nums"],
              }}
            >
              黑 {scoreDetail().blackArea.toFixed(1)} · 白{" "}
              {scoreDetail().whiteArea.toFixed(1)}
            </Text>
          </View>
          <Text style={{ fontSize: 10.5, color: C.muted, lineHeight: 15 }}>
            黑棋 {scoreDetail().blackStones} 子 + {scoreDetail().blackTerritory}{" "}
            空；白棋 {scoreDetail().whiteStones} 子 +{" "}
            {scoreDetail().whiteTerritory} 空。死子已标记 {dead().length} 颗。
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <PressButton
              label={deadMode() ? "结束标记" : "标记死子"}
              testID="go-dead-toggle"
              onPress={() => deadMode.update((v) => !v)}
              grow
            />
            <PressButton
              label="继续对弈"
              testID="go-resume"
              onPress={resumeAfterScore}
              grow
            />
            <PressButton
              label="确认结果"
              testID="go-score-confirm"
              tone="primary"
              onPress={confirmScore}
              grow
            />
          </View>
        </View>
      </If>

      {/* 底部操作 */}
      <If when={!scoring() && over() === null}>
        <If
          when={mode() === "aiai"}
          else={
            <View
              style={{
                flexDirection: "row",
                gap: 9,
                paddingTop: 6,
                paddingBottom: 10,
              }}
            >
              <PressButton
                label="虚手"
                hint="停一手；连续两次虚手进入数子"
                testID="go-pass"
                onPress={pass}
                disabled={!canPlay()}
                grow
              />
              <PressButton
                label="悔棋"
                hint="退回上一手"
                testID="go-undo"
                onPress={undo}
                disabled={moves().length === 0}
                grow
              />
              <PressButton
                label="重新开始"
                testID="go-restart"
                tone="primary"
                onPress={reset}
                grow
              />
            </View>
          }
        >
          <View style={{ gap: 8, paddingTop: 6, paddingBottom: 10 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <PressButton
                label={paused() ? "继续" : "暂停"}
                testID="go-pause"
                onPress={togglePause}
                tone="primary"
                grow
              />
              <PressButton
                label="上一步"
                testID="go-step-back"
                onPress={stepBack}
                disabled={
                  moves().length === 0 ||
                  (reviewAt() !== null && reviewAt()! <= 0)
                }
                grow
              />
              <PressButton
                label="下一步"
                testID="go-step-forward"
                onPress={stepForward}
                disabled={reviewAt() === null || reviewAt()! >= moves().length}
                grow
              />
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <PressButton
                label="整局回放"
                testID="go-replay"
                onPress={startReplay}
                disabled={moves().length < 2}
                grow
              />
              <PressButton
                label="保存棋谱"
                testID="go-save"
                onPress={saveRecord}
                disabled={moves().length === 0}
                grow
              />
              <PressButton
                label="重新开始"
                testID="go-restart"
                onPress={reset}
                grow
              />
            </View>
          </View>
        </If>
      </If>

      {/* 结算 */}
      <If when={resultOpen() && over() !== null}>
        <View
          style={{
            position: "absolute",
            left: -14,
            top: -12,
            right: -14,
            bottom: 0,
            backgroundColor: "rgba(38,28,18,0.34)",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 370,
              borderRadius: 22,
              backgroundColor: C.panel,
              borderWidth: 1,
              borderColor: C.line,
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: 16,
              alignItems: "center",
              gap: 7,
              boxShadow: "0 24px 60px rgba(40,26,12,0.34)",
            }}
          >
            <Text
              style={{
                fontSize: 27,
                fontWeight: "700",
                color: C.accent,
                letterSpacing: 2,
              }}
            >
              {over() ? goResultText(over()!) : ""}
            </Text>
            <Text style={{ fontSize: 12, color: C.muted }}>
              {size()} 路 · {moveCount()} 手 · {formatDuration(resultSeconds())}
            </Text>
            <View
              style={{
                width: "100%",
                marginTop: 4,
                paddingTop: 10,
                borderTopWidth: 1,
                borderColor: C.line,
                gap: 4,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontSize: 12.5, color: C.muted }}>
                  黑棋：{over()?.blackStones ?? 0} 子 +{" "}
                  {over()?.blackTerritory ?? 0} 空
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: C.ink,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {over()?.blackArea.toFixed(1) ?? "0"}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontSize: 12.5, color: C.muted }}>
                  白棋：{over()?.whiteStones ?? 0} 子 +{" "}
                  {over()?.whiteTerritory ?? 0} 空 + 贴 {GO_KOMI}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: C.ink,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {over()?.whiteArea.toFixed(1) ?? "0"}
                </Text>
              </View>
            </View>
            <Text
              style={{
                fontSize: 11.5,
                color: C.muted,
                textAlign: "center",
                lineHeight: 17,
                marginTop: 3,
              }}
            >
              {mode() === "pve"
                ? "你执黑。中国规则数子，白棋贴 7.5 点（3¾子）。"
                : "人机大战 / 本地双人不计积分，可保存棋谱反复回看。"}
            </Text>
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                marginTop: 7,
                width: "100%",
              }}
            >
              <PressButton
                label="看看棋盘"
                testID="go-result-close"
                onPress={() => resultOpen.set(false)}
                grow
              />
              <PressButton
                label="保存棋谱"
                testID="go-result-save"
                onPress={saveRecord}
                grow
              />
            </View>
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                width: "100%",
              }}
            >
              <PressButton
                label="返回首页"
                testID="go-result-home"
                onPress={props.onHome}
                grow
              />
              <PressButton
                label="再来一局"
                testID="go-result-restart"
                tone="primary"
                onPress={() => {
                  resultOpen.set(false);
                  reset();
                }}
                grow
              />
            </View>
          </View>
        </View>
      </If>

      {/* 菜单 */}
      <If when={menu()}>
        <MenuPanel
          kind="go"
          score={props.score}
          best={props.best}
          streak={props.streak}
          win={props.win}
          loss={props.loss}
          draw={props.draw}
          history={props.history}
          mode={mode()}
          level={level()}
          limitOn={limitOn()}
          soundOn={props.soundOn}
          goSize={size()}
          moveCount={moves().length}
          paused={paused()}
          reviewAt={reviewAt()}
          canSaveRecord={moves().length > 0}
          onMode={changeMode}
          onLevel={changeLevel}
          onLimit={changeLimit}
          onSound={props.onSound}
          onGoSize={changeSize}
          onHome={props.onHome}
          onHelp={() => {
            props.onHelp();
          }}
          onExit={props.onExit}
          onClear={props.onClear}
          onClose={() => menu.set(false)}
          onSaveRecord={saveRecord}
          onTogglePause={togglePause}
          onStepBack={stepBack}
          onStepForward={stepForward}
          onReplay={startReplay}
        />
      </If>
    </View>
  );
}
