# 部署当前 demo

代码已经提供 30 秒服务端回合限时、房间来源配额、私有持久化和 CommonJS 启动入口；本文件不是已完成上线的证明。

## 必要条件

- Node.js 22 或 24；没有第三方运行依赖，不需要 npm install。
- 只运行一个应用进程/实例。当前状态管理不是分布式数据库。
- 公网使用 HTTPS；整个应用目录和数据目录放在文档根目录之外。不能把 server、数据文件或 Git 仓库上传到可直接下载的网页目录。
- 数据目录是本机持久磁盘，应用用户可读写；不要用共享网络文件系统。它含会话令牌和隐藏手牌，不应进入 Git、备份公开链接或静态站点。

## Spaceship Supreme

Supreme 是试用或付费共享托管，不是长期免费 VPS。官方确认 Setup Node.js App 使用 Passenger。

先在本地 `gaogame` 目录运行 `npm run pack`，得到 `dist/tiddip-gaogame.zip`。这个包只含启动入口、运行配置、共享代码、客户端和服务端，不含文档、测试、存档或环境文件；无需自己选文件。解压后 `app.cjs` 必须直接位于 Application root，不能再多套一层 `gaogame/`。

1. cPanel → Setup Node.js App → Create Application，确认有 Node.js 22/24。
2. 应用模式选 Production；Application root 使用账户主目录下的独立文件夹，例如 `apps/tiddip-gaogame`，对应 `/home/你的账户/apps/tiddip-gaogame`。`apps` 是自选文件夹名，不是服务器系统根目录 `/apps`，也不是网址路径。在这个目录上传 ZIP 并解压，package.json、app.cjs、server、client 并列。保留面板生成的配置文件，不覆盖已有私有数据。
3. Application URL 选 tiddip.com，路径 /gaogame；启动文件填 `app.cjs`。保留现有首页在其文档根目录，不覆盖首页。
4. 环境变量 `GAME_DATA_DIR=/home/你的账户/private/tiddip-gaogame-data`；NODE_ENV=production。目录需在所有网页根目录之外。端口由宿主分配，不能给共享主机随意开公网端口。
5. 确认主机允许单进程，并设置一个实例。持久目录锁会拒绝第二个进程，避免不同玩家落入不同内存对局，但不能代替宿主配置。确认空闲回收、重启和资源额度；不能据此保证稳定。
6. 启动后检查 `/gaogame/`、`/gaogame/api/health`、两个浏览器加入同一房间、30 秒自动换人；最后检查重启后原链接和会话恢复。宿主 URL 重写和 Passenger 加载需在真实环境验证。

如果无法配置单实例，当前版本不应直接放在该运行方式下：应更换可控制的单进程运行方式，或先实现共享数据库和跨进程并发控制。

## 代理来源

默认仅信任 TCP 连接来源；已认证玩家有独立请求限额。只有确认入口会追加/覆盖正确的转发链后，才配置 `TRUSTED_PROXY_ADDRESSES` 为**实际直接代理地址**，逗号分隔。

不要因为看到本机地址就盲目填 127.0.0.1 或整个内网网段。配置不正确会让不同用户共用三间房配额；过度信任会使攻击者伪造来源。地址链从受信一端解析，非法链回退为连接来源。入口需保留实际 Host，才能通过同源写请求校验。

## 可控单进程主机或容器

在 gaogame 目录运行 `node app.cjs`。本机默认 127.0.0.1:3000；只有需要接受入口代理连接时设置 HOST 和 PORT。不自动启动本地服务。

`gaogame/deploy/Dockerfile` 提供非 root 的 Node 24 容器配置；构建上下文仍为 `gaogame`，命令为 `docker build -f deploy/Dockerfile -t tiddip-gaogame .`。需为 /data 配持久卷；只启一个副本，HTTPS 由入口代理处理。本次未安装 Docker，也未实际构建或发布镜像。

## 2026-10-18 路径迁移

- 本地源码：`gaogame/`；部署包：`gaogame/dist/tiddip-gaogame.zip`。
- 云端 Application root：`apps/tiddip-gaogame`；Application URL：`https://tiddip.com/gaogame/`；启动文件仍为 `app.cjs`。
- 使用 CloudLinux Selector 修改应用根目录与 URI，由它同步移动运行环境并生成 Passenger 配置；随后上传运行文件并重启应用。
- 首页、API、资源导入和邀请链接均使用 `/gaogame/`。按最新要求取消旧 `/game/` 跳转，将该路径留给将来的项目；浏览器身份存储键不改名，避免丢失已记住的令牌。此前访问过的浏览器可能缓存旧 308，需要清除该站点缓存。
- 主题按钮通过独立脚本加载，不依赖游戏模块或 API 连接；这不代表整个联网游戏可以离线使用。
- 迁移前云端备份：`/home/sufylwsmby/private/gaogame-migration/20261018T124142Z/before.zip`，含原应用、首页与挂载配置。备份位于文档根目录之外。
- 当前云端未设置 `GAME_DATA_DIR`，房间仍为内存存储，重启会丢失房间；路径兼容不等于恢复重启前的房间。
- 本地旧 `game/dist/tiddip-game.zip` 被其他程序占用，暂留且不进 Git；它不是新的部署包。关闭占用程序后可删除旧 `game` 目录。

## 运行与回收

- 每回合 30 秒，由服务端读取、动作入口及后台定时共同执行；修改浏览器倒计时不能增加时间。
- 地雷落点超时自动选合法已揭示格，优先安全格；无合法格时留在原格并结束回合。
- 同一 IPv4 或 IPv6 /64 来源最多保留三间房，全局最多 200。房主转移、结束或只读轮询不释放/绕过来源配额；删除空房或回收后释放。共享网络用户共用创建配额，但认证玩家读写额度独立。
- 无人工操作时，大厅 15 分钟、选出生点 10 分钟、游戏 30 分钟、结束 10 分钟回收；房间绝对寿命六小时。
- 使用 GAME_DATA_DIR 时原子保存状态和截止时间，重启后恢复，并按现时处理过期回合。不是高可用或抗 DDoS 方案，仍不能防多开、串通或自动操作。
- 正常停止会释放 process.lock；同一主机和 PID 命名空间内，崩溃后识别已退出的旧进程，并校验起始标记以区分 PID 复用。容器重建/异常重启导致主机名或 PID 命名空间变化、锁损坏或启动时留下 process.lock.guard 时会保守拒绝启动：先停止所有使用该目录的实例，确认没有进程运行，再手动移除数据目录下的这两个锁文件并启动一个实例。运行中不能删除锁。

## Git 工作流

本地修改、针对性检查、按功能提交，再推到自己的 GitHub 仓库。Git 远程 `tiddip` 指向 `https://github.com/hsszl/tiddip.git`；push 同步源码，不会自动发布到 Spaceship。当前没有配置自动部署或放置发布密钥。数据目录、环境文件和日志由 gaogame/.gitignore 排除。

先跑通手动部署与重启恢复，再连接 GitHub 自动部署；发布前备份私有数据，更新后核对两个玩家同步。不要把测试环境的会话复制给别人。

官方资料：[Spaceship Node.js](https://www.spaceship.com/knowledgebase/setup-nodejs-application-spaceship-hosting/)、[Passenger 进程池配置](https://www.phusionpassenger.com/docs/references/config_reference/apache/)。
