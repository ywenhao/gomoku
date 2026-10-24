# 弈境 · YI JING

使用 [Native Shell（nsh.dev）](https://nsh.dev/) 的跨平台棋类应用。支持五子棋、围棋、六子棋、飞行棋、中国跳棋、国际象棋、中国象棋和双人陆战军棋，包含操作引导、规则说明、入门测验、残局与棋谱回放。

一套 TSX 代码运行于 Windows、Linux、macOS、Android、iOS 和 Web。原生平台使用系统控件与绘制。应用 ID 保持 `com.gomoku.app`，旧版五子棋与围棋存档、设置、战绩和学习进度继续读取。

## 棋种与规则

| 棋种     | 棋盘与获胜条件             | 主要规则                                                                                         |
| -------- | -------------------------- | ------------------------------------------------------------------------------------------------ |
| 五子棋   | 15×15，五连或长连获胜      | 自由规则，无连珠禁手；保留原有四档 AI                                                            |
| 围棋     | 9 / 13 / 19 路，中国数子法 | 气、提子、自杀禁着、打劫与全局同形再现限制；双方连续虚手后共同标记整块死子并数子                 |
| 六子棋   | 19×19，六连或长连获胜      | 黑首回合一子，之后每方每回合两子；两子共用回合时间，第一子成六立即结束                           |
| 飞行棋   | 四色四人、每方四架飞机     | 6起飞、6奖励再掷、同色跳跃与飞跃、撞机回机场、终点折返                                           |
| 中国跳棋 | 121孔六角星盘，每人10子    | 可选2/3/4/6人，玩家1在下方；六方向单步与短跳连跳，不吃子；进入对营后只能在营内调整；防堵塞约定 |
| 国际象棋 | 8×8，将死获胜              | 易位、吃过路兵、四种升变、应将、逼和、死局、重复与50 / 75回合规则                                |
| 中国象棋 | 9×10，将死或困毙获胜       | 马腿、象眼、炮架、九宫、过河兵卒、将帅照面、单方长将判负及自然限着申请                           |
| 军棋     | 5×12双人陆战暗棋，各25子   | 受约束布阵、道路、铁路、工兵转弯与排雷、行营保护、大本营禁动、炸弹、同级同归于尽、夺旗与无棋可动 |

围棋数值统一以“点”显示：棋子数加围空，白加7.5点，等价于中国数子法的白贴3¾子。死活有争议时可以继续落子解决。

飞行棋、中国跳棋和军棋存在地方及赛事差异，应用在帮助中明确公布采用的版本。飞行棋不是国际通用 Ludo 规则，中国跳棋不是8×8国际跳棋，军棋不是四国军棋。

## 比赛棋钟

复杂棋种使用双方独立棋钟，对战 AI对局中的 AI 同样消耗自己的时间。时间到零后按棋种判负，不会以自动虚手或代走替代比赛超时。

| 棋种                             | 可选时限                                                                |
| -------------------------------- | ----------------------------------------------------------------------- |
| 围棋                             | 5分+3×30秒、10分+3×30秒、3分+3×20秒                                     |
| 国际象棋                         | 15分+每步10秒；5分+每步3秒；90分+每步30秒，各方第40步完成后该方加30分钟 |
| 中国象棋、军棋                   | 30分+每步30秒、10分+每步10秒                                            |
| 五子棋、六子棋、中国跳棋、飞行棋 | 休闲每手或每回合30秒，超时自动完成合法行动                              |

读秒期间及时落子只重置当前期，不恢复已经消耗的期。全部读秒耗尽判负。国际象棋超时还检查对手是否无法以任何合法走法将死，这种情况判和。

围棋默认19路。首页的时限是带选中标记的设置项，深色大按钮用于开始对局；帮助内可查看每种时限的解释。

比赛的具体主时间由赛事规程指定，应用的分钟配置不是所有比赛的统一标准。本地菜单、帮助、观战暂停与复盘暂停棋钟；恢复存档保留双方余时与读秒期数。首页设置只影响新局，不修改继续游戏中的配置。AI 观战不覆盖尚未完成的玩家对局。

中国象棋重复中的单方长将自动判负；长捉、兑、献、拦等复杂棋例进入裁判界面，暂停棋钟并显示近期走法，由裁判按赛事棋例录入和棋或违规方判负。不会把所有重复局面直接误判为和棋。自然限着以无吃子计数，兵卒移动不重置，每方最多十次将军不计入。

## 教学与残局

所有八个棋种均有对局内分步操作引导、完整规则说明和入门小测。五子棋补充攻防顺序、棋型与操作教学；围棋保留四条路线21课进阶课程。只有正确完成小测才记录进度。

残局库包含：

- **围棋420题**：Go Game Guru 的正解树、提示、自动应手、难度与区域筛选。
- **国际象棋600题**：Lichess 的实用残局、将杀、叉击、牵制、串击与弃子，评级覆盖入门至进阶；全部解答线经规则引擎合法重放校验。
- **中国象棋900个局面**：经典杀法和车、马、炮、兵、士象的实用残局。其中30题附带校验全部防守分支的强制将杀解答，其余作为自由研习局面，AI建议不会标为理论正解。

支持名称 / 编号 / 主题搜索、类别、难度、已解状态与分页。挑战题走错保持棋盘，走对自动应手；可提示、重试、切题与逐步回看。研习局面允许自由走子与AI应手，获胜后记录进度。

中国象棋应将时播放离线“将军”语音，与全局声音开关联动。国际象棋显示将军状态；其他棋种没有添加不必要的语音。国际象棋棋子使用本地原创 SVG，避免系统字体缺字或 Emoji 替换。

## 对局、暗棋与存档

- 首页选择棋种、模式、难度、棋盘及时间配置。所有棋种有对战 AI、同设备多人和AI 观战。
- 飞行棋对战 AI模式由玩家控制红方，另外三方为AI；多人模式四人轮流。
- 中国跳棋支持2、3、4或6人同盘对战，玩家1固定下方，玩家2在上方；对战 AI时其余席位由AI操作。
- 军棋开局可交换己方棋子布阵，非法交换不生效。本地双人布阵及每回合交接都先遮盖棋盘，下一方确认接手后才显示自己的军衔。AI决策只使用可见信息。
- 完成对局后禁止悔棋；军棋进行中禁止悔棋以保护暗棋信息。
- 棋谱库保存全部八种棋的动作序列，包含骰子结果和军棋初始布阵，可逐步或自动播放。军棋对战结束后才允许保存公开棋谱，旧的未结束军棋棋谱不显示暗子；AI 观战则可公开双方军衔。恢复双人军棋也须先确认接手。
- 自动存档保存双方棋钟、围棋读秒和数子标记、六子棋未完成的双子回合、飞行棋待移动骰子、跳棋人数、军棋布阵与动作。坏档、非法动作及伪造时限被拒绝。
- 战绩、学习进度、棋谱库与未完成对局分别存储。棋谱最多60份，战绩最多40局；对战 AI模式计积分。胜负以一号玩家（五子棋 / 围棋为黑方）为参照，不计积分的胜负也不会误记为和棋。

## 开发与验证

需要 Node.js 20+（仅工具脚本使用）以及 `nsh 0.2.0`。应用没有额外运行时依赖。

```sh
npm run dev             # 当前系统原生窗口
npm run dev:web         # Web开发
npm run check           # TypeScript检查
npm test                # 全部规则与界面测试
npm run verify          # 检查+测试
npm run build:release   # 编译发布字节码
npm run package:web     # Web静态包，输出 dist/web/
npm run package:linux   # Linux包，输出 dist/linux/
```

打包脚本会去掉 nsh 自动增加的「弈境」层级：Windows、Linux、Web 产物分别直接位于 `dist/windows/`、`dist/linux/`、`dist/web/`；macOS 保留应用包 `dist/macos/弈境.app`，Android 和 iOS 输出 `.apk` / `.ipa` 文件。

测试覆盖规则边界、国际象棋标准走法数与特殊着、全部象棋题面 / 解答、军棋战斗与布阵、飞行棋骰子与撞机、跳棋星盘与连跳、六子棋双子回合、棋钟加秒 / 读秒 / 超时、坏档、棋谱重放、学习和八棋种界面流程。手动测试时钟无需等待真实比赛时长。可用 `nsh test --target web --browser <chromium路径>` 验证真实浏览器绘制。

主要新增文件：`lib/royal.ts`（两种象棋）、`lib/race.ts`（飞行棋与中国跳棋）、`lib/junqi.ts`、`lib/connect6.ts`、`lib/clock.ts`、`lib/multigame.ts`，以及对应纯规则测试；界面位于 `components/MultiGame.tsx`、`MultiBoard.tsx`、`Guide.tsx`、`Endgames.tsx`。

## 部署 Web 到 Cloudflare Pages

`npm run package:web` 生成的 `dist/web/` 就是完整静态站点。当前连接 GitHub 的 `yijing-game` Pages 项目复用 GitHub Actions 已经构建好的 Web 产物，不在 Cloudflare 构建镜像里安装 `nsh`：该镜像没有 `nsh`，而且 `nsh` 的 Linux runtime 要求 GTK 4.14+。

Cloudflare Pages 项目配置：

- **Build command**：`npm run package:web:cloudflare`
- **Build output directory**：`dist/web`
- **Root directory**：留空

`package:web:cloudflare` 会按 `package.json` 的版本下载 `https://github.com/ywenhao/gomoku/releases/download/v<版本>/yijing-web.zip`。版本提交先推送 `main` 时，脚本最多等待 10 分钟，直到对应 Release 资产上传完成。

GitHub 的 `release.yml` 在 Release 发布完成后还会调用 Cloudflare Pages Deploy Hook，确保正式站最终部署最新版本：

1. 在 Cloudflare Pages 项目的 **Settings → Builds & deployments → Deploy hooks** 创建 `main` 分支钩子。
2. 在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 添加 `CLOUDFLARE_PAGES_DEPLOY_HOOK`，值为钩子 URL。
3. 之后每次 `npm run release` 都会自动触发 Pages 部署。

也可以本地直接上传构建产物：

```sh
npm run package:web
npx wrangler@latest pages deploy dist/web --project-name yijing --branch main
```

不要把 `dist/` 其他平台的目录一起上传；Web 站点必须通过 HTTP(S) 访问，直接双击 `dist/web/index.html` 无法运行。

## 数据与许可

- 围棋题库：[Go Game Guru](https://github.com/gogameguru/go-problems)，An Younggil 8p / David Ormerod，**CC BY-NC-SA 4.0**；包含非商业限制，详见 `lib/data/GO-PROBLEMS-LICENSE.txt`。
- 国际象棋：[Lichess Puzzle Database](https://database.lichess.org/#puzzles)，**CC0**，详见 `lib/data/CHESS-PROBLEMS-LICENSE.txt`。保留原始题号，可用 `scripts/build-chess-puzzles.mjs <官方CSV.zst> 600` 重新筛选。
- 中国象棋：[dffge552/xiangqi-pwa-offline](https://github.com/dffge552/xiangqi-pwa-offline)，**MIT**；保留完整版权和许可，详见 `lib/data/XIANGQI-PROBLEMS-LICENSE.txt`。生成脚本 `scripts/build-xiangqi-puzzles.mjs <来源仓库目录>` 会验证题面与强制将杀分支。
- 棋子SVG、规则代码与教学文字：本项目。音效由代码合成，“将军”语音由 Edge zh-CN-YunxiNeural 合成后保存为离线PCM数据，对局期间无需网络。

## 发布

Windows、Linux、macOS、Android、Web的可下载包在 [Releases](https://github.com/ywenhao/gomoku/releases)。macOS为Apple Silicon版；Linux需GTK4.14+；Android未配置仓库签名凭据时为debug签名。iOS可在有签名证书的macOS上本地打包，目前不由CI发布。

发布前同步 `nsh.json` 与 `package.json` 版本、增加构建号，完成检查与测试并提交，然后运行：

```sh
npm run release:dry
npm run release
```

脚本校验工作区与版本、创建并推送 `v*` 标签；GitHub Actions构建五个平台，构建全部成功后上传到Release。不要仅以标签推送成功代替发布完成，应确认Release及五个附件。

版本变化见 [CHANGELOG.md](CHANGELOG.md)。
