import {
  Scroll,
  Text,
  View,
  signal,
  computed,
  effect,
  untracked,
  batch,
} from "nsh";
import { windowSize } from "nsh/device";
import { C, PressButton, ConfirmButton } from "./ui";
import { MultiBoard, PLAYER_COLORS } from "./MultiBoard";
import { GuideStrip } from "./Guide";
import { gameMeta, gameName, isComplexGame } from "../lib/catalog";
import {
  createMatch,
  applyAction,
  matchAi,
  replayMatch,
  completesTurn,
  clockSlotForMatch,
  type Match,
  type Action,
  type ExtraKind,
} from "../lib/multigame";
import {
  royalLegalMoves,
  inCheck,
  drawClaim,
  timeoutRoyal,
  type RoyalState,
} from "../lib/royal";
import {
  checkerMoves,
  ludoLegal,
  type CheckerPlayers,
} from "../lib/race";
import { junqiMoves, validDeployment } from "../lib/junqi";
import {
  createClock,
  restoreClock,
  tickClock,
  clockAfterMove,
  clockAfterUndo,
  formatClock,
  clockUrgent,
  remainingMs,
  sideOf,
  type MatchClock,
} from "../lib/clock";
import type { SavedGame } from "../lib/save";
import type { Difficulty, Mode, Player } from "../lib/gomoku";
import type { SoundName } from "../lib/sound";
import type { RecordInput } from "../lib/records";
import type { GoFinish } from "./GoGame";
import { outcomeForWinner } from "../lib/score";
import { findTimeControl } from "../lib/clock";

export function MultiGame(props: {
  kind: ExtraKind;
  initial: SavedGame | null;
  mode: Mode;
  level: Difficulty;
  limitOn: boolean;
  timeControl: string;
  checkerPlayers: CheckerPlayers;
  helpOpen: boolean;
  onHome: () => void;
  onHelp: () => void;
  onSnapshot: (s: SavedGame | null) => void;
  onFinish: (s: GoFinish) => void;
  onRecord: (s: RecordInput) => void;
  playSound: (name: SoundName) => void;
}) {
  const initial = props.initial?.kind === props.kind ? props.initial : null;
  const players: CheckerPlayers =
    initial?.checkerPlayers ?? props.checkerPlayers;
  const initialBoard = signal(initial?.initialBoard);
  const match = signal<Match>(
    initial?.actions
      ? (replayMatch(
          props.kind,
          initial.actions,
          initial.initialBoard,
          players,
        ) ?? createMatch(props.kind, players))
      : createMatch(props.kind, players),
  );
  const actions = signal<Action[]>(initial?.actions ?? []),
    selected = signal(-1),
    notice = signal("");
  const paused = signal(false),
    menu = signal(false),
    review = signal<number | null>(null),
    replaying = signal(false),
    size = signal(340);
  const setup = signal(
      props.kind === "junqi" && props.mode !== "aiai" && !initial ? 1 : 0,
    ),
    handoff = signal(
      !!initial && props.kind === "junqi" && props.mode === "pvp",
    ),
    drawOffer = signal(false);
  const started = signal(initial?.startedAt ?? Date.now()),
    undos = signal(initial?.undos ?? 0),
    timeouts = signal(initial?.timeouts ?? 0);
  const control = findTimeControl(
    props.kind,
    initial?.timeControl ?? props.timeControl,
  );
  const clock = signal(
    restoreClock(
      props.kind,
      initial?.clock,
      clockSlotForMatch(match()),
    ) ?? createClock(control, clockSlotForMatch(match())),
  );
  const view = computed(() =>
    review() === null
      ? match()
      : (replayMatch(
          props.kind,
          actions().slice(0, review()!),
          initialBoard(),
          players,
        ) ?? match()),
  );
  const turn = computed(() => match().state.turn),
    blocked = computed(
      () =>
        !!match().state.result ||
        setup() > 0 ||
        handoff() ||
        paused() ||
        menu() ||
        props.helpOpen ||
        review() !== null ||
        (match().state as RoyalState).adjudication === true,
    );
  const human = computed(
    () =>
      !blocked() &&
      (props.mode === "pvp" || (props.mode === "pve" && turn() === 1)),
  );
  const targets = computed(() => {
    const m = view(),
      from = selected();
    if (from < 0) return [];
    if (m.kind === "chess" || m.kind === "xiangqi")
      return royalLegalMoves(m.state)
        .filter((x) => x.from === from)
        .map((x) => x.to);
    if (m.kind === "checkers") return checkerMoves(m.state, from);
    if (m.kind === "junqi") return junqiMoves(m.state, from);
    return [];
  });
  const promotion = signal<{ from: number; to: number } | null>(null);
  function snapshot(): SavedGame | null {
    if (props.mode === "aiai" || match().state.result || setup()) return null;
    return {
      kind: props.kind,
      moves: [],
      actions: actions(),
      initialBoard: initialBoard(),
      checkerPlayers: props.kind === "checkers" ? players : undefined,
      mode: props.mode,
      level: props.level,
      limitOn: props.limitOn,
      leftMs: remainingMs(sideOf(clock(), clock().turn)),
      clock: clock(),
      timeControl: control.id,
      undos: undos(),
      timeouts: timeouts(),
      startedAt: started(),
      savedAt: Date.now(),
    };
  }
  function finish(winner: number, reason: string) {
    if (match().state.result) return;
    const m = match();
    match.set({
      ...m,
      state: { ...m.state, result: { winner, reason } },
    } as Match);
  }
  function followingPlayer(player = turn()): number {
    if (props.kind === "checkers")
      return player === players ? 1 : player + 1;
    if (props.kind === "ludo") return (player % 4) + 1;
    return player === 1 ? 2 : 1;
  }
  function syncTime(now = Date.now()): boolean {
    if (!props.limitOn || props.mode === "aiai") return true;
    const r = tickClock(clock(), now);
    clock.set(r.clock);
    if (r.timeout !== null && isComplexGame(props.kind)) {
      const m = match(),
        loss = turn() as Player;
      const res =
        m.kind === "chess" || m.kind === "xiangqi"
          ? timeoutRoyal(m.state, loss)
          : { winner: followingPlayer(loss), reason: "超时判负" };
      props.playSound("timeout");
      timeouts.update((n) => n + 1);
      finish(res.winner, res.reason);
      return false;
    }
    return true;
  }
  function commit(a: Action) {
    const now = Date.now();
    if (match().state.result || !syncTime(now)) return;
    const before = match(),
      next = applyAction(before, a);
    if (!next) return;
    const endedTurn = completesTurn(before, next, a);
    let nextClock = clock();
    if (props.limitOn && props.mode !== "aiai") {
      if (control.kind === "per-move" && endedTurn)
        nextClock = {
          ...createClock(control, clockSlotForMatch(next), now),
          moveNo: nextClock.moveNo + 1,
        };
      else if (endedTurn)
        nextClock = clockAfterMove(
          nextClock,
          clockSlotForMatch(before),
          now,
        ).clock;
    } else {
      nextClock = {
        ...nextClock,
        turn: clockSlotForMatch(next),
        moveNo: nextClock.moveNo + (endedTurn ? 1 : 0),
        lastAt: now,
      };
    }
    batch(() => {
      clock.set(nextClock);
      match.set(next);
      actions.update((xs) => xs.concat([a]));
      selected.set(-1);
      promotion.set(null);
      drawOffer.set(false);
      if (
        next.kind === "junqi" &&
        before.kind === "junqi" &&
        a.from !== undefined &&
        a.to !== undefined &&
        before.state.board[a.to]
      )
        notice.set(
          !next.state.board[a.to]
            ? "战斗：双方同归于尽"
            : next.state.board[a.to] === before.state.board[a.from]
              ? "战斗：进攻方获胜"
              : "战斗：防守方获胜",
        );
      if (props.kind === "junqi" && props.mode === "pvp" && !next.state.result)
        handoff.set(true);
    });
    props.playSound("place");
    if (
      (next.kind === "xiangqi" || next.kind === "chess") &&
      !next.state.result &&
      inCheck(next.state)
    ) {
      notice.set(
        next.kind === "xiangqi" ? "将军！请应将" : "将军 · 国王正在受攻击",
      );
      if (next.kind === "xiangqi") props.playSound("check");
    }
  }
  function onCell(i: number) {
    if (props.helpOpen || menu() || handoff()) return;
    if (setup()) {
      const m = match();
      if (m.kind !== "junqi") return;
      const p = setup(),
        v = m.state.board[i];
      if (!v || (v > 0 ? 1 : 2) !== p) return;
      if (selected() < 0) {
        selected.set(i);
        return;
      }
      const board = m.state.board.slice();
      [board[i], board[selected()]] = [board[selected()], board[i]];
      if (validDeployment(board, p as Player)) {
        match.set({ ...m, state: { ...m.state, board } });
        notice.set("布阵已调整");
      } else
        notice.set("非法布阵：军旗须在大本营，地雷在后两排，炸弹不得在前排");
      selected.set(-1);
      return;
    }
    if (!human()) return;
    const m = match();
    if (m.kind === "connect6") {
      commit({ to: i });
      return;
    }
    if (m.kind === "ludo") return;
    const v = m.state.board[i],
      p = m.kind === "checkers" ? v : v > 0 ? 1 : v < 0 ? 2 : 0;
    if (p === turn()) {
      selected.set(selected() === i ? -1 : i);
      return;
    }
    if (!targets().includes(i)) {
      notice.set("请选择高亮的合法落点");
      return;
    }
    if (
      m.kind === "chess" &&
      royalLegalMoves(m.state).some(
        (x) => x.from === selected() && x.to === i && x.promotion,
      )
    )
      promotion.set({ from: selected(), to: i });
    else commit({ from: selected(), to: i });
  }
  function undo() {
    if (
      match().state.result ||
      !actions().length ||
      setup() ||
      props.kind === "junqi" ||
      props.mode === "aiai"
    )
      return;
    const now = Date.now();
    if (props.limitOn && !blocked() && !syncTime(now)) return;
    if (
      props.limitOn &&
      control.kind === "per-move" &&
      remainingMs(sideOf(clock(), clock().turn)) <= 0
    )
      return;
    let n = actions().length - 1;
    if (props.mode === "pve")
      while (
        n > 0 &&
        replayMatch(
          props.kind,
          actions().slice(0, n),
          initialBoard(),
          players,
        )?.state.turn !== 1
      )
        n--;
    const a = actions().slice(0, n),
      m = replayMatch(props.kind, a, initialBoard(), players);
    if (!m) return;
    const movers: Player[] = [];
    let cursor = m;
    for (const action of actions().slice(n)) {
      const next = applyAction(cursor, action);
      if (!next) return;
      if (completesTurn(cursor, next, action))
        movers.push(clockSlotForMatch(cursor));
      cursor = next;
    }
    const rewound = props.limitOn
      ? clockAfterUndo(
          clock(),
          movers,
          clockSlotForMatch(m),
          now,
          !blocked(),
        )
      : {
          clock: {
            ...clock(),
            turn: clockSlotForMatch(m),
            moveNo: Math.max(0, clock().moveNo - movers.length),
            lastAt: now,
          },
          timeout: null,
        };
    batch(() => {
      match.set(m);
      actions.set(a);
      selected.set(-1);
      undos.update((v) => v + 1);
      clock.set(rewound.clock);
    });
    if (rewound.timeout !== null) {
      const result =
        m.kind === "chess" || m.kind === "xiangqi"
          ? timeoutRoyal(m.state, rewound.timeout)
          : {
              winner: followingPlayer(m.state.turn),
              reason: "超时判负",
            };
      finish(result.winner, result.reason);
    } else notice.set("已悔棋，撤回加秒与阶段加时，不返还已用时间");
  }
  function record() {
    const r = match().state.result;
    if (props.kind === "junqi" && props.mode !== "aiai" && !r) {
      notice.set("暗棋对局结束后才能保存公开棋谱");
      return;
    }
    props.onRecord({
      game: props.kind,
      mode: props.mode,
      level: props.level,
      actions: actions(),
      initialBoard: initialBoard(),
      checkerPlayers: props.kind === "checkers" ? players : undefined,
      result: r
        ? `${r.winner ? `玩家${r.winner}胜` : "和棋"} · ${"reason" in r ? r.reason : "连六"}`
        : undefined,
    });
    notice.set("棋谱已保存");
  }
  let settled = false;
  effect(() => {
    const r = match().state.result;
    if (!r || settled) return;
    settled = true;
    const reason =
      "reason" in r ? r.reason : r.winner ? "连六获胜" : "棋盘已满";
    props.onSnapshot(null);
    props.playSound(
      r.winner === 0
        ? "draw"
        : props.mode === "pve" && r.winner !== 1
          ? "loss"
          : "win",
    );
    props.onFinish({
      result: `${r.winner ? `玩家${r.winner}胜` : "和棋"} · ${reason}`,
      outcome: outcomeForWinner(r.winner),
      moves: actions().length,
      undos: undos(),
      timeouts: timeouts(),
      seconds: Math.max(1, Math.round((Date.now() - started()) / 1000)),
    });
  });
  effect(() => {
    actions();
    setup();
    initialBoard();
    match();
    if (props.mode !== "aiai") untracked(() => props.onSnapshot(snapshot()));
  });
  effect(() => {
    if (!blocked() && props.mode !== "pvp") {
      if (props.mode === "pve" && turn() === 1) return;
      const captured = match();
      const timer = setTimeout(
        () => {
          if (untracked(() => match()) !== captured || untracked(blocked))
            return;
          let a: Action | null = null;
          try {
            a = matchAi(captured, props.level);
          } catch {
            a = matchAi(captured, "easy");
          }
          if (a) untracked(() => commit(a));
          else notice.set("当前无合法着");
        },
        props.mode === "aiai" ? 850 : 450,
      );
      return () => clearTimeout(timer);
    }
  });
  effect(() => {
    const stop = blocked() || !props.limitOn || props.mode === "aiai";
    untracked(() => clock.update((c) => ({ ...c, lastAt: Date.now() })));
    if (stop) return;
    const timer = setInterval(
      () =>
        untracked(() => {
          if (!syncTime()) return;
          const tick = tickClock(clock(), Date.now());
          if (tick.timeout !== null && !isComplexGame(props.kind)) {
            timeouts.update((n) => n + 1);
            props.playSound("timeout");
            notice.set("回合超时，系统代走合法着");
            const m = match();
            let a = matchAi(m, "easy");
            if (a) commit(a);
            if (
              m.kind === "connect6" &&
              match().kind === "connect6" &&
              match().state.turn === m.state.turn &&
              !match().state.result
            ) {
              a = matchAi(match(), "easy");
              if (a) commit(a);
            }
            if (
              m.kind === "ludo" &&
              "die" in match().state &&
              (match().state as { die: number }).die
            ) {
              a = matchAi(match(), "easy");
              if (a) commit(a);
            }
          }
        }),
      100,
    );
    return () => {
      clearInterval(timer);
      untracked(() => {
        if (!match().state.result) syncTime();
        props.onSnapshot(snapshot());
      });
    };
  });
  effect(() => {
    if (!replaying()) return;
    const timer = setInterval(() => {
      const n = untracked(() => review()) ?? 0;
      if (n >= untracked(() => actions().length)) {
        replaying.set(false);
        return;
      }
      review.set(n + 1);
    }, 550);
    return () => clearInterval(timer);
  });
  effect(() => {
    const timer = setInterval(
      () => untracked(() => props.onSnapshot(snapshot())),
      5000,
    );
    return () => clearInterval(timer);
  });
  let lastTick = "";
  effect(() => {
    const c = clock(),
      seconds = Math.ceil(remainingMs(sideOf(c, c.turn)) / 1000);
    if (
      blocked() ||
      !props.limitOn ||
      props.mode === "aiai" ||
      seconds > 5 ||
      seconds <= 0
    )
      return;
    const key = `${turn()}-${seconds}`;
    if (key !== lastTick) {
      lastTick = key;
      props.playSound("tick");
    }
  });
  const menuMaxHeight = Math.max(280, Math.min(640, windowSize().height - 72));
  return (
    <View style={{ flex: 1, width: "100%" }}>
      <Scroll
        testID={`${props.kind}-screen`}
        style={{ flex: 1, width: "100%" }}
        contentStyle={{ alignItems: "center", padding: 14 }}
      >
      <View style={{ width: "100%", maxWidth: 600, gap: 10 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 25, fontWeight: "700", color: C.ink }}>
            {gameName(props.kind)}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <PressButton
              label="规则"
              testID="extra-help"
              onPress={props.onHelp}
            />
            <PressButton
              label="菜单"
              testID="extra-menu"
              onPress={() => menu.update((v) => !v)}
            />
          </View>
        </View>
        <Text style={{ color: C.muted, fontSize: 12 }}>
          {gameMeta(props.kind).board} ·{" "}
          {props.mode === "pvp"
            ? props.kind === "ludo"
              ? "四人轮流"
              : props.kind === "checkers"
                ? `${players} 人轮流`
                : "本地双人"
            : props.mode === "aiai"
              ? "AI 观战"
              : "对战 AI"}{" "}
          · {props.limitOn ? control.label : "不限时"}
        </Text>
        <GuideStrip kind={props.kind} />
        <Text
          testID="extra-status"
          style={{
            fontSize: 15,
            color: PLAYER_COLORS[turn() - 1],
            fontWeight: "600",
          }}
        >
          {match().state.result
            ? `对局结束 · ${match().state.result!.winner ? `玩家${match().state.result!.winner}获胜` : "和棋"}`
            : setup()
              ? `玩家${setup()}布阵`
              : handoff()
                ? "请交给下一位玩家"
                : `轮到玩家${turn()}${match().kind === "connect6" ? ` · 本回合剩${(match().state as { left: number }).left}子` : ""}${paused() ? " · 暂停" : ""}`}
        </Text>
        <If when={props.limitOn && props.mode !== "aiai" && !setup()}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <If
              when={control.kind === "per-move"}
              else={
                <>
                  <Text
                    testID="extra-clock-1"
                    style={{
                      fontSize: 16,
                      color: clockUrgent(clock().p1, control)
                        ? C.accent
                        : C.ink,
                    }}
                  >
                    玩家1 {formatClock(clock().p1, control)}
                  </Text>
                  <Text
                    testID="extra-clock-2"
                    style={{
                      fontSize: 16,
                      color: clockUrgent(clock().p2, control)
                        ? C.accent
                        : C.ink,
                    }}
                  >
                    玩家2 {formatClock(clock().p2, control)}
                  </Text>
                </>
              }
            >
              <Text
                testID="extra-clock-current"
                style={{
                  fontSize: 16,
                  color: clockUrgent(sideOf(clock(), clock().turn), control)
                    ? C.accent
                    : C.ink,
                }}
              >
                当前回合 {formatClock(sideOf(clock(), clock().turn), control)}
              </Text>
            </If>
          </View>
        </If>
        <If when={notice()}>
          <Text
            testID="extra-notice"
            style={{ fontSize: 13, color: C.accent, lineHeight: 20 }}
          >
            {notice()}
          </Text>
        </If>
        <If
          when={handoff()}
          else={
            <View
              style={{ alignItems: "center", width: "100%" }}
              onLayout={(e) =>
                size.set(Math.max(200, Math.min(520, e.size.width)))
              }
            >
              <MultiBoard
                match={view}
                size={size}
                selected={selected}
                targets={targets}
                viewer={() => setup() || turn()}
                disabled={(!human() && !setup()) || handoff()}
                onCell={onCell}
                onPlane={(i) => {
                  if (human()) commit({ plane: i });
                }}
                reveal={props.mode === "aiai" || !!match().state.result}
              />
            </View>
          }
        >
          <View
            style={{
              height: 300,
              backgroundColor: C.ink,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 18 }}>
              棋盘已遮盖 · 交接设备
            </Text>
            <PressButton
              label="我已接手，显示我的棋子"
              testID="junqi-handoff"
              onPress={() => {
                handoff.set(false);
                clock.update((c) => ({ ...c, lastAt: Date.now() }));
              }}
            />
          </View>
        </If>
        <If when={setup() > 0 && !handoff()}>
          <PressButton
            label="确认布阵"
            testID="junqi-ready"
            onPress={() => {
              const m = match();
              if (
                m.kind !== "junqi" ||
                !validDeployment(m.state.board, setup() as Player)
              )
                return;
              selected.set(-1);
              if (props.mode === "pvp" && setup() === 1) {
                setup.set(2);
                handoff.set(true);
              } else {
                initialBoard.set(m.state.board.slice());
                setup.set(0);
                clock.set(createClock(control));
                if (props.mode === "pvp") handoff.set(true);
              }
            }}
          />
        </If>
        <If when={props.kind === "ludo"}>
          <PressButton
            label={
              "die" in match().state && (match().state as { die: number }).die
                ? `骰子 ${(match().state as { die: number }).die} · 请选择飞机`
                : "掷骰"
            }
            testID="ludo-roll"
            disabled={
              !human() ||
              ("die" in match().state &&
                (match().state as { die: number }).die > 0)
            }
            onPress={() =>
              commit({ roll: true, die: 1 + Math.floor(Math.random() * 6) })
            }
          />
          <Each of={[0, 1, 2, 3]}>
            {(i) => (
              <PressButton
                label={`移动飞机${i() + 1}`}
                testID={`ludo-move-${i()}`}
                disabled={
                  !human() ||
                  match().kind !== "ludo" ||
                  !ludoLegal(
                    (match() as Extract<Match, { kind: "ludo" }>).state,
                  ).includes(i())
                }
                onPress={() => commit({ plane: i() })}
              />
            )}
          </Each>
        </If>
        <If
          when={
            props.kind === "xiangqi" &&
            (match().state as RoyalState).adjudication
          }
        >
          <View
            testID="xiangqi-adjudication"
            style={{
              backgroundColor: C.panel,
              padding: 14,
              borderRadius: 12,
              gap: 8,
            }}
          >
            <Text style={{ color: C.ink, fontSize: 14, lineHeight: 22 }}>
              局面已三次重复。单方长将已自动判断；长捉、兑、献、拦等复杂棋例需要按赛事棋例由裁判裁定。棋钟暂停，可查看刚才的走法后录入裁定。
            </Text>
            <PressButton
              label="双方均允许不变 · 和棋"
              testID="xq-rule-draw"
              onPress={() => finish(0, "重复局面，双方允许不变")}
            />
            <PressButton
              label="红方长捉等违规 · 红负"
              testID="xq-rule-red-loss"
              onPress={() => finish(2, "裁判裁定：红方禁着不变判负")}
            />
            <PressButton
              label="黑方长捉等违规 · 黑负"
              testID="xq-rule-black-loss"
              onPress={() => finish(1, "裁判裁定：黑方禁着不变判负")}
            />
            <Text style={{ color: C.muted, fontSize: 12 }}>
              {actions()
                .slice(-12)
                .filter((a) => a.from !== undefined)
                .map(
                  (a) =>
                    `${(a.from! % 9) + 1}列${Math.floor(a.from! / 9) + 1}行 → ${(a.to! % 9) + 1}列${Math.floor(a.to! / 9) + 1}行`,
                )
                .join("；")}
            </Text>
          </View>
        </If>
        <If when={promotion()}>
          <Text style={{ color: C.ink }}>兵到达末排，请选择升变棋子：</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Each
              of={[
                { t: 5, label: "后" },
                { t: 4, label: "车" },
                { t: 3, label: "象" },
                { t: 2, label: "马" },
              ]}
            >
              {(p) => (
                <PressButton
                  label={p().label}
                  testID={`promote-${p().t}`}
                  onPress={() => {
                    const a = promotion();
                    if (a) commit({ ...a, promotion: p().t });
                  }}
                />
              )}
            </Each>
          </View>
        </If>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <PressButton
            label="悔棋"
            testID="extra-undo"
            disabled={
              !actions().length ||
              !!match().state.result ||
              props.kind === "junqi" ||
              props.mode === "aiai"
            }
            onPress={undo}
          />
          <PressButton
            label={paused() ? "继续" : "暂停"}
            testID="extra-pause"
            disabled={!!match().state.result || setup() > 0}
            onPress={() => paused.update((v) => !v)}
          />
          <PressButton
            label="保存棋谱"
            testID="extra-record"
            disabled={
              props.kind === "junqi" &&
              props.mode !== "aiai" &&
              !match().state.result
            }
            onPress={record}
          />
          <PressButton
            label="首页"
            testID="extra-back"
            onPress={() => {
              props.onSnapshot(snapshot());
              props.onHome();
            }}
          />
        </View>
        <If when={!match().state.result && !setup()}>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <ConfirmButton
              label="认输"
              confirmLabel="确认认输"
              disabled={!human() || props.kind === "ludo"}
              testID="extra-resign"
              onConfirm={() => {
                if (human()) finish(followingPlayer(), "认输");
              }}
            />
            <If when={props.kind !== "ludo"}>
              <PressButton
                label="提议和棋"
                disabled={!human()}
                testID="extra-draw"
                onPress={() => drawOffer.set(true)}
              />
            </If>
            <If when={props.kind === "chess" || props.kind === "xiangqi"}>
              <PressButton
                label="申请规则和棋"
                testID={
                  props.kind === "chess" ? "chess-claim" : "xiangqi-claim"
                }
                disabled={!human() || !drawClaim(match().state as RoyalState)}
                onPress={() => {
                  const reason = drawClaim(match().state as RoyalState);
                  if (reason) finish(0, reason);
                }}
              />
            </If>
          </View>
        </If>
        <If when={drawOffer()}>
          <Text style={{ color: C.ink }}>双方同意才能协议和棋。</Text>
          <PressButton
            label={props.mode === "pve" ? "AI仅在均衡残局接受" : "对方接受和棋"}
            testID="extra-draw-accept"
            onPress={() => {
              if (props.mode === "pve") {
                notice.set("AI暂不接受，继续对局");
                drawOffer.set(false);
              } else finish(0, "双方协议和棋");
            }}
          />
          <PressButton label="继续对局" onPress={() => drawOffer.set(false)} />
        </If>
        <If when={props.mode === "aiai" || !!match().state.result}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <PressButton
              label="上一步"
              testID="extra-prev"
              disabled={(review() ?? actions().length) === 0}
              onPress={() =>
                review.set(Math.max(0, (review() ?? actions().length) - 1))
              }
            />
            <PressButton
              label="下一步"
              testID="extra-next"
              disabled={review() === null || review()! >= actions().length}
              onPress={() =>
                review.update((n) => Math.min(actions().length, (n ?? 0) + 1))
              }
            />
            <PressButton
              label={replaying() ? "停止回放" : "整局回放"}
              testID="extra-replay"
              onPress={() => {
                if (replaying()) replaying.set(false);
                else {
                  review.set(0);
                  replaying.set(true);
                }
              }}
            />
            <PressButton
              label="回到当前局面"
              testID="extra-current"
              onPress={() => {
                review.set(null);
                replaying.set(false);
              }}
            />
          </View>
        </If>
      </View>
      </Scroll>
      <If when={menu()}>
        <View
          testID="extra-menu-overlay"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 20,
          }}
        >
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(38,28,18,0.42)",
            }}
            onPress={() => menu.set(false)}
          />
          <Scroll
            testID="extra-menu-panel"
            style={{
              width: "100%",
              maxWidth: 420,
              maxHeight: menuMaxHeight,
              backgroundColor: C.panel,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: C.line,
              boxShadow: "0 24px 60px rgba(40,26,12,0.34)",
            }}
            contentStyle={{ padding: 18, gap: 9 }}
          >
            <View style={{ gap: 3, marginBottom: 3 }}>
              <Text style={{ fontSize: 20, fontWeight: "700", color: C.ink }}>
                对局菜单
              </Text>
              <Text style={{ fontSize: 10, color: C.muted, letterSpacing: 1.2 }}>
                {gameName(props.kind)} · 本地菜单打开期间暂停棋钟
              </Text>
            </View>
            <Text style={{ color: C.muted, fontSize: 12, lineHeight: 19 }}>
              新时限和难度在首页设置后，开新局生效。
            </Text>
            <PressButton
              label="返回对局"
              testID="extra-menu-close"
              onPress={() => menu.set(false)}
            />
            <PressButton
              label="保存棋谱"
              testID="extra-save"
              disabled={
                props.kind === "junqi" &&
                props.mode !== "aiai" &&
                !match().state.result
              }
              onPress={record}
            />
            <ConfirmButton
              label="重新开始"
              confirmLabel="确认重开"
              testID="extra-restart"
              onConfirm={() => {
                settled = false;
                batch(() => {
                  const nextMatch = createMatch(props.kind, players);
                  match.set(nextMatch);
                  actions.set([]);
                  initialBoard.set(undefined);
                  clock.set(
                    createClock(control, clockSlotForMatch(nextMatch)),
                  );
                  review.set(null);
                  replaying.set(false);
                  setup.set(
                    props.kind === "junqi" && props.mode !== "aiai" ? 1 : 0,
                  );
                  handoff.set(false);
                  selected.set(-1);
                  menu.set(false);
                  paused.set(false);
                  promotion.set(null);
                  notice.set("");
                  drawOffer.set(false);
                  undos.set(0);
                  timeouts.set(0);
                  started.set(Date.now());
                });
              }}
            />
            <PressButton
              label="返回首页"
              testID="extra-home"
              onPress={() => {
                props.onSnapshot(snapshot());
                props.onHome();
              }}
            />
          </Scroll>
        </View>
      </If>
    </View>
  );
}
