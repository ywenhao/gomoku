import { Video, View, effect, signal, type Accessor, type YNode } from "nsh";
import { platform } from "nsh/device";
import { SOUND_NAMES, SOUND_SECONDS, type SoundName } from "../lib/sound";

/**
 * 一个音效播放器：用隐藏的 <Video> 播 WAV。
 *
 * `trigger` 每次自增就从头播一遍；`prime` 只给 Web 用——第一次触摸时
 * 用静音播一下，让浏览器允许之后（倒计时、超时、结算）由定时器触发的
 * 声音也能出声。
 */
function SoundPlayer(props: {
  name: SoundName;
  src: string;
  trigger: Accessor<number>;
  prime: Accessor<number>;
  enabled: Accessor<boolean>;
}) {
  const playing = signal(false);
  const muted = signal(false);
  let node: YNode | null = null;
  let watchdog: number | undefined;
  let unlockTimer: number | undefined;
  let realPlayed = false;
  let primed = false;

  const clearWatchdog = () => {
    if (watchdog !== undefined) {
      clearTimeout(watchdog);
      watchdog = undefined;
    }
  };

  // 媒体还没加载完时 seek 可能抛错；此时从头播放本来也是想要的结果
  const rewind = () => {
    try {
      node?.seek(0);
    } catch {
      /* 未加载完成，直接播 */
    }
  };

  // 真正要出声：取消还没结束的静音预播，从头播。
  effect(() => {
    const n = props.trigger();
    if (n === 0) return;
    realPlayed = true;
    if (unlockTimer !== undefined) {
      clearTimeout(unlockTimer);
      unlockTimer = undefined;
    }
    clearWatchdog();
    muted.set(false);
    rewind();
    playing.set(true);
    // 某些平台（或静音的 WebView）不回调 onEnd，用时长兜底复位
    watchdog = setTimeout(
      () => {
        watchdog = undefined;
        playing.set(false);
      },
      SOUND_SECONDS[props.name] * 1000 + 300,
    );
    return clearWatchdog;
  });

  effect(() => {
    if (!props.enabled()) {
      playing.set(false);
      clearWatchdog();
    }
  });

  // Web 的自动播放限制：把每个音效都在第一次用户触摸里静音播一次，
  // 之后定时器再触发就不会被浏览器拦下。
  effect(() => {
    const n = props.prime();
    if (n === 0 || realPlayed || primed || platform.os !== "web") return;
    if (!node) return; // 音效还没挂载，下一次触摸再试
    primed = true;
    if (unlockTimer !== undefined) clearTimeout(unlockTimer);
    rewind();
    muted.set(true);
    playing.set(true);
    unlockTimer = setTimeout(() => {
      unlockTimer = undefined;
      playing.set(false);
      muted.set(false);
    }, 80);
    return () => {
      if (unlockTimer !== undefined) {
        clearTimeout(unlockTimer);
        unlockTimer = undefined;
      }
    };
  });

  return (
    <Video
      testID={`sound-${props.name}`}
      ref={(v) => {
        node = v;
      }}
      src={props.src}
      paused={!playing() || !props.enabled()}
      muted={muted() || !props.enabled()}
      volume={1}
      controls={false}
      onEnd={() => playing.set(false)}
      onError={() => {
        console.warn("音效播放失败", props.name);
        playing.set(false);
      }}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 1,
        height: 1,
        opacity: 0.01,
      }}
    />
  );
}

/** 十个隐藏播放器；地址准备好之前什么都不挂，失败时游戏照样能玩。 */
export function SoundBank(props: {
  srcs: Accessor<Partial<Record<SoundName, string>>>;
  triggers: Record<SoundName, Accessor<number>>;
  prime: Accessor<number>;
  enabled: Accessor<boolean>;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 1,
        height: 1,
      }}
    >
      <Each of={SOUND_NAMES} key="index">
        {(name) => (
          <If when={props.srcs()[name()] !== undefined}>
            <SoundPlayer
              name={name()}
              src={props.srcs()[name()]!}
              trigger={props.triggers[name()]}
              prime={props.prime}
              enabled={props.enabled}
            />
          </If>
        )}
      </Each>
    </View>
  );
}
