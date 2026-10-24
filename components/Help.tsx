import { Scroll, Text, View, type JSX } from "nsh";
import { windowSize } from "nsh/device";
import { C, PressButton } from "./ui";

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

/**
 * 帮助浮层：规则、棋型、开局布局与攻防顺序。
 * 打开期间由 App 暂停倒计时与 AI，关闭后回到原来的界面。
 */
export function HelpPanel(props: { onClose: () => void }) {
  const maxHeight = Math.max(300, Math.min(640, windowSize().height - 48));

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
          maxWidth: 440,
          maxHeight,
          backgroundColor: C.panel,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: C.line,
          boxShadow: "0 24px 60px rgba(40,26,12,0.34)",
        }}
        contentStyle={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 20 }}
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
              五子棋 · 15 × 15 · 无禁手
            </Text>
          </View>
          <PressButton label="关闭" testID="help-close" onPress={props.onClose} />
        </View>

        <Section title="一、怎么下">
          <Para>
            黑棋先行，双方轮流在交叉点落子。横、竖、两条斜线任意方向先连成
            <Text style={{ color: C.ink, fontWeight: "700" }}> 五子或五子以上 </Text>
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
          <Bullet>对手能成五：必须堵住那个成五点；有两个不同的成五点通常已经救不了。</Bullet>
          <Bullet>自己能做活四或双四：落子，下一手必胜。</Bullet>
          <Bullet>对手下一步能做活四：占住能形成活四的关键点，不能去别处抢攻。</Bullet>
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
          <Bullet>只盯着自己的三连，没看到对手的冲四或活三，下一手直接被成五。</Bullet>
          <Bullet>把眠三当成活三，或者堵错一端，让对手从另一端做出活四。</Bullet>
          <Bullet>开局把棋子下在边角，子力分散，中盘没有可连接的方向。</Bullet>
          <Bullet>全程只做一条线，被对手一次封死后没有第二计划。</Bullet>
          <Bullet>为了“先手”连续冲四，却没有后续成五线路，反而把自己的变化走死。</Bullet>
          <Bullet>时间快到时还在想复杂进攻；最后几秒应先找成五和对手的成五点。</Bullet>
        </Section>

        <Section title="六、操作与计分">
          <Bullet>
            右上角「菜单」可调整模式、难度、限时与声音；打开菜单或帮助时倒计时暂停。
          </Bullet>
          <Bullet>
            人机模式悔棋一次退回你和 AI 各一手，扣 15 分；超时由系统替你落一手，
            扣 10 分。双人模式只记录战绩，不计积分。
          </Bullet>
          <Bullet>
            桌面快捷键：U 悔棋、R 重新开始、M 菜单、Esc 关闭帮助或浮层。
          </Bullet>
          <Bullet>
            胜利基础分：简单 100、普通 180、困难 300、地狱 500；另有速度、效率和连胜奖励。
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
      </Scroll>
    </View>
  );
}
