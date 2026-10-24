# 弈境 · YI JING

用 [Native Shell（nsh.dev）](https://nsh.dev/) 写的跨平台棋类应用：**围棋 + 五子棋**。
一套 TSX 代码跑在 **Windows 桌面、Linux、Android、iOS 和 Web** 上，每个平台用各自的
系统控件与绘制（Win32 + Direct2D / GTK / Android View / UIKit / HTML），不是 WebView 套壳。

应用名「弈境」取自「一枰天地」，副标题是「围棋与五子棋」。应用 ID 仍是
`com.gomoku.app`，升级后旧版存档、设置和战绩会继续读取。

## 两个棋种，一个入口

启动后先到首页，不会一进来就把棋盘推到你面前：

- **五子棋**：15×15、无禁手、五连即胜；人机 / 双人 / 人机大战三种模式。
- **围棋**：中国规则数子法，9 / 13 / 19 路，白贴 7.5 子；同样有人机、双人和
  AI 对 AI。
- **人机大战**：两个 AI 自动对弈，五子棋约 2 秒一手、围棋约 1.9 秒一手，可暂停、
  逐步回看、整局回放，并把整局存进棋谱库。
- **残局挑战**：420 道专业死活题，按难度、区域筛选，支持搜索、提示、自动应手和
  正解树判定，解出后记录进度。
- **学棋**：按段位分四条路线、共 21 课，图文讲解 + 随堂小测，逐课解锁。
- **棋谱库**：手动保存五子棋 / 围棋棋谱，随时打开逐步回放或删除。
- **帮助与规则**：围棋与五子棋分开讲解，围棋部分带 9 路图解。

首页的「对局设置」只影响新对局；「继续游戏」沿用存档里的棋类、路数、模式和难度。

## 五子棋

- 15×15 棋盘，无禁手，横、竖、两条斜线任意方向五连或长连即胜。
- **人机对战**：你执黑先行，AI 执白。难度分「简单 / 普通 / 困难 / 地狱」；困难档
  会算连续冲四，地狱档还会主动拆对手的 VCF。
- **双人对战**：同一台设备轮流落子，不计积分，只记战绩。
- 悔棋、重新开始；人机模式下悔棋会一次退回「你 + AI」两步。
- 最后一手有红点标记，五连的子会红圈脉冲提示。
- 落子、最后 5 秒滴答、超时、胜 / 负 / 和结算都有音效；音频由代码合成，不打包
  音频资源，可在首页或对局菜单里关掉。
- 桌面端鼠标悬停显示半透明落子预览；快捷键 `U` 悔棋、`R` 重开、`M` 菜单、
  `Esc` 关闭浮层。

五子棋 AI 仍是原来的棋型查表 + alpha-beta 迭代加深 + VCF 攻防。四档预算约为
普通 8k 节点 / 160ms、困难 20k / 480ms、地狱 30k / 1500ms；每步都有
`fallbackMove` 兜底，对局不会卡死。

## 围棋

采用**中国规则数子法**：黑先、白后，白贴 7.5 子。

- **三种路数**：9 路（81 点，新手推荐）、13 路（169 点）、19 路（361 点）。
  星位与天元按路数绘制。
- **气与提子**：同色相连的棋块共享气；气被填满后整块提掉。禁入自杀点。
- **打劫**：不能立即回提刚被提掉的那一子；系统会在棋盘上标出禁着点。
- **虚手**：可以选择停一手；双方连续两次虚手进入数子。
- **数子**：数子阶段可以点「标记死子」逐个点掉双方认可的死子，再确认结果。
  计算方式是「己方棋子数 + 围住的空点数」，白方再加 7.5 子。
- **结果**：显示「黑棋 / 白棋 N.5 子胜」或和棋，并写入战绩（人机模式计分，
  双人和人机大战不计分）。
- **悔棋 / 重新开始 / 保存棋谱**：围棋对局中同样可用；保存的是完整落子序列，
  包括虚手，重开棋谱能逐步复现。
- **落子倒计时**：默认每手 30 秒；最后 5 秒进度条转红并滴答。超时自动虚手并扣分。
- **继续游戏**：未下完的围棋会随落子自动存档，关掉应用后从首页「继续游戏」恢复。

围棋 AI（`lib/go-ai.ts`）是纯启发式：气、提子、打吃、真眼规避和位置价值。四档强度：

| 难度 | 行为 |
| --- | --- |
| 简单 | 在合法点里随机挑，常下出松散的棋 |
| 普通 | 优先提子、救被打吃的棋，兼顾角边 |
| 困难 | 取启发式最高分，避免自紧气与填自己的眼 |
| 地狱 | 再向前看一手对手的最佳应手，并做提子 / 打吃战术过滤 |

## 人机大战

首页点「人机大战」直接开始观战，不需要先选人机或双人。

- 五子棋每手约 2000ms，围棋每手约 1900ms；AI 思考期间状态栏会提示。
- **暂停 / 继续**：暂停后 AI 不再落子，计时也停。
- **上一步 / 下一步**：可以退到开局，也可以走到最新一手；到两端时按钮自动禁用。
- **整局回放**：从起点自动逐手走到终局，结束后停在终局局面。
- **保存棋谱**：对局中或结束后都能把当前整局存进棋谱库。
- 人机大战不计积分，但会计入棋谱库；它和「继续游戏」互不影响，不会覆盖你
  未下完的人机 / 双人棋。

围棋人机大战在棋盘下到很晚仍无胜负时会主动虚手收束，避免无限对局；双方连续
虚手后进入数子。

## 残局挑战

数据来自 **Go Game Guru Weekly Go Problems**：

- 原始题集：<https://github.com/gogameguru/go-problems>
- 作者：An Younggil 8p / David Ormerod
- 许可：**CC BY-NC-SA 4.0**（非商业性使用、相同方式共享）
- 应用内共 **420 道**，含正解树；难度分布：简单 140、普通 140、困难 90、地狱 50。
- 题目按「角部 / 边上 / 中腹」分类，名称由区域与稳定编号组成（如「角部死活 001」），
  支持按难度、区域筛选，按编号 / 名称 / 难度排序，也支持关键字搜索。
- 走对会按正解树自动应手；走错只提示「这一手不对」，不会污染棋盘；可以重试、
  提示当前正解点、上一题 / 下一题。
- 解出的题会记进度，首页显示「已解 / 420」。

题面与解答树的生成脚本是 `scripts/build-tsumego.mjs`，生成文件
`lib/data/tsumego.ts` 请勿手改。完整许可见 `lib/data/GO-PROBLEMS-LICENSE.txt`。

## 学棋

按段位分四条路线，共 21 课：

| 路线 | 段位 | 内容 |
| --- | --- | --- |
| 启蒙 | 30 级 – 20 级 | 棋盘、气、提子、连接、打劫、数子 |
| 基础 | 20 级 – 10 级 | 做活、杀棋、对杀、围空、布局起手 |
| 进阶 | 10 级 – 1 级 | 手筋、定式、厚薄、弃子转身、官子 |
| 段位 | 1 段以上 | 形势判断、模样攻防、复杂死活、劫争、复盘 |

每课都有图文讲解、9 路示意图、要点列表和一道选择题。**完成小测才记录进度**，
之后可以随时回来重读或重做；课程表会显示每条路线的完成数。

## 棋谱库

- 五子棋和围棋共用一份棋谱列表，保存后按时间倒序排列，最多 60 份。
- 棋谱记录棋种、模式、难度、路数、结果、落子序列和保存时间；未命名时自动用
  「棋种 · 难度 · 结果 · 月-日 时:分」命名。
- 打开棋谱可以「第一手 / 上一手 / 播放 / 下一手 / 最后一手」，逐步回放；围棋
  棋谱包括虚手。
- 删除需要连点两次确认；删除棋谱不会影响战绩、积分或「继续游戏」。

## 帮助与规则

首页和对局菜单都有「玩法与帮助」入口，帮助浮层里有两个标签：

- **五子棋**：基本规则、活四 / 冲四 / 活三 / 眠三 / 双三 / 四三、开局布局、攻防
  顺序、VCF / VCT、常见错误。
- **围棋**：围棋是什么、气、提子、连接与分断、打劫、真眼与假眼、做活与杀棋、
  围空、数子与胜负，并配有 9 路小棋盘图解。

帮助打开期间倒计时与 AI 暂停；点「关闭」或按 `Esc` 回到原来的界面。从对局菜单
打开帮助后，关闭帮助时菜单仍然保留。

## 菜单、计分与结算

**菜单**（右上角「菜单」，或 `M`）里能看到总分、单局最高、连胜、总局数与胜平负，
也能改对战模式 / AI 难度 / 棋盘路数（围棋）/ 限时开关 / 声音，并查看最近 40 局的
战绩。底部还有「玩法与帮助」「返回游戏菜单」和「退出游戏」。「清空全部记录」需要
连点两次确认，4 秒不点自动取消，清空后总分、最高分、连胜一起归零。

**单局得分**（`lib/score.ts`，纯函数、可单测；五子棋和围棋的人机模式共用）：

| 项 | 分值 |
| --- | --- |
| 胜利基础 | 简单 100 / 普通 180 / 困难 300 / 地狱 500 |
| 速度奖励 | 用时越短越高，最高 +120（120 秒内线性衰减） |
| 效率奖励 | 手数越少越高，最高 +90（55 手内每少一手 +3） |
| 连胜奖励 | 第 2 连胜起每连胜 +15，封顶 +50 |
| 和棋 | +30 |
| 落败 | −60 |
| 悔棋 | 每次 −15 |
| 超时 | 每次 −10 |

星级：赢棋且全程没悔棋没超时、用时 ≤ 72 秒 → ★★★；没悔棋没超时 → ★★；否则 ★。
总分只增不减到 0 为止。双人、人机大战和围棋的非人机模式不计积分，只记战绩。

**落子倒计时**：默认开启，每手 30 秒。最后 5 秒进度条边框转红并闪烁、每秒滴答
一声。超时惩罚是「扣 10 分 + 系统自动落一手弱棋 / 虚手」，不是直接判负。人机 /
双人这类本地对局在菜单或帮助打开时计时暂停，关掉后接着走，不会靠开关菜单刷新
时间。人机大战不计时。

**结算浮层**：卡片从 0.86 缩放到 1 弹入，星星逐颗弹跳出现，得分从 0 滚动到实际
分数，按结果给一句情绪文案，再列出计分明细、本局得分、累计总分与连胜徽章。
「看看棋盘」收起浮层保留终局，「再来一局」直接开新局。人机大战和围棋的结算
浮层还会提供「保存棋谱」。终局后不能悔棋（避免靠悔棋翻掉已经结算的胜负）。

## 存档与继续游戏

- 有未下完的对局时首页显示**「继续游戏」**，并标出棋类、路数、模式、手数和剩余
  时间；没有存档时只显示「开始新对局」。
- 「开始新对局」使用首页当前设置；「继续游戏」沿用存档里的设置，不受首页后来
  改动影响。
- 对局中打开菜单可以**「返回游戏菜单」**，当前棋盘会先保存；下次进来点「继续游戏」
  立即恢复。
- **「退出游戏」需要连点两次确认**；确认后先把设置和对局写入 storage，再请求宿主
  关闭应用。直接关窗口或进程被杀时，也能靠持续自动存档回到上一手附近。
- 围棋存档保存完整落子序列（含虚手）、路数、模式、难度和剩余时间，启动时用
  `goStateFromMoves` 重放校验，坏档直接忽略，不拦启动。

存档时机：每次落子、虚手、悔棋、切换设置后写一次；对局中每 5 秒刷新一次剩余
时间；结算、重新开始或开新局时清掉未完成存档。

## 目录结构

```
gomoku/
├── App.tsx              入口：首页 / 五子棋对局 / 围棋对局 / 残局 / 学棋 / 棋谱路由与存档
├── components/
│   ├── Home.tsx         首页：棋类入口、继续、新局、设置、残局 / 学棋 / 棋谱、帮助、退出
│   ├── Board.tsx        通用棋盘：Canvas 木纹 / 网格 / 星位 + n×n 可点击交叉点
│   ├── GoGame.tsx       围棋对局：气 / 提子 / 打劫 / 数子 / 死子 / AI / 暂停回放
│   ├── Tsumego.tsx      残局列表与解题界面：筛选、搜索、提示、自动应手
│   ├── Learn.tsx        学棋：四条路线、课程图文、随堂小测
│   ├── Records.tsx      棋谱库：列表、逐步回放、删除
│   ├── Menu.tsx         对局菜单：统计、设置、声音、帮助、返回首页、退出
│   ├── Help.tsx         帮助浮层：五子棋 / 围棋双标签，围棋图文规则
│   ├── Result.tsx       结算浮层：星级 / 分数滚动 / 计分明细 / 保存棋谱
│   ├── Sound.tsx        隐藏的音效播放器（每个音效一个 Video）
│   └── ui.tsx           按钮、二次确认按钮、分段控件、棋子圆点
├── lib/
│   ├── gomoku.ts        五子棋纯规则：落子、胜负判定、和棋
│   ├── go.ts            围棋纯规则：气、提子、打劫、虚手、数子、棋谱重建
│   ├── go-ai.ts         围棋 AI：气 / 提子 / 打吃 / 真眼规避 / 位置价值
│   ├── ai.ts            五子棋 AI：棋型查表 + alpha-beta + VCF 攻防
│   ├── tsumego.ts       残局运行逻辑：正解树、错手、提示、自动应手
│   ├── learn.ts         四条学棋路线、21 课图文与测验
│   ├── records.ts       棋谱格式、校验、命名、回放辅助
│   ├── study.ts         学棋 / 残局进度存取
│   ├── save.ts          未完成对局的存档格式与校验（五子棋 / 围棋）
│   ├── score.ts         计分规则、格式化、战绩类型
│   ├── sound.ts         代码合成 WAV 音效
│   └── data/
│       ├── tsumego.ts   自动生成的 420 道残局（勿手改）
│       └── GO-PROBLEMS-LICENSE.txt
├── App.test.tsx         旧版界面流程测试（首页、五子棋、菜单、计时、存档）
├── App.features.test.tsx 多棋类功能测试（围棋、AI 大战、残局、学棋、棋谱）
├── nsh.json             应用名、id、版本、图标、亮色外观与能力
├── package.json         命令别名 + 版本号镜像
├── scripts/
│   ├── build-tsumego.mjs 从 Go Game Guru 题集生成 lib/data/tsumego.ts
│   ├── release.mjs      校验版本 / 工作区 / tag，然后打 tag 并推送
│   └── clean.mjs        删 dist/（--all 连 .nsh/、.shots/ 一起）
├── icon.png             应用图标
└── .github/             CI：检查 + 六平台打包，tag 构建自动发 Release
```

## 命令

常用命令都收在 `package.json` 里，`npm run <name>` 就行；右列是它实际执行的 nsh
命令。`npm` 只是别名，项目没有运行时依赖。

| script | 实际执行 | 用途 |
| --- | --- | --- |
| `npm run dev` | `nsh run .` | 当前系统的原生窗口，热更新 |
| `npm run dev:web` | `nsh run . --target web` | 浏览器，终端会打印地址 |
| `npm run dev:android` | `nsh run . --target android` | 需要已启动的模拟器或已连接的设备 |
| `npm run dev:ios` | `nsh run . --target ios` | 仅 macOS + Xcode 可用 |
| `npm run check` | `nsh check` | TypeScript 类型检查 |
| `npm test` | `nsh test` | 全部测试 |
| `npm test -- App.features.test.tsx` | `nsh test App.features.test.tsx` | 只跑一个文件 |
| `npm run verify` | `nsh check` + `nsh test` | 提交前跑一遍 |
| `npm run build` | `nsh build .` | 编译成 QuickJS 字节码，不打包 |
| `npm run build:release` | `nsh build . --release` | 同上，压缩并去掉调试信息 |
| `npm run package:windows` | `nsh package --target windows -o dist/windows` | `弈境/` + `.zip` |
| `npm run package:linux` | `nsh package --target linux -o dist/linux` | `弈境/` + `.tar.gz` |
| `npm run package:macos` | `nsh package --target macos -o dist/macos` | ad hoc 签名的 `弈境.app` |
| `npm run package:android` | `nsh package --target android -o dist/android` | `.apk`（需 Android SDK + JDK） |
| `npm run package:web` | `nsh package --target web -o dist/web` | 静态站点，丢给任意服务器 / CDN |
| `npm run package:ios` | `nsh package --target ios -o dist/ios` | `.ipa`（需 macOS + Xcode + 签名） |
| `npm run clean` | — | 删 `dist/` |
| `npm run clean:all` | — | 连 `.nsh/`（编译缓存）、`.shots/` 一起删 |
| `npm run release:dry` | — | 只检查版本、tag、工作区，不落改动 |
| `npm run release` | — | 打 tag 并推送，CI 自动构建 + 发 Release |

前提是 `nsh` 在 PATH 里（`nsh --version` 应输出 `0.2.0`）。本机是 `mise use -g
github:longbridge/nsh` 装的，shim 在 `~/.local/share/mise/shims`，没进 PATH 的话
`npm run` 会报 `nsh: command not found`。

保存文件会热更新，终端同时打印日志与报错。

## 测试

```sh
npm run verify           # check + test
nsh test                 # 只跑测试
nsh test lib/go.test.ts
nsh check                # TypeScript 类型检查
```

当前共 **105 个测试**，覆盖：

- 五子棋规则、AI 自对弈、计分、音效、存档、旧界面流程；
- 围棋气 / 提子 / 自杀 / 打劫 / 虚手 / 数子 / 死子 / 棋谱重建 / 四档 AI；
- 420 道残局的题面与正解树合法性、筛选排序、错手与自动应手；
- 棋谱格式校验、命名、排序、上限与回放轮次；
- 学棋 / 残局进度去重、坏数据回退与上限；
- 多棋类界面流程：围棋落子与数子、AI 对 AI 暂停回放、残局解题、学棋小测、
  棋谱保存与删除。

界面测试通过 `testID` 驱动。常用入口：`home-new`、`home-continue`、
`home-aiai`、`home-tsumego`、`home-learn`、`home-records`、`seg-game-gomoku` /
`seg-game-go`、`menu-go-9/13/19`、`go-pass`、`go-scoring`、`go-dead-toggle`、
`aiai-pause`、`aiai-step-back`、`aiai-step-forward`、`aiai-replay`、`aiai-save`、
`tsumego-open-<id>`、`tsumego-hint`、`learn-option-<n>`、`record-play` 等。
倒计时用 `open(..., { clock: {} })` 的手动时钟测，不需要真等 30 秒；用同一个
storage 再 `open` 一次可以模拟关掉应用后重新启动。

## 打包

```sh
npm run package:windows   # → dist/windows/弈境/弈境.exe 和 .zip
npm run package:web       # → dist/web/弈境/（index.html + 内容哈希资源）
npm run package:android   # → dist/android/弈境.apk（需 Android SDK + JDK）
npm run package:ios       # → dist/ios/弈境.ipa（需 macOS + Xcode + 签名）
```

**只能在目标系统上打对应的包**：nsh 每个宿主系统发一份发行包，里面只有该系统的
runner，所以在 Windows 上 `package:linux` 会报 `nsh-linux-app not found`。跨平台
构建交给 CI。

Windows 包解压后直接双击 `弈境.exe` 即可运行（运行时在同目录的 `nsh/` 里，别分开）。
懒得自己打的话，直接去 [Releases](https://github.com/ywenhao/gomoku/releases) 下
现成的：`yijing-windows-x64.zip`、`yijing-linux-x64.tar.gz`、`yijing-macos-arm64.zip`、
`yijing-android.apk`、`yijing-web.zip`。Web 包解压后随便起个静态服务器就能玩
（需要 http，双击 `index.html` 不行）。

## 持续集成

两个 workflow：`build.yml` 负责构建并上传 artifact，`release.yml` 负责发到
[Releases](https://github.com/ywenhao/gomoku/releases)。`build.yml` 在 `main` 的
push、PR 和手动触发时跑六个 job：

| Job | Runner | 产物 |
| --- | --- | --- |
| 类型检查与测试 | `ubuntu-24.04` | `nsh check` + 全部测试 |
| Windows x64 | `windows-2025` | `yijing-windows-x64.zip` |
| Linux x64 | `ubuntu-24.04` | `yijing-linux-x64.tar.gz` |
| macOS arm64 | `macos-26` | `yijing-macos-arm64.zip` |
| Android | `ubuntu-24.04` | `yijing-android.apk` |
| Web | `ubuntu-24.04` | `yijing-web.zip`（静态站点） |

**发版**：推一个 `v*` tag，`build` 会跑完六个 job，`release.yml` 通过
`workflow_run` 接在它后面，用那次 build 的 run-id 跨 run 取回 artifact，挂到同名
tag 的 Release 上。非 tag 的构建跑完也会触发 `release.yml`，但 `if` 判断
`head_branch` 不是 `v*` 就直接跳过，不会误发。

```sh
# 改 nsh.json 和 package.json 里的 version，提交，然后：
npm run release:dry      # 只检查：版本是否一致、工作区是否干净、tag 是否被占
npm run release          # 打 tag 并推送，剩下的交给 CI
```

等价的手动命令是 `git tag -a v1.4.0 -m "弈境 1.4.0" && git push origin v1.4.0`。

几个和 nsh 有关的注意点：

- **版本都钉死了**。runner 镜像写具体版本而不是 `-latest`，action 用声明 `node24`
  的大版本；升级时一起改。
- **项目本身不跑 Node**，`package.json` 只放命令别名；打包 / 类型检查 / 测试全在
  `nsh` 这一个二进制里。CI 日志里出现的 Node 是各个 action 自己的运行时。
- **每个 job 只能打自己系统的包**。Linux 的包必须在 Linux 上打、macOS 的必须在
  macOS 上打。`.github/actions/setup-nsh` 负责按 runner 系统装对应那份并缓存。
- **macOS 只有 arm64 版**，所以用 `macos-26`（Apple Silicon）并断言 `uname -m`。
- **Linux 包运行需要 GTK 4.14+**（Ubuntu 24.04 及以上）。
- **Android 签名**：配置 `ANDROID_KEYSTORE_BASE64`、`ANDROID_KEY_ALIAS`、
  `ANDROID_KEYSTORE_PASSWORD` 三个 secret 就走正式签名，否则用标准 debug key。
- **iOS 没放进来**：需要 Apple 开发者证书与 `.mobileprovision`；要加的话在 macOS
  job 里补一步 `--sign <identity> --profile <file>`。

## 实现要点

**多棋类与路由**（`App.tsx`）

- `GameKind = "gomoku" | "go"`，首页、存档、战绩、棋谱都带棋种字段；旧版无棋种
  的数据按五子棋读取。
- 棋盘与落子序列按棋种分开：五子棋用 `number[]` + `Move[]`，围棋用 `GoMove[]`，
  围棋的棋盘、提子数、打劫点都由 `goStateFromMoves` 重建，不存派生状态。
- 五个屏幕（首页 / 五子棋 / 围棋 / 残局 / 学棋 / 棋谱）用 `signal` 切换，返回首页
  时先写存档。

**围棋规则**（`lib/go.ts`）

- 一维数组 `index = y * size + x`；邻居表按路数缓存。
- `playGo` 先落子，再提掉对方无气的棋块，最后检查自杀与打劫；提一子且己方只有
  一气时记录劫点。
- `scoreGo` 先去掉标记的死子，再对每个空区做连通块，只有被单方包围的空点才算
  该方地盘；中国规则按「子 + 空」数子，白方加 7.5。
- `goStateFromMoves` 逐步重放并校验，非法手返回 `null`，用于继续游戏和棋谱回放。

**围棋 AI**（`lib/go-ai.ts`）

- 候选点来自空点与棋块周围；评分包括提子数、打吃、气、角边位置价值、避免填自己
  真眼、避免自紧气。
- 简单档在合法点里随机；普通档做提子 / 救棋过滤；困难档取最高分；地狱档再对
  候选点模拟对手最佳应手，并做战术过滤。
- 纯计算，不读写全局状态；每档有 `deadlineMs` 预算，异常时用 `fallbackGoMove`。

**残局**（`scripts/build-tsumego.mjs` + `lib/tsumego.ts`）

- 解析 SGF 的 `AB` / `AW` 题面与带 `Correct` 注释的解答树，只保留正解分支：
  黑棋分支全部保留，白棋只保留第一条正解应手，保证应用里每手都有明确判定。
- 题面用 `playGo` 重放校验；生成时跳过非法题面或没有正解分支的题。
- 应用内用 `pending` 保存当前可选的正确节点；错手不改棋盘；走对后自动执行白棋
  应手，直到正解结束。

**学棋**（`lib/learn.ts`）

- 四条路线各 5–6 课，每课由若干 `section` 组成，可带 9 路示意图、要点和一道
  选择题。
- 课程完成状态存在 `gomoku.study.v1`；只有答对才写入。

**棋谱与进度**（`lib/records.ts` / `lib/study.ts`）

- 棋谱库和「继续游戏」分开：棋谱可以保存已结束的整局，最多 60 份；继续存档只
  保存未完成的对局。
- 棋谱读取时校验 id、棋种、落子顺序、坐标、虚手和围棋局面；坏条目跳过，不拖垮
  整个列表。
- 学棋 / 残局进度都是去重后的 id 列表，坏 JSON、非对象、空字符串都会回退，最多
  2000 个 id。

**性能与内存**

- 棋盘用一维 `number[]`，每次落子生成新数组（不可变）；每个交叉点的棋子值用
  `computed` 单独订阅，落一子只更新受影响的节点，不是整盘重绘。
- 木纹与网格用 `Canvas` 一次记录、平台原生重放，不参与每帧 JS。
- 棋盘点数随路数变化（81 / 169 / 225 / 361），棋子节点按落子增减；棋盘尺寸以
  accessor 下传，窗口缩放时格子与棋子跟着重算。
- 定时器（AI 思考、倒计时、回放、提示条、结算滚动）都在 effect 清理函数里清掉；
  AI 任务用 `round` 计数器作废旧任务。
- 战绩最多 40 条，棋谱最多 60 份，每次只写一个 JSON。

**存档与权限**

- `nsh/storage` 四个 key：
  - `gomoku.v2`：分数、最高分、连胜、胜平负、战绩、棋类、模式、难度、路数、
    限时开关、声音开关；
  - `gomoku.game.v1`：未下完的对局（五子棋落子序列或围棋落子序列、设置、剩余
    时间、悔棋 / 超时次数、开局与保存时间）；
  - `gomoku.study.v1`：残局已解 id、课程已完成 id；
  - `gomoku.records.v1`：手动保存的棋谱。
- 旧键 `gomoku.v2` / `gomoku.game.v1` 继续可读；旧对局没有 `kind` 字段时按五子棋
  读取。
- `nsh.json` 声明 `fs.read` / `fs.write` 限定在 `${dataDir}`（写音效文件）、
  `process.exit`（退出按钮请求宿主关闭界面）和 `statusBar`（亮色状态栏）；没有
  网络权限。

**跨平台**

- 只用 `nsh` / `nsh/base` / `nsh/storage` / `nsh/keymap` / `nsh/device` 的跨平台
  API；唯一的平台分支是音效地址（原生落地文件 / Web 用 Blob URL）。
- 棋盘尺寸由 `onLayout` 实测可用空间后取 `min(宽, 高, 620)`，手机竖屏、平板、
  桌面窗口自适应；`SafeAreaView` 处理刘海与状态栏。
- 首页、帮助、菜单、课程、残局和棋谱都使用 `Scroll`，小屏（320×568）也能滚动
  查看；390×844 手机竖屏是默认测试视口。
- 悬停预览仅在鼠标平台触发（`onHoverIn` 在触摸设备上不会触发）。

## 数据来源与许可

- 五子棋、围棋规则与 AI、教程文字、界面代码：本仓库。
- 残局题面与解答：Go Game Guru Weekly Go Problems，作者 An Younggil 8p /
  David Ormerod，许可 **CC BY-NC-SA 4.0**。应用内数据是题面与解答树的压缩改编版，
  同样按该许可提供；完整许可见 `lib/data/GO-PROBLEMS-LICENSE.txt`。
- 音效由代码合成，不包含第三方音频。

## 版本

- **1.4.0**：改名「弈境」；新增围棋（9 / 13 / 19 路、数子、死子、四档 AI）、
  人机大战、420 道残局、四条路线 21 课学棋、棋谱库、围棋图文帮助；存档兼容旧版。
- **1.3.0**：重写五子棋 AI，新增地狱难度与玩法帮助。
- **1.2.0**：游戏菜单、继续游戏、声音开关、退出确认。
- **1.1.0**：音效、倒计时、结算浮层与计分。
