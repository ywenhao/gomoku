import whitePawn from "../assets/chess/white-pawn.svg";
import whiteKnight from "../assets/chess/white-knight.svg";
import whiteBishop from "../assets/chess/white-bishop.svg";
import whiteRook from "../assets/chess/white-rook.svg";
import whiteQueen from "../assets/chess/white-queen.svg";
import whiteKing from "../assets/chess/white-king.svg";
import blackPawn from "../assets/chess/black-pawn.svg";
import blackKnight from "../assets/chess/black-knight.svg";
import blackBishop from "../assets/chess/black-bishop.svg";
import blackRook from "../assets/chess/black-rook.svg";
import blackQueen from "../assets/chess/black-queen.svg";
import blackKing from "../assets/chess/black-king.svg";
import {
  Canvas,
  Image,
  Text,
  View,
  type Accessor,
  type CanvasRenderingContext2D,
  type CanvasSize,
} from "nsh";
import { Board } from "./Board";
import { C } from "./ui";
import { type Match } from "../lib/multigame";
import { widthOf, heightOf, owner, squareName } from "../lib/royal";
import {
  CHECKER_HOLES,
  CHECKER_CAMPS,
  LUDO_TRACK,
  ludoPosition,
  ludoLegal,
} from "../lib/race";
import { JUNQI_CAMPS, JUNQI_HQ, JUNQI_NAMES } from "../lib/junqi";
const WHITE_PIECES = [
  whitePawn,
  whiteKnight,
  whiteBishop,
  whiteRook,
  whiteQueen,
  whiteKing,
];
const BLACK_PIECES = [
  blackPawn,
  blackKnight,
  blackBishop,
  blackRook,
  blackQueen,
  blackKing,
];
export const PLAYER_COLORS = ["#c0442c", "#366dba", "#428957", "#b18011"];
const chessGlyphs = ["", "♙", "♘", "♗", "♖", "♕", "♔"],
  blackGlyphs = ["", "♟", "♞", "♝", "♜", "♛", "♚"];
const redXq = ["", "兵", "马", "相", "车", "炮", "帅", "仕"],
  blackXq = ["", "卒", "马", "象", "车", "炮", "将", "士"];
export function MultiBoard(props: {
  match: Accessor<Match>;
  size: Accessor<number>;
  selected: Accessor<number>;
  targets: Accessor<number[]>;
  onCell: (i: number) => void;
  onPlane?: (i: number) => void;
  viewer?: Accessor<number>;
  reveal?: boolean;
  disabled?: boolean;
}) {
  const m = props.match();
  if (m.kind === "connect6")
    return (
      <Board
        n={19}
        size={props.size}
        board={() => {
          const s = props.match().state;
          return "board" in s ? s.board : [];
        }}
        stars={[
          [3, 3],
          [3, 9],
          [3, 15],
          [9, 3],
          [9, 9],
          [9, 15],
          [15, 3],
          [15, 9],
          [15, 15],
        ]}
        last={() => {
          const s = props.match().state;
          if ("moves" in s) {
            const last = s.moves[s.moves.length - 1];
            return last ? last.y * 19 + last.x : -1;
          }
          return -1;
        }}
        winLine={() => {
          const r = props.match().state.result;
          return r && "line" in r ? r.line : [];
        }}
        hover={() => -1}
        canPlay={() => !props.disabled}
        turn={() => Math.min(2, props.match().state.turn) as 1 | 2}
        onPlay={props.onCell}
        setHover={() => {}}
        clearHover={() => {}}
      />
    );
  if (m.kind === "checkers")
    return (
      <View
        style={{
          width: props.size(),
          height: props.size(),
          backgroundColor: "#edce9d",
          borderRadius: 16,
        }}
      >
        <Each of={CHECKER_HOLES}>
          {(hole, i) => {
            const v = () => {
              const state = props.match().state;
              return "board" in state ? state.board[i()] : 0;
            };
            return (
              <View
                role="button"
                testID={`extra-cell-${i()}`}
                accessibilityLabel={`星盘第${i() + 1}孔，${v() ? `玩家${v()}` : "空孔"}`}
                onPress={() => props.onCell(i())}
                disabled={props.disabled}
                style={{
                  position: "absolute",
                  left:
                    (0.5 + (hole().q + hole().r / 2) / 18) * props.size() -
                    props.size() / 40,
                  top: (0.5 + hole().r / 18) * props.size() - props.size() / 40,
                  width: props.size() / 20,
                  height: props.size() / 20,
                  borderRadius: props.size() / 40,
                  backgroundColor: v()
                    ? PLAYER_COLORS[v() - 1]
                    : props.targets().includes(i())
                      ? "#85bd82"
                      : "#d9b789",
                  borderWidth: props.selected() === i() ? 3 : 1,
                  borderColor:
                    props.selected() === i()
                      ? C.accent
                      : CHECKER_CAMPS[0].includes(i())
                        ? PLAYER_COLORS[0]
                        : CHECKER_CAMPS[3].includes(i())
                          ? PLAYER_COLORS[1]
                          : "#a48b6b",
                }}
              />
            );
          }}
        </Each>
      </View>
    );
  if (m.kind === "ludo")
    return (
      <View
        style={{
          width: props.size(),
          height: props.size(),
          backgroundColor: C.panel,
          borderRadius: 16,
        }}
      >
        <Each of={LUDO_TRACK}>
          {(xy, i) => (
            <View
              style={{
                position: "absolute",
                left: (xy()[0] * props.size()) / 15,
                top: (xy()[1] * props.size()) / 15,
                width: props.size() / 15,
                height: props.size() / 15,
                borderWidth: 1,
                borderColor: C.line,
                backgroundColor: PLAYER_COLORS[(i() + 2) % 4] + "40",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: props.size() / 40, color: C.muted }}>
                {i() + 1}
              </Text>
            </View>
          )}
        </Each>
        <Each of={[1, 2, 3, 4]}>
          {(p) => (
            <>
              <Each of={[0, 1, 2, 3, 4, 5]}>
                {(k) => {
                  const xy = () =>
                    p() === 1
                      ? [7, 13 - k()]
                      : p() === 2
                        ? [1 + k(), 7]
                        : p() === 3
                          ? [7, 1 + k()]
                          : [13 - k(), 7];
                  return (
                    <View
                      style={{
                        position: "absolute",
                        left: (xy()[0] * props.size()) / 15,
                        top: (xy()[1] * props.size()) / 15,
                        width: props.size() / 15,
                        height: props.size() / 15,
                        backgroundColor: PLAYER_COLORS[p() - 1] + "80",
                        borderWidth: 1,
                        borderColor: C.line,
                      }}
                    />
                  );
                }}
              </Each>
              <Each of={[0, 1, 2, 3]}>
                {(plane) => {
                  const step = () => {
                    const s = props.match().state;
                    return "planes" in s ? s.planes[p() - 1][plane()] : -1;
                  };
                  const xy = () => {
                    const s = step();
                    if (s < 0)
                      return p() === 1
                        ? [
                            2 + (plane() % 2) * 2,
                            11 + Math.floor(plane() / 2) * 2,
                          ]
                        : p() === 2
                          ? [
                              2 + (plane() % 2) * 2,
                              2 + Math.floor(plane() / 2) * 2,
                            ]
                          : p() === 3
                            ? [
                                11 + (plane() % 2) * 2,
                                2 + Math.floor(plane() / 2) * 2,
                              ]
                            : [
                                11 + (plane() % 2) * 2,
                                11 + Math.floor(plane() / 2) * 2,
                              ];
                    if (s < 52) return LUDO_TRACK[ludoPosition(p(), s)];
                    const k = s - 52;
                    return p() === 1
                      ? [7, 13 - k]
                      : p() === 2
                        ? [1 + k, 7]
                        : p() === 3
                          ? [7, 1 + k]
                          : [13 - k, 7];
                  };
                  return (
                    <View
                      role="button"
                      testID={`plane-${p()}-${plane()}`}
                      accessibilityLabel={`玩家${p()}飞机${plane() + 1}，${step() < 0 ? "机场" : step() === 57 ? "已完成" : "航程" + step()}`}
                      onPress={() => {
                        if (p() === props.match().state.turn)
                          props.onPlane?.(plane());
                      }}
                      disabled={
                        props.disabled || p() !== props.match().state.turn
                      }
                      style={{
                        position: "absolute",
                        left:
                          ((xy()[0] +
                            (step() >= 0 ? (plane() % 2) * 0.28 : 0)) *
                            props.size()) /
                          15,
                        top:
                          ((xy()[1] +
                            (step() >= 0
                              ? Math.floor(plane() / 2) * 0.28
                              : 0)) *
                            props.size()) /
                          15,
                        width: props.size() / 22,
                        height: props.size() / 22,
                        borderRadius: props.size() / 44,
                        backgroundColor: PLAYER_COLORS[p() - 1],
                        borderWidth: 1,
                        borderColor: "#fff",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: props.size() / 38,
                          fontWeight: "700",
                        }}
                      >
                        {plane() + 1}
                      </Text>
                    </View>
                  );
                }}
              </Each>
            </>
          )}
        </Each>
      </View>
    );
  const w = m.kind === "junqi" ? 5 : widthOf(m.kind),
    h = m.kind === "junqi" ? 12 : heightOf(m.kind);
  const cell = () => props.size() / w,
    boardHeight = () => cell() * h;
  const draw = (cx: CanvasRenderingContext2D, s: CanvasSize) => {
    const c = s.width / w;
    cx.fillStyle = "#efd2a5";
    cx.fillRect(0, 0, s.width, s.height);
    cx.strokeStyle = "#8f7654";
    cx.lineWidth = 1;
    if (m.kind === "xiangqi") {
      cx.beginPath();
      for (let y = 0; y < 10; y++) {
        cx.moveTo(c / 2, c * (y + 0.5));
        cx.lineTo(c * 8.5, c * (y + 0.5));
      }
      for (let x = 0; x < 9; x++) {
        cx.moveTo(c * (x + 0.5), c / 2);
        cx.lineTo(c * (x + 0.5), c * 4.5);
        cx.moveTo(c * (x + 0.5), c * 5.5);
        cx.lineTo(c * (x + 0.5), c * 9.5);
      }
      for (const y of [0, 7]) {
        cx.moveTo(c * 3.5, c * (y + 0.5));
        cx.lineTo(c * 5.5, c * (y + 2.5));
        cx.moveTo(c * 5.5, c * (y + 0.5));
        cx.lineTo(c * 3.5, c * (y + 2.5));
      }
      cx.stroke();
      cx.fillStyle = "#8f7654";
      cx.font = `${c * 0.4}px sans-serif`;
      cx.fillText("楚河       汉界", c * 2, c * 5.2);
    } else if (m.kind === "junqi") {
      cx.beginPath();
      for (let y = 0; y < 12; y++)
        for (let x = 0; x < 5; x++) {
          const i = y * 5 + x;
          if (x < 4) {
            cx.moveTo(c * (x + 0.5), c * (y + 0.5));
            cx.lineTo(c * (x + 1.5), c * (y + 0.5));
          }
          if (y < 11 && (y !== 5 || [0, 2, 4].includes(x))) {
            cx.moveTo(c * (x + 0.5), c * (y + 0.5));
            cx.lineTo(c * (x + 0.5), c * (y + 1.5));
          }
          if (JUNQI_CAMPS.includes(i))
            for (const [dx, dy] of [
              [1, 1],
              [-1, 1],
              [1, -1],
              [-1, -1],
            ]) {
              cx.moveTo(c * (x + 0.5), c * (y + 0.5));
              cx.lineTo(c * (x + dx + 0.5), c * (y + dy + 0.5));
            }
        }
      cx.stroke();
      cx.strokeStyle = "#403d38";
      cx.lineWidth = 3;
      cx.beginPath();
      for (const y of [1, 5, 6, 10]) {
        cx.moveTo(c / 2, c * (y + 0.5));
        cx.lineTo(c * 4.5, c * (y + 0.5));
      }
      for (const x of [0, 4]) {
        cx.moveTo(c * (x + 0.5), c * 1.5);
        cx.lineTo(c * (x + 0.5), c * 10.5);
      }
      cx.moveTo(c * 2.5, c * 5.5);
      cx.lineTo(c * 2.5, c * 6.5);
      cx.stroke();
    }
  };
  return (
    <View
      style={{
        width: props.size(),
        height: boardHeight(),
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "#efd2a5",
      }}
    >
      <If when={m.kind !== "chess"}>
        <Canvas
          style={{
            position: "absolute",
            width: props.size(),
            height: boardHeight(),
          }}
          draw={draw}
        />
      </If>
      <Each of={Array.from({ length: w * h }, (_, i) => i)}>
        {(i) => {
          const v = () => {
            const s = props.match().state;
            return "board" in s ? s.board[i()] : 0;
          };
          const hidden = () =>
            m.kind === "junqi" &&
            !props.reveal &&
            owner(v()) !== (props.viewer?.() ?? 1) &&
            !(
              "revealed" in props.match().state &&
              (props.match().state as { revealed: number[] }).revealed.includes(
                i(),
              )
            );
          const label = () =>
            !v()
              ? m.kind === "junqi"
                ? JUNQI_CAMPS.includes(i())
                  ? "营"
                  : JUNQI_HQ.includes(i())
                    ? "本"
                    : ""
                : ""
              : hidden()
                ? "暗"
                : m.kind === "chess"
                  ? (v() > 0 ? chessGlyphs : blackGlyphs)[Math.abs(v())]
                  : m.kind === "junqi"
                    ? JUNQI_NAMES[Math.abs(v())]
                    : (v() > 0 ? redXq : blackXq)[Math.abs(v())];
          return (
            <View
              role="button"
              testID={`extra-cell-${i()}`}
              accessibilityLabel={`${m.kind === "junqi" ? "第" + (i() + 1) + "站" : squareName(i(), m.kind)},${label() || "空"}${props.targets().includes(i()) ? "，可走" : ""}`}
              disabled={props.disabled}
              onPress={() => props.onCell(i())}
              style={{
                position: "absolute",
                left: (i() % w) * cell(),
                top: Math.floor(i() / w) * cell(),
                width: cell(),
                height: cell(),
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  props.selected() === i()
                    ? "#e3ba54"
                    : props.targets().includes(i())
                      ? "#a6ca84aa"
                      : m.kind === "chess"
                        ? ((i() % w) + Math.floor(i() / w)) % 2
                          ? "#a78b67"
                          : "#f1e4cd"
                        : "transparent",
              }}
            >
              <View
                style={{
                  width: cell() * 0.78,
                  height: cell() * 0.78,
                  borderRadius: m.kind === "junqi" ? 6 : cell() * 0.39,
                  backgroundColor:
                    v() && m.kind !== "chess" ? "#fceccf" : "transparent",
                  borderWidth: v() && m.kind !== "chess" ? 1.5 : 0,
                  borderColor: owner(v()) === 1 ? C.accent : C.ink,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <If
                  when={m.kind === "chess" && v() !== 0}
                  else={
                    <Text
                      style={{
                        fontSize: cell() * (m.kind === "chess" ? 0.78 : 0.47),
                        fontWeight: "700",
                        color:
                          m.kind === "chess"
                            ? v() > 0
                              ? "#fff"
                              : "#24201c"
                            : owner(v()) === 1
                              ? C.accent
                              : C.ink,
                      }}
                    >
                      {label()}
                    </Text>
                  }
                >
                  <Image
                    src={
                      (v() > 0 ? WHITE_PIECES : BLACK_PIECES)[Math.abs(v()) - 1]
                    }
                    style={{ width: cell() * 0.85, height: cell() * 0.85 }}
                  />
                </If>
              </View>
            </View>
          );
        }}
      </Each>
    </View>
  );
}
