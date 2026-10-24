import { expect, test } from "nsh/test";
import {
  createRoyal,
  fromFen,
  playRoyal,
  parseUci,
  royalLegalMoves,
  inCheck,
  deadMaterial,
  drawClaim,
  timeoutRoyal,
  parseSquare,
} from "./royal";
const move = (s: ReturnType<typeof createRoyal>, uci: string) =>
  playRoyal(s, parseUci(s, uci)!)!;
test("国际象棋标准开局走法树及将死", () => {
  let s = createRoyal("chess");
  expect(royalLegalMoves(s).length).toBe(20);
  let count = 0;
  for (const m of royalLegalMoves(s))
    count += royalLegalMoves(playRoyal(s, m)!).length;
  expect(count).toBe(400);
  for (const uci of ["f2f3", "e7e5", "g2g4", "d8h4"]) s = move(s, uci);
  expect(s.result?.winner).toBe(2);
  expect(s.result?.reason).toBe("将死");
  expect(royalLegalMoves(s).length).toBe(0);
});
test("易位不能穿过受攻击格，易位后车与王位置正确", () => {
  let s = fromFen("chess", "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")!;
  s = move(s, "e1g1");
  expect(s.board[62]).toBe(6);
  expect(s.board[61]).toBe(4);
  expect(s.board[63]).toBe(0);
  expect(s.castle).toBe("kq");
  const attacked = fromFen("chess", "k4r2/8/8/8/8/8/8/4K2R w K - 0 1")!;
  expect(playRoyal(attacked, { from: 60, to: 62 })).toBe(null);
});
test("吃过路兵只在紧接着一手有效，不能暴露己方王", () => {
  let s = createRoyal("chess");
  for (const uci of ["e2e4", "a7a6", "e4e5", "d7d5"]) s = move(s, uci);
  const ep = move(s, "e5d6");
  expect(ep.board[27]).toBe(0);
  expect(ep.board[19]).toBe(1);
  s = move(s, "a2a3");
  expect(s.ep).toBe(-1);
  const pinned = fromFen("chess", "k3r3/8/8/3pP3/8/8/8/4K3 w - d6 0 1")!;
  expect(playRoyal(pinned, parseUci(pinned, "e5d6")!)).toBe(null);
});
test("兵有四种升变，必须选择；逼和与死局", () => {
  const s = fromFen("chess", "k7/7P/8/8/8/8/8/K7 w - - 0 1")!;
  expect(royalLegalMoves(s).filter((m) => m.from === 15).length).toBe(4);
  expect(playRoyal(s, { from: 15, to: 7 })).toBe(null);
  expect(move(s, "h7h8n").board[7]).toBe(2);
  const stale = fromFen("chess", "k7/8/1QK5/8/8/8/8/8 w - - 0 1")!;
  expect(move(stale, "b6c7").result?.reason).toBe("逼和");
  const bare = fromFen("chess", "k7/8/8/8/8/8/8/7K w - - 0 1")!;
  expect(deadMaterial(bare)).toBe(true);
  expect(timeoutRoyal(bare, 1).winner).toBe(0);
});
test("三次重复可申请，五次重复自动和棋，非法FEN拒绝", () => {
  let s = createRoyal("chess");
  for (let n = 0; n < 2; n++)
    for (const uci of ["g1f3", "g8f6", "f3g1", "f6g8"]) s = move(s, uci);
  expect(drawClaim(s)).toBe("三次重复局面");
  expect(s.result).toBe(null);
  for (let n = 0; n < 2; n++)
    for (const uci of ["g1f3", "g8f6", "f3g1", "f6g8"]) s = move(s, uci);
  expect(s.result?.reason).toBe("五次重复局面");
  expect(fromFen("chess", "8/8/8/8/8/8/8/8 w - - 0 1")).toBe(null);
  expect(playRoyal(createRoyal("chess"), { from: 52.5, to: 36 })).toBe(null);
});
test("中国象棋初始走法、马腿、象眼与将帅照面", () => {
  let s = createRoyal("xiangqi");
  expect(royalLegalMoves(s).length).toBe(44);
  const blocked = { ...s, board: s.board.slice() };
  blocked.board[73] = 1;
  expect(royalLegalMoves(blocked).filter((m) => m.from === 82).length).toBe(0);
  const face = fromFen("xiangqi", "4k4/9/9/9/4P4/9/9/9/9/4K4 w - - 0 1")!;
  expect(playRoyal(face, { from: 40, to: 39 })).toBe(null);
  expect(inCheck(face)).toBe(false);
  const elephant = { ...s, board: s.board.slice() };
  elephant.board[75] = 1;
  expect(
    royalLegalMoves(elephant).some((m) => m.from === 83 && m.to === 67),
  ).toBe(false);
});

test("中国象棋单方长将判负，普通循环交裁判而不擅自判和", () => {
  let s = fromFen("xiangqi", "4k4/3R5/9/9/4p4/9/9/9/9/4K4 w - - 0 1")!;
  s = playRoyal(s, { from: 12, to: 13 })!;
  for (let i = 0; i < 2; i++)
    for (const m of [
      { from: 4, to: 5 },
      { from: 13, to: 14 },
      { from: 5, to: 4 },
      { from: 14, to: 13 },
    ])
      s = playRoyal(s, m)!;
  expect(s.result?.winner).toBe(2);
  expect(s.result?.reason).toBe("单方长将判负");
  s = createRoyal("xiangqi");
  for (let i = 0; i < 2; i++)
    for (const m of [
      { from: 82, to: 65 },
      { from: 1, to: 20 },
      { from: 65, to: 82 },
      { from: 20, to: 1 },
    ])
      s = playRoyal(s, m)!;
  expect(s.result).toBe(null);
  expect(s.adjudication).toBe(true);
  expect(royalLegalMoves(s).length).toBe(0);
});

test("中国象棋限着无吃子计数不会被兵卒移动重置", () => {
  let s = fromFen("xiangqi", "4k4/9/9/9/4p4/9/9/9/9/4K4 b - - 120 1")!;
  s = playRoyal(s, { from: 40, to: 49 })!;
  expect(s.halfmove).toBe(121);
  expect(drawClaim(s)).not.toBe(null);
});

test("拒绝非法吃过路兵、易位权、分数坐标与九宫外将帅", () => {
  expect(parseSquare("e3.5", "chess")).toBe(-1);
  expect(parseSquare("a01", "xiangqi")).toBe(-1);
  expect(fromFen("chess", "k7/8/8/3rP3/8/8/8/4K3 w - d6 0 1")).toBe(null);
  expect(fromFen("chess", "k7/8/8/3pP3/8/8/8/4K3 w - d4 0 1")).toBe(null);
  expect(fromFen("chess", "k7/8/8/8/8/8/8/4K3 w K - 0 1")).toBe(null);
  expect(fromFen("xiangqi", "k8/9/9/9/4p4/9/9/9/9/4K4 w - - 0 1")).toBe(null);
});
