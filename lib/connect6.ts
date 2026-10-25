/**
 * 六子冲（民间又称六儿冲、六门儿）：4×4 棋盘，双方各六子。
 *
 * 普通回合沿横线或竖线移动一格；只剩一子时可沿无阻挡直线任意移动，
 * 称为“独飞”。走子后按二打一、单线二打二（部分地区称单线双顶吃）、
 * 夹吃与挑吃规则吃子，把对方减到一子或让对方无合法着法即获胜。规则
 * 函数均不修改入参。
 */

import {
  other,
  type Difficulty,
  type GameResult,
  type Player,
} from "./gomoku";

export const C6_SIZE = 4;
export const C6_CELLS = C6_SIZE * C6_SIZE;
export const C6_PIECES = 6;

/** 玩家 1（黑）与玩家 2（白）的初始六子位置。 */
export const C6_INITIAL_P1 = [8, 11, 12, 13, 14, 15] as const;
export const C6_INITIAL_P2 = [0, 1, 2, 3, 4, 7] as const;

export interface C6Move {
  from: number;
  to: number;
  p: Player;
  /** 本手吃掉的全部敌子，供界面与棋谱反馈。 */
  captured?: number[];
}

export interface C6Result extends GameResult {
  kind: "win";
  winner: Player;
  line: number[];
  reason: string;
}

export interface C6State {
  board: number[];
  moves: C6Move[];
  turn: Player;
  result: C6Result | null;
}

export const c6Idx = (x: number, y: number): number => y * C6_SIZE + x;

export function c6InBoard(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < C6_SIZE && y < C6_SIZE;
}

export function createConnect6(): C6State {
  const board = new Array<number>(C6_CELLS).fill(0);
  for (const i of C6_INITIAL_P1) board[i] = 1;
  for (const i of C6_INITIAL_P2) board[i] = 2;
  return { board, moves: [], turn: 1, result: null };
}

const ORTHO = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

const otherPlayer = other;

function countPieces(board: readonly number[], p: Player): number {
  let n = 0;
  for (const v of board) if (v === p) n++;
  return n;
}

/** 从某一格出发的合法落点；独飞时可在整条无阻挡直线上移动。 */
export function c6LegalMoves(state: C6State, from: number): number[] {
  if (
    state.result ||
    !Number.isInteger(from) ||
    from < 0 ||
    from >= C6_CELLS ||
    state.board[from] !== state.turn
  )
    return [];
  const flying = countPieces(state.board, state.turn) === 1;
  const x = from % C6_SIZE,
    y = (from - x) / C6_SIZE,
    out: number[] = [];
  for (const [dx, dy] of ORTHO) {
    for (let step = 1; step < C6_SIZE; step++) {
      const nx = x + dx * step,
        ny = y + dy * step;
      if (!c6InBoard(nx, ny)) break;
      const i = c6Idx(nx, ny);
      if (state.board[i] !== 0) break;
      out.push(i);
      if (!flying) break;
    }
  }
  return out;
}

/**
 * 二打一要求恰好是「己-己-敌」或「敌-己-己」，且该三格两端紧邻处
 * 不再有棋子。这样可以排除三己一排、敌-己-己-敌、己-己-敌-敌与
 * 己-己-敌-己等不应吃子的图形。
 */
function isTwoBeatOne(
  left: number | null,
  triple: readonly number[],
  right: number | null,
  p: Player,
  moved: number,
  line: readonly number[],
  start: number,
): number | null {
  const enemy = otherPlayer(p);
  const contextClear = (v: number | null) => v === null || v === 0;
  if (
    triple[0] === p &&
    triple[1] === p &&
    triple[2] === enemy &&
    (moved === line[start] || moved === line[start + 1]) &&
    contextClear(left) &&
    contextClear(right)
  )
    return line[start + 2];
  if (
    triple[0] === enemy &&
    triple[1] === p &&
    triple[2] === p &&
    (moved === line[start + 1] || moved === line[start + 2]) &&
    contextClear(left) &&
    contextClear(right)
  )
    return line[start];
  return null;
}

/**
 * 单线二打二（部分地区称单线双顶吃）：主动排成正好四子相连，己方
 * 两子相连、敌方两子相连，吃掉相邻的那两枚敌子。四子外侧必须为空
 * 或棋盘边界。本应用固定采用这一地区变体。
 */
function doubleBeat(
  left: number | null,
  quad: readonly number[],
  right: number | null,
  p: Player,
  moved: number,
  line: readonly number[],
  start: number,
): number[] {
  const enemy = otherPlayer(p);
  if ((left !== null && left !== 0) || (right !== null && right !== 0))
    return [];
  if (
    quad[0] === p &&
    quad[1] === p &&
    quad[2] === enemy &&
    quad[3] === enemy &&
    (moved === line[start] || moved === line[start + 1])
  )
    return [line[start + 2], line[start + 3]];
  if (
    quad[0] === enemy &&
    quad[1] === enemy &&
    quad[2] === p &&
    quad[3] === p &&
    (moved === line[start + 2] || moved === line[start + 3])
  )
    return [line[start], line[start + 1]];
  return [];
}

function captureAfterMove(
  before: readonly number[],
  after: readonly number[],
  moved: number,
  p: Player,
): number[] {
  const enemy = otherPlayer(p),
    flying = countPieces(before, p) === 1,
    captured = new Set<number>();
  const lines: number[][] = [];
  for (let y = 0; y < C6_SIZE; y++)
    lines.push(Array.from({ length: C6_SIZE }, (_, x) => c6Idx(x, y)));
  for (let x = 0; x < C6_SIZE; x++)
    lines.push(Array.from({ length: C6_SIZE }, (_, y) => c6Idx(x, y)));

  for (const line of lines) {
    for (let start = 0; start <= C6_SIZE - 4; start++) {
      const quad = line.slice(start, start + 4).map((i) => after[i]);
      for (const i of doubleBeat(
        start > 0 ? after[line[start - 1]] : null,
        quad,
        start + 4 < C6_SIZE ? after[line[start + 4]] : null,
        p,
        moved,
        line,
        start,
      ))
        captured.add(i);
    }
    for (let start = 0; start <= C6_SIZE - 3; start++) {
      const cells = line.slice(start, start + 3),
        triple = cells.map((i) => after[i]),
        left = start > 0 ? after[line[start - 1]] : null,
        right = start + 3 < C6_SIZE ? after[line[start + 3]] : null;

      const twoOne = isTwoBeatOne(
        left,
        triple,
        right,
        p,
        moved,
        line,
        start,
      );
      if (twoOne !== null) captured.add(twoOne);

      // 夹吃：己-敌-己，外侧至少一处为空，吃中间一子。
      if (
        triple[0] === p &&
        triple[1] === enemy &&
        triple[2] === p &&
        (moved === cells[0] || moved === cells[2]) &&
        (left === 0 || right === 0)
      )
        captured.add(cells[1]);

      // 挑吃：独飞插到两枚敌子中间，同时吃掉两端。
      if (
        flying &&
        triple[0] === enemy &&
        triple[1] === p &&
        triple[2] === enemy &&
        moved === cells[1] &&
        (left === 0 || right === 0)
      ) {
        captured.add(cells[0]);
        captured.add(cells[2]);
      }
    }
  }
  return [...captured].sort((a, b) => a - b);
}

function legalMovesFor(
  board: readonly number[],
  p: Player,
  from: number,
): number[] {
  if (
    !Number.isInteger(from) ||
    from < 0 ||
    from >= C6_CELLS ||
    board[from] !== p
  )
    return [];
  const flying = countPieces(board, p) === 1;
  const x = from % C6_SIZE,
    y = (from - x) / C6_SIZE,
    out: number[] = [];
  for (const [dx, dy] of ORTHO) {
    for (let step = 1; step < C6_SIZE; step++) {
      const nx = x + dx * step,
        ny = y + dy * step;
      if (!c6InBoard(nx, ny)) break;
      const i = c6Idx(nx, ny);
      if (board[i] !== 0) break;
      out.push(i);
      if (!flying) break;
    }
  }
  return out;
}

function hasAnyMove(board: readonly number[], p: Player): boolean {
  for (let from = 0; from < C6_CELLS; from++)
    if (board[from] === p && legalMovesFor(board, p, from).length) return true;
  return false;
}

/** 执行一步；非法走法、占用落点或已结束对局返回 null。 */
export function moveConnect6(
  state: C6State,
  from: number,
  to: number,
): C6State | null {
  if (
    state.result ||
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    !legalMovesFor(state.board, state.turn, from).includes(to)
  )
    return null;

  const p = state.turn,
    board = state.board.slice();
  board[from] = 0;
  board[to] = p;
  const captured = captureAfterMove(state.board, board, to, p);
  for (const i of captured) board[i] = 0;

  const opponent = otherPlayer(p),
    opponentCount = countPieces(board, opponent),
    won = opponentCount <= 1 || !hasAnyMove(board, opponent),
    moves = state.moves.concat([{ from, to, p, captured }]);
  if (won)
    return {
      board,
      moves,
      turn: p,
      result: {
        kind: "win",
        winner: p,
        line: captured.slice(),
        reason: opponentCount <= 1 ? "对方仅剩一子" : "对方无棋可走",
      },
    };
  return { board, moves, turn: opponent, result: null };
}

/** 当前行棋方的全部合法着法，供 AI 与测试使用。 */
export function c6AllMoves(state: C6State): { from: number; to: number }[] {
  if (state.result) return [];
  const out: { from: number; to: number }[] = [];
  for (let from = 0; from < C6_CELLS; from++)
    if (state.board[from] === state.turn)
      for (const to of c6LegalMoves(state, from)) out.push({ from, to });
  return out;
}

/** 简单但会优先立即获胜和吃子的 AI。 */
export function connect6Ai(
  state: C6State,
  level: Difficulty,
): { from: number; to: number } | null {
  const choices = c6AllMoves(state);
  if (!choices.length) return null;
  if (level === "easy")
    return choices[Math.floor(Math.random() * choices.length)];

  const p = state.turn,
    enemy = otherPlayer(p);
  const scored = choices.map((choice) => {
    const next = moveConnect6(state, choice.from, choice.to)!,
      captures = next.moves[next.moves.length - 1].captured?.length ?? 0,
      enemyMoves = c6AllMoves({ ...next, turn: enemy, result: null });
    let danger = 0;
    for (const move of enemyMoves) {
      const reply = moveConnect6(
        { ...next, turn: enemy, result: null },
        move.from,
        move.to,
      );
      const amount = reply?.moves[reply.moves.length - 1].captured?.length ?? 0;
      if (amount > danger) danger = amount;
    }
    const x = choice.to % C6_SIZE,
      y = Math.floor(choice.to / C6_SIZE),
      center = 3 - (Math.abs(1.5 - x) + Math.abs(1.5 - y));
    const score =
      (next.result?.winner === p ? 1_000_000 : 0) +
      captures * 4_000 +
      (captures ? 800 : 0) -
      danger * 1_200 -
      enemyMoves.length * 8 +
      center * 6;
    return { choice, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].choice;
}
