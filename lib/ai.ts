/**
 * 五子棋 AI：启发式评估 + 带 alpha-beta 剪枝的负极大值搜索。
 * 全部为纯计算，无全局状态，不产生副作用，可安全地反复调用。
 */

import { CELL_COUNT, SIZE, type Difficulty, type Player } from "./gomoku";

const N = SIZE;
const FIVE = 10_000_000;
/** 判定“这一手直接成五”的阈值 */
const WIN_MOVE = 5_000_000;

const DX = [1, 0, 1, 1] as const;
const DY = [0, 1, 1, -1] as const;

/* ------------------------------------------------------------------ */
/* 距离表：near1 为切比雪夫距离 1，near2 为距离 2                      */
/* ------------------------------------------------------------------ */

const NEIGH1: number[][] = [];
const NEIGH2: number[][] = [];

for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    const a: number[] = [];
    const b: number[] = [];
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const j = ny * N + nx;
        b.push(j);
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) a.push(j);
      }
    }
    NEIGH1.push(a);
    NEIGH2.push(b);
  }
}

/* ------------------------------------------------------------------ */
/* 单点评分                                                            */
/* ------------------------------------------------------------------ */

/** 一段连子（run 个）带 open 个活端时的价值 */
function runScore(run: number, open: number): number {
  if (run >= 5) return FIVE;
  if (open === 0) return 0;
  if (run === 4) return open === 2 ? 400_000 : 60_000;
  if (run === 3) return open === 2 ? 30_000 : 3_000;
  if (run === 2) return open === 2 ? 1_200 : 200;
  if (open === 2) return 40;
  return 10;
}

/**
 * 假设 p 在 (x, y)（必须为空）落子后，该点在四个方向上的威胁价值。
 * 除连续子外，还识别“隔一子”的跳型（如 ●○●●）。
 */
function scorePoint(b: Uint8Array, x: number, y: number, p: number): number {
  let total = 0;
  let strong = 0;

  for (let d = 0; d < 4; d++) {
    const dx = DX[d];
    const dy = DY[d];

    let run = 1;
    let open = 0;
    let jump = 0;

    // 正方向
    let i = 1;
    while (i <= 4) {
      const nx = x + dx * i;
      const ny = y + dy * i;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) break;
      if (b[ny * N + nx] !== p) break;
      run++;
      i++;
    }
    {
      const nx = x + dx * i;
      const ny = y + dy * i;
      if (nx >= 0 && ny >= 0 && nx < N && ny < N) {
        if (b[ny * N + nx] === 0) {
          open++;
          // 跳型：空格之后还有己方子
          let j = i + 1;
          let c = 0;
          while (j <= 5) {
            const gx = x + dx * j;
            const gy = y + dy * j;
            if (gx < 0 || gy < 0 || gx >= N || gy >= N) break;
            if (b[gy * N + gx] !== p) break;
            c++;
            j++;
          }
          if (c > 0 && run + c < 5) jump += runScore(run + c, 1) * 0.45;
        }
      }
    }

    // 反方向
    let k = 1;
    while (k <= 4) {
      const nx = x - dx * k;
      const ny = y - dy * k;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) break;
      if (b[ny * N + nx] !== p) break;
      run++;
      k++;
    }
    {
      const nx = x - dx * k;
      const ny = y - dy * k;
      if (nx >= 0 && ny >= 0 && nx < N && ny < N) {
        if (b[ny * N + nx] === 0) {
          open++;
          let j = k + 1;
          let c = 0;
          while (j <= 5) {
            const gx = x - dx * j;
            const gy = y - dy * j;
            if (gx < 0 || gy < 0 || gx >= N || gy >= N) break;
            if (b[gy * N + gx] !== p) break;
            c++;
            j++;
          }
          if (c > 0 && run + c < 5) jump += runScore(run + c, 1) * 0.45;
        }
      }
    }

    const s = runScore(run, open) + jump;
    if (s >= 25_000) strong++;
    total += s;
  }

  // 双威胁（双三 / 四三）额外加权
  if (strong >= 2) total *= 1.7;
  return total;
}

/* ------------------------------------------------------------------ */
/* 候选点分析                                                          */
/* ------------------------------------------------------------------ */

interface Candidate {
  i: number;
  x: number;
  y: number;
  /** 我方在此落子的价值 */
  my: number;
  /** 对手在此落子的价值（即我在此防守的价值） */
  th: number;
  score: number;
}

interface Analysis {
  list: Candidate[];
  myBest: number;
  thBest: number;
}

const DEFENSE = 0.92;

function analyze(
  b: Uint8Array,
  near: Uint8Array,
  p: number,
  limit: number,
): Analysis {
  const opp = 3 - p;
  const list: Candidate[] = [];
  let myBest = 0;
  let thBest = 0;

  for (let i = 0; i < CELL_COUNT; i++) {
    if (b[i] !== 0 || near[i] === 0) continue;
    const x = i % N;
    const y = (i - x) / N;
    const my = scorePoint(b, x, y, p);
    const th = scorePoint(b, x, y, opp);
    if (my > myBest) myBest = my;
    if (th > thBest) thBest = th;
    list.push({ i, x, y, my, th, score: my + th * DEFENSE });
  }

  list.sort((a, c) => c.score - a.score);
  if (list.length > limit) list.length = limit;
  return { list, myBest, thBest };
}

/* ------------------------------------------------------------------ */
/* 落子 / 撤销（维护 near 计数）                                       */
/* ------------------------------------------------------------------ */

function place(b: Uint8Array, n1: Uint8Array, n2: Uint8Array, i: number, p: number): void {
  b[i] = p;
  const a = NEIGH1[i];
  for (let k = 0; k < a.length; k++) n1[a[k]]++;
  const c = NEIGH2[i];
  for (let k = 0; k < c.length; k++) n2[c[k]]++;
}

function unplace(b: Uint8Array, n1: Uint8Array, n2: Uint8Array, i: number): void {
  b[i] = 0;
  const a = NEIGH1[i];
  for (let k = 0; k < a.length; k++) n1[a[k]]--;
  const c = NEIGH2[i];
  for (let k = 0; k < c.length; k++) n2[c[k]]--;
}

/* ------------------------------------------------------------------ */
/* 搜索                                                                */
/* ------------------------------------------------------------------ */

interface Ctx {
  nodes: number;
  maxNodes: number;
  deadline: number;
  aborted: boolean;
}

function outOfBudget(ctx: Ctx): boolean {
  if (ctx.aborted) return true;
  if (ctx.nodes > ctx.maxNodes) {
    ctx.aborted = true;
    return true;
  }
  // 每 32 个节点看一次时间，避免在慢设备上超出单次调用预算
  if ((ctx.nodes & 31) === 0 && Date.now() > ctx.deadline) {
    ctx.aborted = true;
    return true;
  }
  return false;
}

/**
 * 静态评估：我方最好的落点价值 减去 对手最好的落点价值（略微偏防守）。
 * 只用于叶子节点，衡量“谁的威胁更大”。
 */
function staticEval(b: Uint8Array, near: Uint8Array, p: number): number {
  const { myBest, thBest } = analyze(b, near, p, 1);
  return myBest - thBest * 1.08;
}

/** 从 p 的视角返回局面分数（正数对 p 有利）。 */
function negamax(
  b: Uint8Array,
  n1: Uint8Array,
  n2: Uint8Array,
  p: number,
  depth: number,
  alpha: number,
  beta: number,
  ctx: Ctx,
): number {
  ctx.nodes++;
  const opp = 3 - p;
  const near = depth >= 3 ? n2 : n1;
  const { list, myBest, thBest } = analyze(b, near, p, depth >= 3 ? 8 : 6);

  if (list.length === 0) return 0;
  // 自己能成五：直接取胜，越早越好
  if (myBest >= WIN_MOVE) return FIVE + depth * 10_000;

  if (thBest >= WIN_MOVE) {
    // 对手下一手成五：只有堵点有意义
    const blocks = list.filter((m) => m.th >= WIN_MOVE);
    if (blocks.length === 0) return -(FIVE + depth * 10_000);
    if (depth === 0 || outOfBudget(ctx)) {
      // 叶子处做一次静态延伸：假定堵住后由对手评估，避免把“可堵的四”当成必败
      let best = -Infinity;
      for (const m of blocks) {
        place(b, n1, n2, m.i, p);
        const v = -staticEval(b, n1, opp);
        unplace(b, n1, n2, m.i);
        if (v > best) best = v;
      }
      return best;
    }
    let best = -Infinity;
    for (const m of blocks) {
      place(b, n1, n2, m.i, p);
      const v = -negamax(b, n1, n2, opp, depth - 1, -beta, -alpha, ctx);
      unplace(b, n1, n2, m.i);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
      if (outOfBudget(ctx)) break;
    }
    return best;
  }

  if (depth === 0 || outOfBudget(ctx)) return myBest - thBest * 1.08;

  let best = -Infinity;
  for (const m of list) {
    place(b, n1, n2, m.i, p);
    const v = -negamax(b, n1, n2, opp, depth - 1, -beta, -alpha, ctx);
    unplace(b, n1, n2, m.i);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
    if (outOfBudget(ctx)) break;
  }
  return best === -Infinity ? myBest - thBest * 1.08 : best;
}

/* ------------------------------------------------------------------ */
/* 对外入口                                                            */
/* ------------------------------------------------------------------ */

export interface AiChoice {
  x: number;
  y: number;
}

function buildNear(b: Uint8Array): { n1: Uint8Array; n2: Uint8Array } {
  const n1 = new Uint8Array(CELL_COUNT);
  const n2 = new Uint8Array(CELL_COUNT);
  for (let i = 0; i < CELL_COUNT; i++) {
    if (b[i] === 0) continue;
    const a = NEIGH1[i];
    for (let k = 0; k < a.length; k++) n1[a[k]]++;
    const c = NEIGH2[i];
    for (let k = 0; k < c.length; k++) n2[c[k]]++;
  }
  return { n1, n2 };
}

/**
 * 单步搜索的预算与随机源。默认取档位设定；测试里把时间预算放大、
 * 随机源换成固定种子，同一局就能逐手复现（否则搜到哪一层取决于
 * 机器快慢，简单档还会随机挑点，自对弈结果无法重现）。
 */
export interface MoveOptions {
  /** 搜索节点上限 */
  maxNodes?: number;
  /** 单步时间上限（毫秒） */
  deadlineMs?: number;
  /** 随机源，简单档挑点用 */
  random?: () => number;
}

function pickEasy(list: Candidate[], random: () => number): AiChoice {
  const top = list.slice(0, 3);
  const r = random();
  const pick = r < 0.55 ? 0 : r < 0.85 ? 1 : 2;
  const m = top[Math.min(pick, top.length - 1)];
  return { x: m.x, y: m.y };
}

/**
 * 计算最佳落子。棋盘为满盘或无可下点时返回 null。
 * 时间复杂度受节点与时间预算约束（hard 档最坏约 700ms）。
 */
export function findBestMove(
  board: readonly number[],
  player: Player,
  level: Difficulty,
  options?: MoveOptions,
): AiChoice | null {
  const b = Uint8Array.from(board);
  const { n1, n2 } = buildNear(b);

  let stones = 0;
  for (let i = 0; i < CELL_COUNT; i++) if (b[i] !== 0) stones++;
  if (stones === 0) return { x: 7, y: 7 };
  if (stones === CELL_COUNT) return null;

  const root = analyze(b, n2, player, 12);
  if (root.list.length === 0) {
    for (let i = 0; i < CELL_COUNT; i++) if (b[i] === 0) return { x: i % N, y: (i - (i % N)) / N };
    return null;
  }

  // 1) 能赢就赢
  for (const m of root.list) {
    if (m.my >= WIN_MOVE) return { x: m.x, y: m.y };
  }
  // 2) 对手能赢必须堵
  const blocks = root.list.filter((m) => m.th >= WIN_MOVE);
  const pool = blocks.length > 0 ? blocks : root.list;

  if (level === "easy") return pickEasy(pool, options?.random ?? Math.random);

  const depth = level === "hard" ? 4 : 2;
  const ctx: Ctx = {
    nodes: 0,
    maxNodes: options?.maxNodes ?? (level === "hard" ? 24_000 : 8_000),
    deadline:
      Date.now() + (options?.deadlineMs ?? (level === "hard" ? 320 : 140)),
    aborted: false,
  };

  // 根节点候选过多会拖慢搜索，取排序靠前的若干个
  const searched = pool.length > 8 ? pool.slice(0, 8) : pool;

  let bestMove = searched[0];
  let bestScore = -Infinity;
  for (const m of searched) {
    place(b, n1, n2, m.i, player);
    const v = -negamax(b, n1, n2, 3 - player, depth - 1, -Infinity, Infinity, ctx);
    unplace(b, n1, n2, m.i);
    if (v > bestScore) {
      bestScore = v;
      bestMove = m;
    }
  }

  return { x: bestMove.x, y: bestMove.y };
}


/**
 * 兜底落子：AI 计算异常或超时预算时使用，保证轮次永远能继续。
 * 优先落在已有棋子旁边，否则取任意空点。
 */
export function fallbackMove(board: readonly number[]): AiChoice | null {
  for (let i = 0; i < CELL_COUNT; i++) {
    if (board[i] !== 0) continue;
    const x = i % N;
    const y = (i - x) / N;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        if (board[ny * N + nx] !== 0) return { x, y };
      }
    }
  }
  for (let i = 0; i < CELL_COUNT; i++) {
    if (board[i] === 0) {
      const x = i % N;
      return { x, y: (i - x) / N };
    }
  }
  return null;
}
