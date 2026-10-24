import {
  batch,
  computed,
  effect,
  mount,
  signal,
  Text,
  untracked,
  View,
  type Signal,
} from "nsh";
import { SafeAreaView } from "nsh/base";
import { keymap } from "nsh/keymap";
import { Storage } from "nsh/storage";
import { Endgames } from "./components/Endgames";
import { MultiGame } from "./components/MultiGame";
import { GuideStrip, Academy } from "./components/Guide";
import { GAMES } from "./lib/catalog";
import { findTimeControl } from "./lib/clock";
import type { ExtraKind } from "./lib/multigame";
import { Board } from "./components/Board";
import { GoGame, type GoFinish } from "./components/GoGame";
import { HelpPanel } from "./components/Help";
import { Home } from "./components/Home";
import { Learn } from "./components/Learn";
import { MenuPanel } from "./components/Menu";
import { Records } from "./components/Records";
import { ResultPanel } from "./components/Result";
import { SoundBank } from "./components/Sound";
import { Tsumego } from "./components/Tsumego";
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
  type GameKind,
  type GameResult,
  type Mode,
  type Move,
  type Player,
} from "./lib/gomoku";
import type { GoSize } from "./lib/go";
import { readSavedGame, savedTurn, type SavedGame } from "./lib/save";
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
import {
  RECORDS_LIMIT,
  makeRecord,
  readRecords,
  type RecordInput,
  type StoredRecord,
} from "./lib/records";
import { addStudyId, readStudy, type StudyProgress } from "./lib/study";
import { LEARN_TRACKS } from "./lib/learn";
import { TSUMEGO_PROBLEMS } from "./lib/tsumego";
import { loadSounds, type SoundName } from "./lib/sound";

const HUMAN: Player = 1;
const AI: Player = 2;
const SAVE_KEY = "gomoku.v2";
const GAME_KEY = "gomoku.game.v1";
const RECORDS_KEY = "gomoku.records.v1";
const STUDY_KEY = "gomoku.study.v1";
const NO_LINE: number[] = [];
/** 继续游戏时至少留 3 秒，避免一进来就超时 */
const RESUME_FLOOR_MS = 3000;
/** 对局进行中定期刷新剩余时间，降低被直接杀掉时的损失 */
const GAME_SAVE_MS = 5000;
/** 人机大战每手间隔，约 2 秒 */
const AIAI_DELAY_MS = 2000;
/** 回放每手间隔 */
const REPLAY_MS = 620;

type Screen =
  | "home"
  | "game"
  | "go"
  | "extra"
  | "academy"
  | "endgames"
  | "tsumego"
  | "learn"
  | "records";

/** 本地对局（人机 / 双人 / 人机大战）：菜单打开时暂停倒计时。 */
const LOCAL_MODES: readonly Mode[] = ["pve", "pvp", "aiai"];

/** 最后几秒进入红色闪烁警告，并逐秒滴答。 */
const URGENT_SECONDS = 5;

const LEVEL_NAME: Record<Difficulty, string> = {
  easy: "简单",
  normal: "普通",
  hard: "困难",
  hell: "地狱",
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

const MODES: readonly Mode[] = ["pve", "pvp", "aiai"];
const LEVELS: readonly Difficulty[] = ["easy", "normal", "hard", "hell"];
const GO_SIZES: readonly GoSize[] = [9, 13, 19];

function readProgress(raw: string | null): Progress | null {
  if (!raw) return null;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const list = Array.isArray(data.history)
    ? (data.history as GameRecord[])
    : [];
  return {
    score: num(data.score),
    best: num(data.best),
    streak: num(data.streak),
    win: num(data.win),
    loss: num(data.loss),
    draw: num(data.draw),
    history: list
      .filter(
        (r) =>
          r &&
          typeof r.at === "number" &&
          typeof r.outcome === "string" &&
          typeof r.moves === "number",
      )
      .map((r) => ({
        ...r,
        game: (GAMES.some((g) => g.kind === r.game)
          ? r.game
          : "gomoku") as GameKind,
        mode: MODES.includes(r.mode) ? r.mode : "pve",
        level: LEVELS.includes(r.level) ? r.level : "normal",
      }))
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
  /** 每次重置/悔棋/回看自增，用来作废正在进行的 AI 计算 */
  const round = signal(0);
  const boardSize = signal(0);

  /** 人机大战：暂停、逐步回看与整局回放 */
  const paused = signal(false);
  const reviewAt = signal<number | null>(null);
  const replaying = signal(false);

  const kind = signal<GameKind>("gomoku");
  const goSize = signal<GoSize>(9);
  const timeControl = signal("");
  const goInitial = signal<SavedGame | null>(null);

  const progress = signal<Progress>(EMPTY);
  const records = signal<StoredRecord[]>([]);
  const study = signal<StudyProgress>({ tsumego: [], lessons: [] });
  const limitOn = signal(true);
  const leftMs = signal(MOVE_SECONDS * 1000);
  const undos = signal(0);
  const timeouts = signal(0);
  const startedAt = signal(0);

  const menu = signal(false);
  const helpOpen = signal(false);
  const settle = signal<Settle | null>(null);
  const resultOpen = signal(false);
  const notice = signal<string | null>(null);
  const loaded = signal(false);
  const screen = signal<Screen>("home");
  const savedGame = signal<SavedGame | null>(null);
  const soundOn = signal(true);

  /** 倒计时 effect 的本地状态：跨继续游戏保留剩余时间 */
  let deadline = 0;
  let pausedLeft = 0;
  let tickedSecond = 0;

  const soundSrc = signal<Partial<Record<SoundName, string>>>({});
  const soundPrime = signal(0);
  const sounds: Record<SoundName, Signal<number>> = {
    place: signal(0),
    tick: signal(0),
    timeout: signal(0),
    win: signal(0),
    loss: signal(0),
    draw: signal(0),
    check: signal(0),
  };

  /* ---------------------------- 派生 ---------------------------- */
  const viewMoves = computed(() => {
    const at = reviewAt();
    if (at === null) return moves();
    return moves().slice(0, Math.max(0, Math.min(at, moves().length)));
  });

  const viewBoard = computed(() =>
    reviewAt() === null ? board() : boardFromMoves(viewMoves()),
  );

  const lastIndex = computed(() => {
    const m = viewMoves();
    if (m.length === 0) return -1;
    const last = m[m.length - 1];
    return idx(last.x, last.y);
  });

  const winLine = computed(() => {
    const o = over();
    return o && o.kind === "win" && reviewAt() === null ? o.line : NO_LINE;
  });

  const canPlay = computed(
    () =>
      screen() === "game" &&
      over() === null &&
      !thinking() &&
      !paused() &&
      !menu() &&
      !helpOpen() &&
      !resultOpen() &&
      reviewAt() === null &&
      !replaying() &&
      mode() !== "aiai" &&
      (mode() === "pvp" || turn() === HUMAN),
  );

  /** 是否该给人倒计时（AI 回合、人机大战、终局、回看、关闭限时都不计时） */
  const timed = computed(
    () =>
      screen() === "game" &&
      limitOn() &&
      over() === null &&
      !paused() &&
      !replaying() &&
      reviewAt() === null &&
      mode() !== "aiai" &&
      (mode() === "pvp" || turn() === HUMAN),
  );

  const secondsLeft = computed(() => Math.max(0, Math.ceil(leftMs() / 1000)));
  const timeRatio = computed(() =>
    over() !== null
      ? 0
      : Math.max(0, Math.min(1, leftMs() / (MOVE_SECONDS * 1000))),
  );
  const localMode = computed(() => LOCAL_MODES.includes(mode()));
  const lowTime = computed(() => timed() && secondsLeft() <= URGENT_SECONDS);
  /** 红色边框的闪烁相位：只影响最后几秒的进度条。 */
  const blink = signal(false);

  const statusText = computed(() => {
    const o = over();
    if (reviewAt() !== null) {
      return replaying()
        ? `整局回放 · 第 ${reviewAt() ?? 0} 手`
        : `回看第 ${reviewAt() ?? 0} 手`;
    }
    if (o) {
      if (o.kind === "draw") return "和棋";
      return o.winner === 1 ? "黑棋获胜" : "白棋获胜";
    }
    if (mode() === "aiai") {
      if (paused()) return "人机大战已暂停";
      if (thinking()) return "AI 思考中…";
      return turn() === 1 ? "黑方 AI 落子" : "白方 AI 落子";
    }
    if (mode() === "pve") {
      if (turn() === AI) return thinking() ? "AI 思考中…" : "AI 落子";
      return "轮到你落子";
    }
    return turn() === 1 ? "黑棋落子" : "白棋落子";
  });

  const levelBreakdown = computed(() => {
    const out: Record<string, number> = {};
    for (const p of TSUMEGO_PROBLEMS) {
      out[p.level] = (out[p.level] ?? 0) + 1;
    }
    return out;
  });
  const learnTotal = LEARN_TRACKS.reduce((n, t) => n + t.lessons.length, 0);

  /* ---------------------------- 动作 ---------------------------- */
  function flash(text: string) {
    notice.set(text);
  }

  function playSound(name: SoundName) {
    if (!soundOn()) return;
    sounds[name].update((n) => n + 1);
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
    const title = pve
      ? outcomeLabel(outcome)
      : r.kind === "draw"
        ? "和棋"
        : r.winner === 1
          ? "黑棋获胜"
          : "白棋获胜";
    const record: GameRecord = {
      at: Date.now(),
      outcome,
      level: level(),
      mode: mode(),
      game: "gomoku",
      result: title,
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
      paused.set(true);
    });

    // 双人局没有「我方」：任意一方连成五子都是赢棋；只有人机输给 AI 才放落败音
    playSound(
      r.kind === "draw"
        ? "draw"
        : outcome === "loss" && mode() === "pve"
          ? "loss"
          : "win",
    );
  }

  function commit(x: number, y: number, p: Player) {
    const i = idx(x, y);
    if (board()[i] !== 0) return;
    if (over() !== null) return;
    playSound("place");
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
    // Web 桌面端没有触摸事件：借用第一次点击把静音预播做掉
    soundPrime.update((n) => n + 1);
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
      paused.set(false);
      reviewAt.set(null);
      replaying.set(false);
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
    if (over() !== null || mode() === "aiai" || reviewAt() !== null) return;
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
      paused.set(false);
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
    playSound("timeout");
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

  function togglePause() {
    if (paused()) {
      batch(() => {
        paused.set(false);
        reviewAt.set(null);
        replaying.set(false);
      });
      return;
    }
    batch(() => {
      paused.set(true);
      thinking.set(false);
    });
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
    if (moves().length < 2) {
      flash("至少两手才能回放");
      return;
    }
    batch(() => {
      paused.set(true);
      reviewAt.set(0);
      replaying.set(true);
      menu.set(false);
      resultOpen.set(false);
    });
  }

  /** 当前对局快照；没开始或已结束返回 null（这时不该留「继续游戏」）。 */
  function gameSnapshot(): SavedGame | null {
    const m = moves();
    if (m.length === 0 || over() !== null) return null;
    return {
      kind: "gomoku",
      moves: m,
      mode: mode(),
      level: level(),
      limitOn: limitOn(),
      // 剩余时间每 100ms 变一次；不订阅它，否则存档会跟着倒计时狂写
      leftMs: untracked(() => leftMs()),
      undos: undos(),
      timeouts: timeouts(),
      startedAt: startedAt(),
      savedAt: Date.now(),
    };
  }

  function settingsJSON(): string {
    return JSON.stringify({
      ...progress(),
      level: level(),
      mode: mode(),
      limitOn: limitOn(),
      soundOn: soundOn(),
      kind: kind(),
      goSize: goSize(),
      timeControl: timeControl(),
    });
  }

  function writeGame(): Promise<void> {
    if (mode() === "aiai") return Promise.resolve();
    const game = gameSnapshot();
    savedGame.set(game);
    return game
      ? Storage.setItem(GAME_KEY, JSON.stringify(game))
      : Storage.removeItem(GAME_KEY);
  }

  function writeGoGame(): Promise<void> {
    const game = savedGame();
    return game
      ? Storage.setItem(GAME_KEY, JSON.stringify(game))
      : Storage.removeItem(GAME_KEY);
  }

  /** 继续存档：棋盘、设置、悔棋/超时和剩余时间一起恢复。 */
  function continueGame() {
    const game = savedGame();
    if (!game) return;

    if (game.kind !== "go" && game.kind !== "gomoku") {
      batch(() => {
        kind.set(game.kind);
        goInitial.set(game);
        mode.set(game.mode);
        level.set(game.level);
        limitOn.set(game.limitOn);
        timeControl.set(game.timeControl ?? "");
        screen.set("extra");
      });
      return;
    }
    if (game.kind === "go") {
      batch(() => {
        kind.set("go");
        goSize.set(game.goSize ?? 9);
        goInitial.set(game);
        mode.set(game.mode);
        level.set(game.level);
        limitOn.set(game.limitOn);
        menu.set(false);
        helpOpen.set(false);
        resultOpen.set(false);
        settle.set(null);
        screen.set("go");
      });
      return;
    }

    const left = Math.max(
      RESUME_FLOOR_MS,
      Math.min(MOVE_SECONDS * 1000, game.leftMs),
    );
    pausedLeft = left;

    batch(() => {
      kind.set("gomoku");
      round.update((n) => n + 1);
      board.set(boardFromMoves(game.moves));
      moves.set(game.moves);
      turn.set(savedTurn(game));
      over.set(null);
      mode.set(game.mode);
      level.set(game.level);
      limitOn.set(game.limitOn);
      undos.set(game.undos);
      timeouts.set(game.timeouts);
      startedAt.set(game.startedAt);
      leftMs.set(left);
      thinking.set(false);
      hover.set(-1);
      paused.set(false);
      reviewAt.set(null);
      replaying.set(false);
      settle.set(null);
      resultOpen.set(false);
      menu.set(false);
      notice.set(null);
      screen.set("game");
    });
  }

  /** 从主页的开局设置开始新对局，同时放弃旧的「继续游戏」存档。 */
  function startNewGame() {
    pausedLeft = 0;
    const next = kind();
    batch(() => {
      if (mode() !== "aiai") savedGame.set(null);
      goInitial.set(null);
      menu.set(false);
      helpOpen.set(false);
      resultOpen.set(false);
      settle.set(null);
      if (next === "go") {
        screen.set("go");
      } else if (next !== "gomoku") {
        screen.set("extra");
      } else {
        screen.set("game");
        reset();
      }
    });
    if (mode() !== "aiai") Storage.removeItem(GAME_KEY).catch(() => {});
  }

  function startAiai() {
    mode.set("aiai");
    startNewGame();
  }

  /** 保存并回到主页；棋盘状态留在内存里，点继续再恢复。 */
  function goHome() {
    if (screen() === "game") {
      writeGame().catch(() => {});
    } else if (screen() === "go" || screen() === "extra") {
      writeGoGame().catch(() => {});
    }
    batch(() => {
      menu.set(false);
      resultOpen.set(false);
      settle.set(null);
      paused.set(false);
      replaying.set(false);
      reviewAt.set(null);
      helpOpen.set(false);
      screen.set("home");
    });
  }

  function toggleSound() {
    soundOn.update((on) => !on);
  }

  function addRecord(input: RecordInput, quiet = false) {
    const record = makeRecord(input);
    records.update((list) => [record, ...list].slice(0, RECORDS_LIMIT));
    if (!quiet) flash("棋谱已保存到棋谱库");
  }

  function saveGomokuRecord(quiet = false) {
    if (moves().length === 0) {
      flash("还没有落子，无法保存");
      return;
    }
    addRecord(
      {
        game: "gomoku",
        mode: mode(),
        level: level(),
        moves: moves(),
        result: over() ? statusText() : undefined,
      },
      quiet,
    );
  }

  function solveTsumego(id: string) {
    study.update((s) =>
      s.tsumego.includes(id) ? s : { ...s, tsumego: addStudyId(s.tsumego, id) },
    );
  }

  function completeLesson(id: string) {
    study.update((s) =>
      s.lessons.includes(id) ? s : { ...s, lessons: addStudyId(s.lessons, id) },
    );
  }

  function deleteRecord(id: string) {
    records.update((list) => list.filter((r) => r.id !== id));
    flash("棋谱已删除");
  }

  function handleGoSnapshot(game: SavedGame | null) {
    if (mode() === "aiai") return;
    savedGame.set(game);
    if (!loaded()) return;
    if (game) {
      Storage.setItem(GAME_KEY, JSON.stringify(game)).catch(() => {});
    } else {
      Storage.removeItem(GAME_KEY).catch(() => {});
    }
  }

  function handleGoFinish(finishInfo: GoFinish, gameKind: GameKind = "go") {
    const pve = mode() === "pve";
    const outcome = finishInfo.outcome;
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
          moves: finishInfo.moves,
          seconds: finishInfo.seconds,
          undos: finishInfo.undos ?? 0,
          timeouts: finishInfo.timeouts ?? 0,
          streak,
        })
      : { lines: [], total: 0, stars: 0 };
    const delta = breakdown.total;
    const total = pve ? Math.max(0, prev.score + delta) : prev.score;
    const best = pve ? Math.max(prev.best, delta) : prev.best;
    const record: GameRecord = {
      at: Date.now(),
      outcome,
      level: level(),
      mode: mode(),
      game: gameKind,
      goSize: gameKind === "go" ? goSize() : undefined,
      result: finishInfo.result,
      moves: finishInfo.moves,
      seconds: finishInfo.seconds,
      delta,
      stars: breakdown.stars,
    };
    batch(() => {
      progress.set({
        score: total,
        best,
        streak,
        win: prev.win + (outcome === "win" ? 1 : 0),
        loss: prev.loss + (outcome === "loss" ? 1 : 0),
        draw: prev.draw + (outcome === "draw" ? 1 : 0),
        history: [record, ...prev.history].slice(0, HISTORY_LIMIT),
      });
      if (mode() !== "aiai") savedGame.set(null);
      paused.set(false);
    });
    if (mode() !== "aiai") Storage.removeItem(GAME_KEY).catch(() => {});
  }

  /** 退出前先把设置与当前对局写进 storage，再请求宿主关闭界面。 */
  async function exitGame() {
    try {
      await Storage.setItem(SAVE_KEY, settingsJSON());
    } catch {
      /* 存储满 / 不可用时仍然允许退出 */
    }
    try {
      if (screen() === "game") await writeGame();
      else if (screen() === "go" || screen() === "extra") await writeGoGame();
    } catch {
      /* 同上 */
    }
    try {
      process.exit(0);
    } catch {
      // 宿主没给权限 / 没有退出处理器时至少回到主页，不把界面卡在菜单里
      if (screen() !== "home") goHome();
    }
  }

  /* ---------------------------- 副作用 ---------------------------- */
  // 读取存档（分数、战绩、设置）、未下完的对局、棋谱库与学棋进度
  effect(() => {
    let alive = true;
    Promise.all([
      Storage.getItem(SAVE_KEY),
      Storage.getItem(GAME_KEY),
      Storage.getItem(RECORDS_KEY),
      Storage.getItem(STUDY_KEY),
    ])
      .then(([raw, gameRaw, recordsRaw, studyRaw]) => {
        if (!alive) return;
        const saved = readProgress(raw);
        const game = readSavedGame(gameRaw);
        const savedRecords = readRecords(recordsRaw);
        const savedStudy = readStudy(studyRaw);

        batch(() => {
          if (saved) progress.set(saved);
          try {
            const meta = raw
              ? (JSON.parse(raw) as Record<string, unknown>)
              : {};
            if (typeof meta.timeControl === "string")
              timeControl.set(meta.timeControl);
            const lv = meta.level;
            if (LEVELS.includes(lv as Difficulty)) {
              level.set(lv as Difficulty);
            }
            const md = meta.mode;
            if (MODES.includes(md as Mode)) mode.set(md as Mode);
            if (typeof meta.limitOn === "boolean") limitOn.set(meta.limitOn);
            if (typeof meta.soundOn === "boolean") soundOn.set(meta.soundOn);
            if (GAMES.some((g) => g.kind === meta.kind)) {
              kind.set(meta.kind as GameKind);
            }
            if (GO_SIZES.includes(meta.goSize as GoSize)) {
              goSize.set(meta.goSize as GoSize);
            }
          } catch {
            /* 存档损坏时忽略设置，沿用默认值 */
          }
          // 没有设置档但有对局档时，至少让主页显示存档里的设置
          if (!raw && game) {
            kind.set(game.kind);
            mode.set(game.mode);
            level.set(game.level);
            limitOn.set(game.limitOn);
            if (game.goSize) goSize.set(game.goSize);
          }
          records.set(savedRecords);
          study.set(savedStudy);
          savedGame.set(game);
          loaded.set(true);
        });

        if (gameRaw && !game) Storage.removeItem(GAME_KEY).catch(() => {});
      })
      .catch(() => {
        if (alive) loaded.set(true);
      });
    return () => {
      alive = false;
    };
  });

  // 写设置：只在加载完成后写，避免开局用默认值覆盖旧记录
  effect(() => {
    const p = progress();
    const lv = level();
    const md = mode();
    const lim = limitOn();
    const so = soundOn();
    const kd = kind();
    const gs = goSize();
    const tc = timeControl();
    if (!loaded()) return;
    Storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        ...p,
        level: lv,
        mode: md,
        limitOn: lim,
        soundOn: so,
        kind: kd,
        goSize: gs,
        timeControl: tc,
      }),
    ).catch(() => {});
  });

  // 棋谱库
  effect(() => {
    const list = records();
    if (!loaded()) return;
    Storage.setItem(RECORDS_KEY, JSON.stringify(list)).catch(() => {});
  });

  // 学棋 / 残局进度
  effect(() => {
    const s = study();
    if (!loaded()) return;
    Storage.setItem(STUDY_KEY, JSON.stringify(s)).catch(() => {});
  });

  // 写对局存档：每次落子 / 悔棋 / 改设置后写一次；结束或重开时删掉
  effect(() => {
    if (!loaded() || screen() !== "game" || mode() === "aiai") return;
    const game = gameSnapshot();
    savedGame.set(game);
    if (!game) {
      Storage.removeItem(GAME_KEY).catch(() => {});
      return;
    }
    Storage.setItem(GAME_KEY, JSON.stringify(game)).catch(() => {});
  });

  // 倒计时只在内存里走，定期把剩余时间刷进存档，杀掉进程也少丢一点
  effect(() => {
    if (
      !loaded() ||
      screen() !== "game" ||
      mode() === "aiai" ||
      moves().length === 0 ||
      over() !== null
    ) {
      return;
    }
    const timer = setInterval(() => {
      const game = untracked(gameSnapshot);
      if (!game) return;
      savedGame.set(game);
      Storage.setItem(GAME_KEY, JSON.stringify(game)).catch(() => {});
    }, GAME_SAVE_MS);
    return () => clearInterval(timer);
  });

  // 启动时合成音效；某个音效失败只是少了那一个，静音也能正常对局
  effect(() => {
    let alive = true;
    loadSounds()
      .then((srcs) => {
        if (alive) soundSrc.set(srcs);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  });

  // 最后 5 秒进度条边框红白闪烁，显得急一点
  effect(() => {
    if (!lowTime()) {
      blink.set(false);
      return;
    }
    blink.set(true);
    const timer = setInterval(() => blink.update((v) => !v), 420);
    return () => clearInterval(timer);
  });

  // 最后 5 秒逐秒滴答；菜单暂停期间跳过，关掉菜单不会补响
  effect(() => {
    const s = secondsLeft();
    const active = timed();
    const pausedNow = (menu() && localMode()) || resultOpen() || helpOpen();
    if (!active || pausedNow || over() !== null) return;
    if (s > URGENT_SECONDS || s <= 0) {
      tickedSecond = 0;
      return;
    }
    if (s === tickedSecond) return;
    tickedSecond = s;
    playSound("tick");
  });

  // 落子倒计时：本地对局菜单打开时暂停，回来后接着走，不会靠开关菜单刷新时间。
  effect(() => {
    const active = timed();
    const pausedNow =
      (menu() && localMode()) ||
      resultOpen() ||
      helpOpen() ||
      paused() ||
      reviewAt() !== null ||
      replaying();
    const r = round();

    if (!active) {
      deadline = 0;
      pausedLeft = 0;
      leftMs.set(MOVE_SECONDS * 1000);
      return;
    }

    if (pausedNow) {
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

  // AI 落子：人机模式执白；人机大战双方都由 AI 走，约 2 秒一手。
  effect(() => {
    const r = round();
    const m = mode();
    const t = turn();
    const o = over();
    const lv = level();
    const sc = screen();
    const help = helpOpen();
    const pausedNow = paused();
    const review = reviewAt();
    const replay = replaying();
    const menuNow = menu();
    const result = resultOpen();

    const aiTurn = m === "aiai" || (m === "pve" && t === AI);
    if (
      sc !== "game" ||
      !aiTurn ||
      o !== null ||
      help ||
      pausedNow ||
      review !== null ||
      replay ||
      menuNow ||
      result
    ) {
      thinking.set(false);
      return;
    }

    thinking.set(true);
    const delay = m === "aiai" ? AIAI_DELAY_MS : 110;
    const timer = setTimeout(() => {
      if (untracked(() => round()) !== r) return;
      if (untracked(() => over()) !== null) return;
      if (untracked(() => paused())) return;
      if (untracked(() => reviewAt()) !== null) return;
      if (untracked(() => replaying())) return;
      if (untracked(() => menu())) return;
      if (untracked(() => helpOpen())) return;
      if (untracked(() => resultOpen())) return;

      const now = untracked(() => turn());
      let choice: AiChoice | null = null;
      try {
        choice = findBestMove(
          untracked(() => board()),
          now,
          lv,
        );
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
      if (untracked(() => paused())) return;
      if (untracked(() => reviewAt()) !== null) return;
      if (untracked(() => menu())) return;
      if (untracked(() => helpOpen())) return;
      thinking.set(false);

      if (choice) {
        const i = idx(choice.x, choice.y);
        if (untracked(() => board())[i] === 0) commit(choice.x, choice.y, now);
      }
    }, delay);

    return () => clearTimeout(timer);
  });

  // 人机大战整局回放：每 620ms 前进一手，到末尾自动停。
  effect(() => {
    if (!replaying()) return;
    const timer = setInterval(() => {
      const at = untracked(() => reviewAt());
      const total = untracked(() => moves().length);
      if (at === null || at >= total) {
        replaying.set(false);
        return;
      }
      reviewAt.set(at + 1);
    }, REPLAY_MS);
    return () => clearInterval(timer);
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
        if (screen() === "game" && !menu() && !helpOpen() && !resultOpen()) {
          undo();
        }
      },
      r: () => {
        if (screen() === "game" && !menu() && !helpOpen() && !resultOpen()) {
          reset();
        }
      },
      m: () => {
        if (screen() === "game" && !helpOpen()) menu.update((v) => !v);
      },
      escape: () => {
        if (helpOpen()) {
          helpOpen.set(false);
          return;
        }
        if (screen() !== "game") return;
        if (menu()) menu.set(false);
        else if (resultOpen()) resultOpen.set(false);
      },
    });
  });

  /* ---------------------------- 界面 ---------------------------- */
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View
        style={{ flex: 1, alignItems: "center", backgroundColor: C.bg }}
        onTouchStartCapture={() => soundPrime.update((n) => n + 1)}
      >
        <If when={screen() === "home"}>
          <Home
            saved={savedGame()}
            kind={kind()}
            goSize={goSize()}
            timeControl={findTimeControl(kind(), timeControl()).id}
            onTimeControl={(id) => timeControl.set(id)}
            score={progress().score}
            best={progress().best}
            win={progress().win}
            loss={progress().loss}
            draw={progress().draw}
            mode={mode()}
            level={level()}
            limitOn={limitOn()}
            soundOn={soundOn()}
            recordCount={records().length}
            learnDone={study().lessons.length}
            learnTotal={learnTotal}
            tsumegoDone={study().tsumego.length}
            tsumegoTotal={TSUMEGO_PROBLEMS.length}
            onContinue={continueGame}
            onNewGame={startNewGame}
            onAiai={startAiai}
            onKind={(k) => kind.set(k)}
            onMode={(m) => mode.set(m)}
            onLevel={(l) => level.set(l)}
            onLimit={(on) => limitOn.set(on)}
            onGoSize={(s) => goSize.set(s)}
            onSound={toggleSound}
            onHelp={() => helpOpen.set(true)}
            onExit={exitGame}
            onTsumego={() =>
              screen.set(
                kind() === "chess" || kind() === "xiangqi"
                  ? "endgames"
                  : "tsumego",
              )
            }
            onLearn={() => screen.set(kind() === "go" ? "learn" : "academy")}
            onRecords={() => screen.set("records")}
          />
        </If>

        <If when={screen() === "game"}>
          <View
            style={{
              flex: 1,
              width: "100%",
              maxWidth: 540,
              paddingHorizontal: 14,
            }}
          >
            <GuideStrip kind="gomoku" />
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
                    : mode() === "aiai"
                      ? `人机大战 · ${LEVEL_NAME[level()]}`
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
                height: 22,
                marginTop: 12,
                marginBottom: 6,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <StoneDot
                  player={reviewAt() === null ? turn() : 1}
                  size={13}
                  dim={over() !== null || paused()}
                />
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
                  fontSize: 12,
                  lineHeight: 16,
                  color: C.muted,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {viewMoves().length} 手 · {progress().score} 分
              </Text>
            </View>

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
                  testID={lowTime() ? "timer-urgent" : "timer-track"}
                  style={{
                    flex: 1,
                    height: 7,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: lowTime()
                      ? blink()
                        ? C.accent
                        : "rgba(196,72,52,0.3)"
                      : "transparent",
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

            {/* 回看提示 */}
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
                <Text
                  style={{ fontSize: 10.5, color: C.accent, fontWeight: "600" }}
                >
                  {replaying() ? "整局回放中" : "回看模式"} · 第{" "}
                  {reviewAt() ?? 0} / {moves().length} 手
                </Text>
                <Text style={{ fontSize: 10.5, color: C.muted }}>
                  {reviewAt() === moves().length
                    ? "点「继续」回到实时对局"
                    : "用上一步 / 下一步翻看"}
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
                    board={viewBoard}
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

            {/* 底部操作 */}
            <If
              when={mode() === "aiai"}
              else={
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
              }
            >
              <View style={{ gap: 7, paddingTop: 5, paddingBottom: 10 }}>
                <View style={{ flexDirection: "row", gap: 7 }}>
                  <PressButton
                    label={paused() ? "继续" : "暂停"}
                    testID="aiai-pause"
                    onPress={togglePause}
                    tone="primary"
                    grow
                  />
                  <PressButton
                    label="上一步"
                    testID="aiai-step-back"
                    onPress={stepBack}
                    disabled={
                      moves().length === 0 ||
                      (reviewAt() !== null && reviewAt()! <= 0)
                    }
                    grow
                  />
                  <PressButton
                    label="下一步"
                    testID="aiai-step-forward"
                    onPress={stepForward}
                    disabled={
                      reviewAt() === null || reviewAt()! >= moves().length
                    }
                    grow
                  />
                  <PressButton
                    label="整局回放"
                    testID="aiai-replay"
                    onPress={startReplay}
                    disabled={moves().length < 2}
                    grow
                  />
                </View>
                <View style={{ flexDirection: "row", gap: 7 }}>
                  <PressButton
                    label="保存棋谱"
                    testID="aiai-save"
                    onPress={() => saveGomokuRecord()}
                    disabled={moves().length === 0}
                    grow
                  />
                  <PressButton
                    label="重新开始"
                    testID="aiai-restart"
                    onPress={reset}
                    grow
                  />
                </View>
              </View>
            </If>
          </View>
        </If>

        <If when={screen() === "extra"}>
          <MultiGame
            kind={kind() as ExtraKind}
            initial={goInitial()}
            mode={mode()}
            level={level()}
            limitOn={limitOn()}
            timeControl={timeControl()}
            helpOpen={helpOpen()}
            onSnapshot={handleGoSnapshot}
            onFinish={(f) => handleGoFinish(f, kind())}
            onRecord={(r) => addRecord(r, true)}
            playSound={playSound}
            onHome={goHome}
            onHelp={() => helpOpen.set(true)}
          />
        </If>
        <If when={screen() === "endgames"}>
          <Endgames
            initial={kind() === "xiangqi" ? "xiangqi" : "chess"}
            solved={study().tsumego}
            onSolved={solveTsumego}
            onBack={() => screen.set("home")}
          />
        </If>
        <If when={screen() === "academy"}>
          <Academy
            initial={kind()}
            completed={study().lessons}
            onComplete={completeLesson}
            onBack={() => screen.set("home")}
            onGoLearn={() => screen.set("learn")}
          />
        </If>
        <If when={screen() === "go"}>
          <GoGame
            initial={goInitial()}
            timeControl={timeControl()}
            mode={mode()}
            level={level()}
            limitOn={limitOn()}
            goSize={goSize()}
            soundOn={soundOn()}
            helpOpen={helpOpen()}
            score={progress().score}
            best={progress().best}
            streak={progress().streak}
            win={progress().win}
            loss={progress().loss}
            draw={progress().draw}
            history={progress().history}
            onSnapshot={handleGoSnapshot}
            onFinish={handleGoFinish}
            onRecord={(record) => addRecord(record, true)}
            onHome={goHome}
            onExit={exitGame}
            onHelp={() => helpOpen.set(true)}
            onClear={clearHistory}
            onSound={toggleSound}
            onMode={(m) => mode.set(m)}
            onLevel={(l) => level.set(l)}
            onLimit={(on) => limitOn.set(on)}
            onGoSize={(s) => goSize.set(s)}
            playSound={playSound}
          />
        </If>

        <If when={screen() === "tsumego"}>
          <Tsumego
            solved={study().tsumego}
            onSolved={solveTsumego}
            onBack={() => screen.set("home")}
          />
        </If>

        <If when={screen() === "learn"}>
          <Learn
            completed={study().lessons}
            onComplete={completeLesson}
            onBack={() => screen.set("home")}
          />
        </If>

        <If when={screen() === "records"}>
          <Records
            records={records()}
            onDelete={deleteRecord}
            onBack={() => screen.set("home")}
          />
        </If>
      </View>

      {/* 音效播放器（隐藏） */}
      <SoundBank srcs={soundSrc} triggers={sounds} prime={soundPrime} />

      {/* 菜单 */}
      <If when={screen() === "game" && menu()}>
        <MenuPanel
          kind="gomoku"
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
          soundOn={soundOn()}
          moveCount={moves().length}
          paused={paused()}
          reviewAt={reviewAt()}
          canSaveRecord={moves().length > 0}
          onMode={switchMode}
          onLevel={switchLevel}
          onLimit={switchLimit}
          onSound={toggleSound}
          onHome={goHome}
          onHelp={() => {
            helpOpen.set(true);
          }}
          onExit={exitGame}
          onClear={clearHistory}
          onClose={() => menu.set(false)}
          onSaveRecord={() => saveGomokuRecord()}
          onTogglePause={togglePause}
          onStepBack={stepBack}
          onStepForward={stepForward}
          onReplay={startReplay}
        />
      </If>

      {/* 结算 */}
      <If when={screen() === "game" && resultOpen() && settle() !== null}>
        <ResultPanel
          outcome={settle()!.outcome}
          title={settle()!.title}
          scored={settle()!.scored}
          mode={mode()}
          level={level()}
          moves={settle()!.moves}
          seconds={settle()!.seconds}
          breakdown={settle()!.breakdown}
          total={settle()!.total}
          best={settle()!.best}
          streak={settle()!.streak}
          onSave={() => saveGomokuRecord()}
          onClose={() => resultOpen.set(false)}
          onRestart={reset}
        />
      </If>

      {/* 帮助：在主页、五子棋和围棋菜单都能打开，覆盖在最上层 */}
      <If when={helpOpen()}>
        <HelpPanel kind={kind()} onClose={() => helpOpen.set(false)} />
      </If>
    </SafeAreaView>
  );
}

mount(App);
