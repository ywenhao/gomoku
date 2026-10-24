/**
 * 五子棋 AI：棋型评估 + alpha-beta 搜索 + VCF（连续冲四）战术。
 * 全部为纯计算，无全局状态，不产生副作用，可安全地反复调用。
 *
 * 强度分档：
 * - 简单：在候选中随机挑点，给新手留机会。
 * - 普通：2 层搜索，能看一步攻防。
 * - 困难：迭代加深 + VCF，能算连续冲四，不会再对人造的双威胁视而不见。
 * - 地狱：更大的搜索预算 + VCF 攻防过滤，先确认自己不会被连续冲四打死。
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

/** 每个点四个方向的 9 格射线（相对偏移 -4..4），出界记 -1。 */
const RAYS = new Int16Array(4 * CELL_COUNT * 9);

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

    const i = y * N + x;
    for (let d = 0; d < 4; d++) {
      const base = (d * CELL_COUNT + i) * 9;
      for (let k = 0; k < 9; k++) {
        const nx = x + DX[d] * (k - 4);
        const ny = y + DY[d] * (k - 4);
        RAYS[base + k] =
          nx < 0 || ny < 0 || nx >= N || ny >= N ? -1 : ny * N + nx;
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* 单点评分                                                            */
/* ------------------------------------------------------------------ */

/**
 * 一条五格窗口里，己方有 k 颗子时的价值。
 * 用“所有包含落点的五格窗口”求和，能自然识别跳型（如 ●○●●）、
 * 活四（两个四窗口）与冲四（一个四窗口），比只数直线连子更不容易漏棋。
 */
const WINDOW_SCORE = [0, 6, 220, 6_000, 120_000, FIVE];

/**
 * 单点计分的查表优化：把落点周围 9 格编码成四进制（0 空 / 1 己方 /
 * 2 对手 / 3 边界），预先算好每个方向的分数。搜索热点里只剩 36 次
 * 数组读取和 4 次查表，比逐窗口扫描快几倍。
 */
const PATTERN_SCORE = new Int32Array(4 ** 9);

{
  const cells = new Uint8Array(9);
  for (let left = 0; left < 4 ** 4; left++) {
    let l = left;
    for (let k = 3; k >= 0; k--) {
      cells[k] = l & 3;
      l >>= 2;
    }
    cells[4] = 1; // 落点本身一定是己方子

    for (let right = 0; right < 4 ** 4; right++) {
      let r = right;
      for (let k = 8; k >= 5; k--) {
        cells[k] = r & 3;
        r >>= 2;
      }

      let total = 0;
      for (let s = 0; s <= 4; s++) {
        let own = 0;
        let blocked = false;
        for (let k = 0; k < 5; k++) {
          const v = cells[s + k];
          if (v === 2 || v === 3) {
            blocked = true;
            break;
          }
          if (v === 1) own++;
        }
        if (!blocked) total += WINDOW_SCORE[own];
      }

      const code = (((left << 2) | 1) << 8) | right;
      PATTERN_SCORE[code] = total;
    }
  }
}

/** 落点周围格子的编码：0 空 / 1 己方 / 2 对手（3 留给边界）。 */
const MAP_ONE = Uint8Array.from([0, 1, 2]);
const MAP_TWO = Uint8Array.from([0, 2, 1]);

/**
 * 一次算出双方在 (i) 落子的价值：my 为 p 下这里的收益，th 为对手
 * 下这里的收益。两个编码共用一次棋盘读取，比分别评分快约一倍。
 */
function scorePair(
  b: Uint8Array,
  i: number,
  myMap: Uint8Array,
  thMap: Uint8Array,
  out: number[],
): void {
  let my = 0;
  let th = 0;

  for (let d = 0; d < 4; d++) {
    const base = (d * CELL_COUNT + i) * 9;
    let cm = 0;
    let ct = 0;

    for (let k = 0; k < 4; k++) {
      const j = RAYS[base + k];
      if (j < 0) {
        cm = (cm << 2) | 3;
        ct = (ct << 2) | 3;
      } else {
        const v = b[j];
        cm = (cm << 2) | myMap[v];
        ct = (ct << 2) | thMap[v];
      }
    }
    // 落点本身按己方子编码（调用方保证该点为空）
    cm = (cm << 2) | 1;
    ct = (ct << 2) | 1;
    for (let k = 5; k < 9; k++) {
      const j = RAYS[base + k];
      if (j < 0) {
        cm = (cm << 2) | 3;
        ct = (ct << 2) | 3;
      } else {
        const v = b[j];
        cm = (cm << 2) | myMap[v];
        ct = (ct << 2) | thMap[v];
      }
    }

    my += PATTERN_SCORE[cm];
    th += PATTERN_SCORE[ct];
  }

  out[0] = my;
  out[1] = th;
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
  /** 我方/对手威胁最高的三个点，用于叶子评估 */
  myTop: number[];
  thTop: number[];
}

const DEFENSE = 0.94;

/** 把 value 插进降序的前 3 名 */
function pushTop(top: number[], value: number): void {
  if (value <= top[2]) return;
  if (value > top[0]) {
    top[2] = top[1];
    top[1] = top[0];
    top[0] = value;
  } else if (value > top[1]) {
    top[2] = top[1];
    top[1] = value;
  } else {
    top[2] = value;
  }
}

function analyze(
  b: Uint8Array,
  near: Uint8Array,
  p: number,
  limit: number,
): Analysis {
  const list: Candidate[] = [];
  const myTop = [0, 0, 0];
  const thTop = [0, 0, 0];
  const pair = [0, 0];
  const myMap = p === 1 ? MAP_ONE : MAP_TWO;
  const thMap = p === 1 ? MAP_TWO : MAP_ONE;

  for (let i = 0; i < CELL_COUNT; i++) {
    if (b[i] !== 0 || near[i] === 0) continue;
    scorePair(b, i, myMap, thMap, pair);
    const my = pair[0];
    const th = pair[1];
    pushTop(myTop, my);
    pushTop(thTop, th);
    list.push({
      i,
      x: i % N,
      y: (i - (i % N)) / N,
      my,
      th,
      score: my + th * DEFENSE,
    });
  }

  list.sort((a, c) => c.score - a.score);
  if (list.length > limit) list.length = limit;
  return { list, myBest: myTop[0], thBest: thTop[0], myTop, thTop };
}

/* ------------------------------------------------------------------ */
/* 落子 / 撤销（维护 near 计数）                                       */
/* ------------------------------------------------------------------ */

function place(
  b: Uint8Array,
  n1: Uint8Array,
  n2: Uint8Array,
  i: number,
  p: number,
): void {
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

/** 在 i 落子后是否直接连成五子。 */
function winsAt(b: Uint8Array, i: number, p: number): boolean {
  const x = i % N;
  const y = (i - x) / N;
  for (let d = 0; d < 4; d++) {
    const dx = DX[d];
    const dy = DY[d];
    let run = 1;
    for (let sign = 1; sign >= -1; sign -= 2) {
      for (let k = 1; k <= 5; k++) {
        const nx = x + dx * k * sign;
        const ny = y + dy * k * sign;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) break;
        if (b[ny * N + nx] !== p) break;
        run++;
      }
    }
    if (run >= 5) return true;
  }
  return false;
}

/** 当前棋盘上轮到 p 时，能直接成五的落点（最多取 cap 个）。 */
function immediateWins(
  b: Uint8Array,
  n1: Uint8Array,
  p: number,
  cap = 2,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    // 任何成五点都紧挨着己方棋子，扫距离 1 的邻居就够
    if (b[i] !== 0 || n1[i] === 0) continue;
    if (winsAt(b, i, p)) {
      out.push(i);
      if (out.length >= cap) break;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* VCF：连续冲四取胜                                                   */
/* ------------------------------------------------------------------ */

interface VcfCtx {
  nodes: number;
  maxNodes: number;
  deadline: number;
  aborted: boolean;
}

/** 落子在 i 后（b[i] 已经是 p），本手形成了哪些“四”，以及是否直接成五。 */
function threatAt(
  b: Uint8Array,
  i: number,
  p: number,
): { win: boolean; fours: number[] } {
  if (winsAt(b, i, p)) return { win: true, fours: [] };

  const seen = new Set<number>();

  for (let d = 0; d < 4; d++) {
    const base = (d * CELL_COUNT + i) * 9;
    for (let s = 0; s <= 4; s++) {
      let own = 0;
      let empty = 0;
      let emptyAt = -1;
      let blocked = false;

      for (let k = s; k < s + 5; k++) {
        const j = RAYS[base + k];
        if (j < 0) {
          blocked = true;
          break;
        }
        const v = b[j];
        if (v === 0) {
          empty++;
          emptyAt = j;
        } else if (v !== p) {
          blocked = true;
          break;
        } else {
          own++;
        }
      }

      if (!blocked && own === 4 && empty === 1) seen.add(emptyAt);
    }
  }

  return { win: false, fours: Array.from(seen) };
}

function outOfVcfBudget(ctx: VcfCtx): boolean {
  if (ctx.aborted) return true;
  if (ctx.nodes > ctx.maxNodes) {
    ctx.aborted = true;
    return true;
  }
  // VCF 单节点可能很贵（要扫一批候选），每个节点都看一次时间
  if (Date.now() > ctx.deadline) {
    ctx.aborted = true;
    return true;
  }
  return false;
}

/**
 * 从 attacker 的视角找一条连续冲四的必胜路线。
 * 对手的应手是强制的：有且只有一个成五点时必须堵；没有成五点则无法防守。
 */
function vcfSearch(
  b: Uint8Array,
  n1: Uint8Array,
  n2: Uint8Array,
  attacker: number,
  depth: number,
  ctx: VcfCtx,
): AiChoice[] | null {
  ctx.nodes++;
  if (outOfVcfBudget(ctx)) return null;

  const opp = 3 - attacker;

  // 自己能直接成五，收工
  const myWins = immediateWins(b, n1, attacker, 1);
  if (myWins.length > 0) return [point(myWins[0])];

  if (depth <= 0) return null;

  // 对手已经有成五点：除了先成五（上面已判）就只能堵那一个点
  const defWins = immediateWins(b, n1, opp, 2);
  if (defWins.length >= 2) return null;
  const forcedBlock = defWins.length === 1 ? defWins[0] : -1;

  // 只考虑“能做出四”的落点，VCF 才叫 VCF；能做四的点必定紧挨着己方棋子
  for (let i = 0; i < CELL_COUNT; i++) {
    if (b[i] !== 0 || n1[i] === 0) continue;
    if (forcedBlock >= 0 && i !== forcedBlock) continue;

    place(b, n1, n2, i, attacker);
    const threat = threatAt(b, i, attacker);

    if (threat.win) {
      unplace(b, n1, n2, i);
      return [point(i)];
    }
    if (threat.fours.length === 0) {
      unplace(b, n1, n2, i);
      continue;
    }

    // 对手若有自己的成五点，会先成五；除非我们这手是活四/双四（两处成五）
    const oppWins = immediateWins(b, n1, opp, 1);
    if (oppWins.length > 0) {
      unplace(b, n1, n2, i);
      continue;
    }

    // 活四：两个成五点，对手堵不过来
    if (threat.fours.length >= 2) {
      unplace(b, n1, n2, i);
      return [point(i)];
    }

    // 冲四：对手只有唯一应手
    const block = threat.fours[0];
    place(b, n1, n2, block, opp);
    const rest = vcfSearch(b, n1, n2, attacker, depth - 1, ctx);
    unplace(b, n1, n2, block);
    unplace(b, n1, n2, i);

    if (rest) return [point(i), ...rest];
    if (ctx.aborted) return null;
  }

  return null;
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
  // 节点成本不算低，每个节点都看一次时间，宁可少搜一层也不越过单次调用预算
  if (Date.now() > ctx.deadline) {
    ctx.aborted = true;
    return true;
  }
  return false;
}

/**
 * 静态评估：双方最好的几个落点价值之差。
 * 取前三个而不是只取一个，才能看见“双三 / 四三”这类多点威胁。
 */
function evalTops(myTop: readonly number[], thTop: readonly number[]): number {
  const my = myTop[0] + myTop[1] * 0.34 + myTop[2] * 0.14;
  const th = thTop[0] + thTop[1] * 0.42 + thTop[2] * 0.18;
  return my - th * 1.1;
}

/** 叶子处需要重新分析时使用（如刚补了一手强制防守）。 */
function staticEval(b: Uint8Array, near: Uint8Array, p: number): number {
  const { myTop, thTop } = analyze(b, near, p, 3);
  return evalTops(myTop, thTop);
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
  if (outOfBudget(ctx)) return 0;

  const opp = 3 - p;
  // 距离 2 以内的候选足够覆盖所有成五、堵四和近身防守点
  const { list, myBest, thBest, myTop, thTop } = analyze(
    b,
    n2,
    p,
    depth >= 3 ? 10 : 8,
  );

  if (list.length === 0) return 0;
  // 自己能成五：直接取胜，越早越好
  if (myBest >= WIN_MOVE) return FIVE + depth * 10_000;

  if (thBest >= WIN_MOVE) {
    const blocks = list.filter((m) => m.th >= WIN_MOVE);
    // 对手有两个不同的成五点，堵一个另一个仍会输
    if (blocks.length >= 2) return -(FIVE + depth * 10_000);

    if (depth === 0 || outOfBudget(ctx)) {
      // 叶子处做一次静态延伸：假定堵住后由对手评估，避免把“可堵的四”当成必败
      let best = -Infinity;
      for (const m of blocks) {
        place(b, n1, n2, m.i, p);
        const v = -staticEval(b, n2, opp);
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

  // 自己能做活四：两个成五点，对手堵不住，等价于已经赢了
  if (myBest >= 100_000) {
    const mine = openFourPoints(b, n1, n2, list, p);
    if (mine.length > 0) return FIVE + depth * 10_000;
  }

  // 对手下一步能做活四：必须占住能形成活四的点。活三有两个端点，
  // 堵任意一端后另一端只能做冲四，所以这里不能因为候选多于一个就判负；
  // 真正的双三威胁会在下一层被识别出来。
  let moves = list;
  if (thBest >= 100_000) {
    const danger = openFourPoints(b, n1, n2, list, opp);
    if (danger.length > 0) {
      const must = new Set<number>();
      for (const m of danger) must.add(m.i);
      const block = list.filter((m) => must.has(m.i));
      if (block.length > 0) {
        if (depth === 0 || outOfBudget(ctx)) {
          let best = -Infinity;
          for (const m of block) {
            place(b, n1, n2, m.i, p);
            const v = -staticEval(b, n2, opp);
            unplace(b, n1, n2, m.i);
            if (v > best) best = v;
          }
          return best;
        }
        moves = block;
      }
    }
  }

  if (depth === 0 || outOfBudget(ctx)) {
    return evalTops(myTop, thTop);
  }

  let best = -Infinity;
  for (const m of moves) {
    place(b, n1, n2, m.i, p);
    const v = -negamax(b, n1, n2, opp, depth - 1, -beta, -alpha, ctx);
    unplace(b, n1, n2, m.i);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
    if (outOfBudget(ctx)) break;
  }
  return best === -Infinity ? staticEval(b, n2, p) : best;
}

/* ------------------------------------------------------------------ */
/* 对外入口                                                            */
/* ------------------------------------------------------------------ */

export interface AiChoice {
  x: number;
  y: number;
}

function point(i: number): AiChoice {
  const x = i % N;
  return { x, y: (i - x) / N };
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

interface LevelConfig {
  /** 最大搜索层数；简单档为 0（随机） */
  depth: number;
  maxNodes: number;
  deadlineMs: number;
  /** VCF 搜索深度，0 表示不启用 */
  vcfDepth: number;
  /** 根节点最多保留的候选数 */
  rootWidth: number;
  /** 地狱档：用对手 VCF 过滤多少个根候选 */
  vcfDefense: number;
}

const LEVELS: Record<Difficulty, LevelConfig> = {
  easy: {
    depth: 0,
    maxNodes: 0,
    deadlineMs: 0,
    vcfDepth: 0,
    rootWidth: 8,
    vcfDefense: 0,
  },
  normal: {
    depth: 2,
    maxNodes: 8_000,
    deadlineMs: 160,
    vcfDepth: 0,
    rootWidth: 8,
    vcfDefense: 0,
  },
  hard: {
    depth: 6,
    maxNodes: 20_000,
    deadlineMs: 480,
    vcfDepth: 12,
    rootWidth: 10,
    vcfDefense: 0,
  },
  hell: {
    depth: 6,
    maxNodes: 30_000,
    deadlineMs: 1_500,
    vcfDepth: 16,
    rootWidth: 10,
    vcfDefense: 10,
  },
};

function pickEasy(list: Candidate[], random: () => number): AiChoice {
  const top = list.slice(0, 3);
  const r = random();
  const pick = r < 0.55 ? 0 : r < 0.85 ? 1 : 2;
  const m = top[Math.min(pick, top.length - 1)];
  return { x: m.x, y: m.y };
}

/**
 * 从候选点里挑出“落子后能做出活四/双四”的点。活四有两个成五点，
 * 对手堵不住，等价于下一手必胜。只复查分数已经接近四的候选，成本很低。
 */
function openFourPoints(
  b: Uint8Array,
  n1: Uint8Array,
  n2: Uint8Array,
  list: readonly Candidate[],
  p: number,
): Candidate[] {
  const out: Candidate[] = [];
  for (const m of list) {
    if ((p === 1 ? m.my : m.th) < 100_000) continue;
    place(b, n1, n2, m.i, p);
    const threat = threatAt(b, m.i, p);
    unplace(b, n1, n2, m.i);
    if (threat.fours.length >= 2) out.push(m);
  }
  return out;
}

/**
 * 计算最佳落子。棋盘为满盘或无可下点时返回 null。
 * 时间复杂度受节点与时间预算约束（地狱档最坏约 1.5s）。
 */
export function findBestMove(
  board: readonly number[],
  player: Player,
  level: Difficulty,
  options?: MoveOptions,
): AiChoice | null {
  const b = Uint8Array.from(board);
  const { n1, n2 } = buildNear(b);
  const config = LEVELS[level] ?? LEVELS.normal;

  let stones = 0;
  for (let i = 0; i < CELL_COUNT; i++) if (b[i] !== 0) stones++;
  if (stones === 0) return { x: 7, y: 7 };
  if (stones === CELL_COUNT) return null;

  const root = analyze(b, n2, player, config.rootWidth);
  if (root.list.length === 0) {
    for (let i = 0; i < CELL_COUNT; i++) {
      if (b[i] === 0) return point(i);
    }
    return null;
  }

  // 1) 能赢就赢
  for (const m of root.list) {
    if (m.my >= WIN_MOVE) return { x: m.x, y: m.y };
  }
  // 2) 对手能赢必须堵
  const blocks = root.list.filter((m) => m.th >= WIN_MOVE);
  let pool = blocks.length > 0 ? blocks : root.list;

  // 2.5) 自己能做出活四就直接赢；对手下一步能做出活四则必须堵住那个点。
  if (blocks.length === 0) {
    const mine = openFourPoints(b, n1, n2, root.list, player);
    if (mine.length > 0) return { x: mine[0].x, y: mine[0].y };
  }

  if (level !== "normal" && blocks.length === 0) {
    const danger = openFourPoints(b, n1, n2, root.list, 3 - player);
    if (danger.length > 0) {
      const must = new Set<number>();
      for (const m of danger) must.add(m.i);
      const filtered = pool.filter((m) => must.has(m.i));
      if (filtered.length > 0) pool = filtered;
    }
  }

  if (level === "easy") {
    return pickEasy(pool, options?.random ?? Math.random);
  }

  const deadlineMs = options?.deadlineMs ?? config.deadlineMs;
  const maxNodes = options?.maxNodes ?? config.maxNodes;
  const deadline = Date.now() + deadlineMs;

  // 3) VCF：先看看自己能不能连续冲四取胜
  if (config.vcfDepth > 0) {
    const vcfCtx: VcfCtx = {
      nodes: 0,
      // VCF 是战术搜索，给它的预算不宜挤占主搜索
      maxNodes: Math.min(1_800, Math.max(200, Math.floor(maxNodes * 0.1))),
      deadline: Math.min(
        deadline,
        Date.now() + Math.min(360, Math.max(60, deadlineMs * 0.25)),
      ),
      aborted: false,
    };
    const win = vcfSearch(b, n1, n2, player, config.vcfDepth, vcfCtx);
    if (win && win.length > 0) return win[0];
  }

  // 4) 地狱档：如果对手有 VCF，先筛掉挡不住连续冲四的候选
  if (config.vcfDefense > 0 && blocks.length === 0) {
    const probeCtx: VcfCtx = {
      nodes: 0,
      maxNodes: Math.min(1_200, Math.max(160, Math.floor(maxNodes * 0.06))),
      deadline: Math.min(
        deadline,
        Date.now() + Math.min(260, Math.max(50, deadlineMs * 0.2)),
      ),
      aborted: false,
    };
    const oppVcf = vcfSearch(b, n1, n2, 3 - player, config.vcfDepth, probeCtx);

    if (oppVcf) {
      // 只有挡住对手 VCF 路线上的关键点才算防守；单纯做自己的冲四
      // 只是拖一手，对手挡完仍会继续 VCF，不能算“安全”。
      const key = new Set<number>();
      for (const c of oppVcf) key.add(c.y * N + c.x);

      const safe: Candidate[] = [];
      const check = pool.slice(0, config.vcfDefense);
      for (const m of check) {
        if (Date.now() > deadline) break;
        const inKey = key.has(m.i);
        if (!inKey) continue;
        place(b, n1, n2, m.i, player);
        const ctx: VcfCtx = {
          nodes: 0,
          maxNodes: 260,
          deadline: Math.min(deadline, Date.now() + 80),
          aborted: false,
        };
        const still = vcfSearch(b, n1, n2, 3 - player, config.vcfDepth, ctx);
        unplace(b, n1, n2, m.i);
        if (!still) safe.push(m);
      }
      if (safe.length > 0) pool = safe;
    }
  }

  // 5) 迭代加深：每层都保留一个完整答案，超时就用上一层
  const searched = pool.length > config.rootWidth ? pool.slice(0, config.rootWidth) : pool;
  if (Date.now() >= deadline) {
    return { x: searched[0].x, y: searched[0].y };
  }

  const ctx: Ctx = { nodes: 0, maxNodes, deadline, aborted: false };

  let bestMove = searched[0];
  let bestScore = -Infinity;

  for (let depth = 2; depth <= config.depth; depth += 2) {
    let layerBest = searched[0];
    let layerScore = -Infinity;
    let alpha = -Infinity;

    for (const m of searched) {
      place(b, n1, n2, m.i, player);
      const v = -negamax(b, n1, n2, 3 - player, depth - 1, -Infinity, -alpha, ctx);
      unplace(b, n1, n2, m.i);
      if (v > layerScore) {
        layerScore = v;
        layerBest = m;
      }
      if (v > alpha) alpha = v;
      if (ctx.aborted) break;
    }

    if (ctx.aborted) break;

    bestMove = layerBest;
    bestScore = layerScore;

    // 已经算到必胜/必败，继续加深意义不大
    if (bestScore >= FIVE || bestScore <= -FIVE) break;
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
