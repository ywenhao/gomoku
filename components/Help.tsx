import { GAMES, gameName } from "../lib/catalog";
import { GUIDES } from "../lib/guides";
import { TIME_CONTROLS, describeTimeControl } from "../lib/clock";
import { Scroll, Text, View, computed, signal, type JSX } from "nsh";
import { windowSize } from "nsh/device";
import { Board, type BoardMark } from "./Board";
import { C, PressButton } from "./ui";
import { goStars, type GoSize } from "../lib/go";
import type { GameKind } from "../lib/gomoku";

function Section(props: { title: string; children?: JSX.Element }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text
        style={{
          fontSize: 14,
          fontWeight: "700",
          color: C.ink,
          letterSpacing: 1,
          marginBottom: 7,
        }}
      >
        {props.title}
      </Text>
      <View style={{ gap: 7 }}>{props.children}</View>
    </View>
  );
}

function Para(props: { children?: JSX.Element }) {
  return (
    <Text style={{ fontSize: 12.5, lineHeight: 20, color: C.muted }}>
      {props.children}
    </Text>
  );
}

function Term(props: { name: string; children?: JSX.Element }) {
  return (
    <View style={{ flexDirection: "row", gap: 9, alignItems: "flex-start" }}>
      <View
        style={{
          minWidth: 58,
          paddingVertical: 2,
          paddingHorizontal: 7,
          borderRadius: 7,
          backgroundColor: "rgba(58,40,22,0.055)",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 11.5, fontWeight: "700", color: C.ink }}>
          {props.name}
        </Text>
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 12.5,
          lineHeight: 20,
          color: C.muted,
        }}
      >
        {props.children}
      </Text>
    </View>
  );
}

function Bullet(props: { children?: JSX.Element }) {
  return (
    <View style={{ flexDirection: "row", gap: 7, alignItems: "flex-start" }}>
      <Text style={{ fontSize: 12.5, lineHeight: 20, color: C.accent }}>•</Text>
      <Text
        style={{
          flex: 1,
          fontSize: 12.5,
          lineHeight: 20,
          color: C.muted,
        }}
      >
        {props.children}
      </Text>
    </View>
  );
}

function MiniBoard(props: {
  stones: [number, number, 1 | 2][];
  marks?: [number, number, string?][];
  caption: string;
  n?: number;
  px?: number;
}) {
  const n = props.n ?? 9;
  const px = props.px ?? 228;
  const board = computed(() => {
    const b = new Array<number>(n * n).fill(0);
    for (const [x, y, p] of props.stones) b[y * n + x] = p;
    return b;
  });
  const marks = computed<BoardMark[]>(() =>
    (props.marks ?? []).map(([x, y, label]) => ({
      i: y * n + x,
      label,
      tone: "accent" as const,
    })),
  );

  return (
    <View style={{ alignItems: "center", gap: 6, marginVertical: 4 }}>
      <View
        style={{
          width: px,
          height: px,
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 6px 16px rgba(74,48,20,0.16)",
        }}
      >
        <Board
          size={() => px}
          n={n}
          stars={goStars(n as GoSize)}
          board={board}
          last={() => -1}
          winLine={() => []}
          marks={marks}
          dead={() => []}
          hover={() => -1}
          canPlay={() => false}
          turn={() => 1}
          onPlay={() => {}}
          setHover={() => {}}
          clearHover={() => {}}
        />
      </View>
      <Text
        style={{
          fontSize: 10.5,
          color: C.muted,
          textAlign: "center",
          lineHeight: 15,
        }}
      >
        {props.caption}
      </Text>
    </View>
  );
}

function GomokuHelp() {
  return (
    <View>
      <Section title="一、怎么下">
        <Para>
          黑棋先行，双方轮流在交叉点落子。横、竖、两条斜线任意方向先连成
          <Text style={{ color: C.ink, fontWeight: "700" }}>
            {" "}
            五子或五子以上{" "}
          </Text>
          的一方获胜；棋盘下满仍未分出胜负则为和棋。
        </Para>
        <Para>
          本作不设禁手：黑棋长连、双三、双四都算赢。点击或触摸棋盘上的空交叉点即可落子，
          已经落子的位置不能重复下。
        </Para>
      </Section>

      <Section title="二、看懂棋型">
        <Term name="活四">
          四个连子两端都空，例如 ·●●●●·。它有两个成五点，对手一次只能堵一边，
          下一手必成五，所以出现活四基本等于胜局已定。
        </Term>
        <Term name="冲四">
          四个连子只有一端能成五，例如 ○●●●●· 或 ·●●●○●。只有一个成五点，
          对手必须立刻堵住，否则下一手成五。
        </Term>
        <Term name="活三">
          再下一手能变成活四的三连，例如 ·●●●·、·●○●●·。活三不马上成五，
          但对手如果不理，就会被活四带走，所以通常要提前封堵。
        </Term>
        <Term name="眠三">
          一端被封死、或只能变成冲四的三连。威胁比活三小，但在连续冲四（VCF）
          的线路里仍然很关键。
        </Term>
        <Term name="跳型">
          ●●○●、●○●● 这类中间有空的形状。不要只数连在一起的子，跳型同样能
          一步变成冲四或活四，防守时要看整条五格窗口。
        </Term>
        <Term name="双威胁">
          同一手同时做出两个活三、一个活三加一个冲四，或两个冲四。对手只能应一边，
          另一边就会发展成活四或直接成五。制造双威胁是五子棋最主要的取胜方式。
        </Term>
      </Section>

      <Section title="三、开局布局">
        <Bullet>
          第一手优先下在中心附近（15 路棋盘的天元是 8,8）。中心向四个方向的空间
          最大，棋子也最不容易被一边堵死。
        </Bullet>
        <Bullet>
          第二手不要下得太远。白棋应贴近黑棋（一到两格内），一边限制黑棋扩张，
          一边借用黑棋周围的落点发展自己的形状。
        </Bullet>
        <Bullet>
          棋子要互相照应：同一条线、相邻斜线或“马步”位置都比散点更有价值。
          子力集中在中心，别把棋子铺到四个角上各下各的。
        </Bullet>
        <Bullet>
          开局不要只沿一条直线堆子。横、竖、两条斜线都要留出发展空间，
          对手才无法用一手同时封死你的全部方向。
        </Bullet>
        <Bullet>
          黑棋先手要主动：用活三、冲四逼对手应手，把先手保持下去。白棋后手则
          以防守反击为主，封堵的同时尽量让自己的子力连成新形状。
        </Bullet>
      </Section>

      <Section title="四、每一步的攻防顺序">
        <Para>
          轮到你时，按下面的顺序检查，能避免“只顾进攻、忘了对手已经四连”的常见崩盘：
        </Para>
        <Bullet>自己能成五：直接落子获胜，不用考虑别的。</Bullet>
        <Bullet>
          对手能成五：必须堵住那个成五点；有两个不同的成五点通常已经救不了。
        </Bullet>
        <Bullet>自己能做活四或双四：落子，下一手必胜。</Bullet>
        <Bullet>
          对手下一步能做活四：占住能形成活四的关键点，不能去别处抢攻。
        </Bullet>
        <Bullet>
          自己有连续的冲四线路（VCF）：一路冲四直到成五；没有后续的单独冲四
          往往只是帮对手落子，不要乱冲。
        </Bullet>
        <Bullet>
          对手有 VCF：先堵住这条线路的起点或关键点。VCT 则是用连续活三、冲四
          逼迫对手，最终做成活四，思路相同，但给对手的应手更多。
        </Bullet>
        <Bullet>
          以上都没有：优先做活三、跳三和双威胁，同时顺手压缩对手的空间。
          每落一子都问自己一句：对手最好的应手是什么？
        </Bullet>
      </Section>

      <Section title="五、常见错误">
        <Bullet>
          只盯着自己的三连，没看到对手的冲四或活三，下一手直接被成五。
        </Bullet>
        <Bullet>把眠三当成活三，或者堵错一端，让对手从另一端做出活四。</Bullet>
        <Bullet>开局把棋子下在边角，子力分散，中盘没有可连接的方向。</Bullet>
        <Bullet>全程只做一条线，被对手一次封死后没有第二计划。</Bullet>
        <Bullet>
          为了“先手”连续冲四，却没有后续成五线路，反而把自己的变化走死。
        </Bullet>
        <Bullet>
          时间快到时还在想复杂进攻；最后几秒应先找成五和对手的成五点。
        </Bullet>
      </Section>

      <Section title="六、操作与计分">
        <Bullet>
          右上角「菜单」可调整模式、难度、限时与声音；打开菜单或帮助时倒计时暂停。
        </Bullet>
        <Bullet>
          对战 AI模式悔棋一次退回你和 AI 各一手，扣 15
          分；超时由系统替你落一手， 扣 10 分。双人模式只记录战绩，不计积分；AI
          观战不计分，可暂停与回放。
        </Bullet>
        <Bullet>
          桌面快捷键：U 悔棋、R 重新开始、M 菜单、Esc 关闭帮助或浮层。
        </Bullet>
        <Bullet>
          胜利基础分：简单 100、普通 180、困难 300、地狱
          500；另有速度、效率和连胜奖励。
        </Bullet>
      </Section>

      <View
        style={{
          marginTop: 18,
          padding: 11,
          borderRadius: 12,
          backgroundColor: "rgba(192,68,44,0.06)",
          borderWidth: 1,
          borderColor: "rgba(192,68,44,0.14)",
        }}
      >
        <Text style={{ fontSize: 11.5, lineHeight: 18, color: C.accent }}>
          一句话口诀：先看对手能不能赢，再看自己能不能赢；能做活四就别做冲四，
          能做双威胁就别只做单线。
        </Text>
      </View>
    </View>
  );
}

function GoHelp() {
  return (
    <View>
      <Section title="一、围棋是什么">
        <Para>
          围棋是两人轮流在交叉点落子的棋类。黑棋先行，白棋随后。棋子落下后不再移动，
          除非被对方提掉。目标不是吃子，而是用棋子围出比对方更多的空地（目 /
          子）。
        </Para>
        <MiniBoard
          n={9}
          stones={[]}
          marks={[
            [2, 2, "星"],
            [6, 2, "星"],
            [2, 6, "星"],
            [6, 6, "星"],
            [4, 4, "天元"],
          ]}
          caption="9 路棋盘：四个星位与中央天元。正式棋盘为 19 路，新手建议从 9 路开始。"
        />
        <Bullet>9 路共 81 个交叉点，13 路 169 个，19 路 361 个。</Bullet>
        <Bullet>棋子下在线与线的交叉点上，不是下在方格里。</Bullet>
        <Bullet>黑先白后，双方轮流各下一手；也可以选择「虚手」停一手。</Bullet>
      </Section>

      <Section title="二、气：棋子的呼吸">
        <Para>
          一颗棋子上下左右相邻的空交叉点，叫做它的气。角上的棋子最多两口气，边上三口气，
          中腹四口气。同色棋子紧挨着就连成一块，气要按整块棋一起算。
        </Para>
        <MiniBoard
          stones={[
            [4, 4, 1],
            [4, 3, 1],
          ]}
          marks={[
            [4, 2, "气"],
            [4, 5, "气"],
            [3, 4, "气"],
            [5, 4, "气"],
          ]}
          caption="两颗黑棋连成一块，共享气；斜着相邻不算连接。"
        />
        <Term name="打吃">
          把对方一块棋打到只剩一口气。被叫吃的一方可以逃跑、反提或弃子。
        </Term>
        <Term name="提子">
          当一块棋的气被全部占满，就从棋盘上拿掉。提子后空出来的交叉点可以重新落子。
        </Term>
      </Section>

      <Section title="三、提子与禁入点">
        <Para>
          下在对方棋块最后一口气上，就能把对方整块棋提掉。反过来，如果落子后自己这块棋
          没有气，又提不掉对方任何棋子，这个点就是禁入点，不能下。
        </Para>
        <MiniBoard
          stones={[
            [4, 4, 2],
            [4, 3, 1],
            [3, 4, 1],
            [5, 4, 1],
          ]}
          marks={[[4, 5, "提"]]}
          caption="白棋只剩最后一口气，黑下在标点即可提掉白棋。"
        />
        <Para>
          注意：如果落子能先提掉对方棋子，即使自己看起来没有气，也是合法的。
          「提子后没气」和「自杀」不是一回事。
        </Para>
      </Section>

      <Section title="四、连接与分断">
        <Para>
          把两块棋连起来，气会合并，整体更难被吃。对方棋块之间如果有断点，下在断点上
          就能把它们分开。分开后的两块棋各自气少，更容易被攻击。
        </Para>
        <MiniBoard
          stones={[
            [3, 3, 2],
            [4, 3, 2],
            [4, 4, 2],
            [5, 4, 1],
            [4, 5, 1],
          ]}
          marks={[[3, 4, "断"]]}
          caption="白棋两块之间有空隙，黑下在标点可以切断。"
        />
        <Bullet>连接不总是越大越好；有时轻巧转身、弃掉一块反而更好。</Bullet>
        <Bullet>断之前先确认自己不会被反断或反吃。</Bullet>
      </Section>

      <Section title="五、打劫与虚手">
        <Para>
          如果黑提白一子、白立刻回提黑一子，局面会无限重复。规则规定：被提的一方不能
          立即回提，必须先到别处下一手，这叫「打劫」。等对方应手后，再回来提劫。
        </Para>
        <MiniBoard
          stones={[
            [4, 4, 2],
            [3, 4, 1],
            [5, 4, 1],
            [4, 3, 1],
            [4, 5, 1],
            [3, 3, 2],
            [5, 3, 2],
          ]}
          marks={[
            [4, 4, "劫"],
            [3, 5, "材"],
          ]}
          caption="劫争时先在别处找劫材，逼对方应手，再回来提劫。"
        />
        <Para>
          没有好点时可以「虚手」停一手。本作采用中国规则：连续两次虚手后进入数子，
          数子前可以标记死子。
        </Para>
      </Section>

      <Section title="六、胜负：中国规则数子">
        <Para>
          终局时，黑棋的总数 = 黑棋棋子数 +
          黑棋围住的空点；白棋同样计算，并额外加上 7.5
          点（3¾子）贴目。总数多的一方获胜。被标记为死子的棋不算，它占的点归对方。
        </Para>
        <MiniBoard
          stones={[
            [2, 0, 1],
            [2, 1, 1],
            [2, 2, 1],
            [0, 2, 1],
            [1, 2, 1],
          ]}
          marks={[
            [0, 0, "空"],
            [1, 0, "空"],
            [0, 1, "空"],
            [1, 1, "空"],
          ]}
          caption="黑棋围住的空点都算黑棋；角上围空最省子。"
        />
        <Bullet>先看整块棋有没有两只真眼；没有眼又逃不掉的通常是死棋。</Bullet>
        <Bullet>贴目 7.5 点（3¾子）意味着黑棋需要明显领先才能赢。</Bullet>
        <Bullet>拿不准时继续下到局面清楚，或使用「标记死子」功能。</Bullet>
      </Section>

      <Section title="七、常用术语">
        <Term name="星位">
          棋盘上的小黑点，9 路在四角和中央；中央星位叫天元。
        </Term>
        <Term name="布局">开局阶段抢占角、边与大场的下法。</Term>
        <Term name="定式">角部经过长期实践形成的、双方大致可接受的变化。</Term>
        <Term name="手筋">局部最巧妙、效率最高的一手，常能以少胜多。</Term>
        <Term name="做活">让一块棋拥有两只真眼，永远不被提掉。</Term>
        <Term name="对杀">两块都不能做活的棋互相紧气，比谁先被提。</Term>
        <Term name="官子">中盘战斗结束后，收束边界、确定目数的阶段。</Term>
        <Term name="复盘">对局后回看关键局面，找出判断和计算上的问题。</Term>
      </Section>

      <Section title="八、新手怎么开始">
        <Bullet>
          先用 9 路棋盘，从「学棋」的启蒙路线开始，一课一课做测验。
        </Bullet>
        <Bullet>每盘棋只定一个目标：例如「这盘我要学会看气」。</Bullet>
        <Bullet>
          做残局时先自己算，再看提示；错手不会污染棋盘，可以反复尝试。
        </Bullet>
        <Bullet>输棋后先找一手最想重下的棋，比只看胜负更有用。</Bullet>
      </Section>

      <View
        style={{
          marginTop: 18,
          padding: 11,
          borderRadius: 12,
          backgroundColor: "rgba(192,68,44,0.06)",
          borderWidth: 1,
          borderColor: "rgba(192,68,44,0.14)",
        }}
      >
        <Text style={{ fontSize: 11.5, lineHeight: 18, color: C.accent }}>
          一句话口诀：先数气，再看断；能做两只真眼就别逃；围空从角开始，
          领先时简化，落后时制造战斗。
        </Text>
      </View>
    </View>
  );
}

/**
 * 帮助浮层：五子棋与围棋两块内容，图文配合。
 * 打开期间由 App 暂停倒计时与 AI，关闭后回到原来的界面。
 */
export function HelpPanel(props: { kind?: GameKind; onClose: () => void }) {
  const maxHeight = Math.max(300, Math.min(660, windowSize().height - 48));
  const active = signal<GameKind>(props.kind ?? "gomoku");
  const go = computed(() => active() === "go");

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        padding: 14,
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
        onPress={props.onClose}
      />

      <Scroll
        testID="help-panel"
        style={{
          width: "100%",
          maxWidth: 450,
          maxHeight,
          backgroundColor: C.panel,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: C.line,
          boxShadow: "0 24px 60px rgba(40,26,12,0.34)",
        }}
        contentStyle={{
          paddingHorizontal: 18,
          paddingTop: 16,
          paddingBottom: 20,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View>
            <Text style={{ fontSize: 20, fontWeight: "700", color: C.ink }}>
              帮助与规则
            </Text>
            <Text
              style={{
                fontSize: 9.5,
                fontWeight: "600",
                color: C.muted,
                letterSpacing: 2,
                marginTop: 2,
              }}
            >
              {gameName(active()) + " · 规则与教学"}
            </Text>
          </View>
          <PressButton
            label="关闭"
            testID="help-close"
            onPress={props.onClose}
          />
        </View>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 12,
          }}
        >
          <Each of={GAMES}>
            {(g) => (
              <PressButton
                label={g().name}
                testID={`help-tab-${g().kind}`}
                tone={active() === g().kind ? "primary" : "default"}
                onPress={() => active.set(g().kind)}
              />
            )}
          </Each>
        </View>
        <Text
          style={{ color: C.ink, fontSize: 14, lineHeight: 22, marginTop: 14 }}
        >
          {GUIDES[active()].intro}
        </Text>
        <Each of={GUIDES[active()].rules}>
          {(r) => (
            <Section title={r().title}>
              <Para>{r().text}</Para>
            </Section>
          )}
        </Each>
        <Section title="快棋、加秒和读秒是什么？">
          <Para>
            快棋、超快棋表示比赛用时长短，不是 AI
            难度。想从容思考可选更长的主时间；熟悉规则后再尝试较短时限。每方的时间分别计算，选好时限后再开始新对局。
          </Para>
          <Each of={TIME_CONTROLS[active()]}>
            {(t) => (
              <View style={{ gap: 5, marginTop: 8 }}>
                <Text style={{ color: C.ink, fontSize: 12, fontWeight: "600" }}>
                  {t().label}
                </Text>
                <Para>{describeTimeControl(t())}</Para>
              </View>
            )}
          </Each>
        </Section>
        <Section title="操作引导">
          <Each of={GUIDES[active()].steps}>
            {(text, i) => (
              <Para>
                {i() + 1}. {text()}
              </Para>
            )}
          </Each>
        </Section>
        <Para>规则参考：{GUIDES[active()].source}</Para>
        {go() ? <GoHelp /> : active() === "gomoku" ? <GomokuHelp /> : null}
      </Scroll>
    </View>
  );
}
