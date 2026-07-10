# 📺 bili-download

> 一个 **Claude skill**:把 B站创作者的内容 —— 单视频或整合集 —— 完整、有序地归档到本地:按合集分目录、序号命名、增量更新。扫码登录后,已充电/已购的系列也能离线留存。
> A **Claude skill** that archives Bilibili creators' content — a single video or whole collections — locally, organized by season with ordered naming and incremental sync.

**[中文](#中文) · [English](#english)**

> ⚠️ **安全 / Security**:`cookies.txt` 含你的 B站登录态,已在 `.gitignore` 排除,**切勿提交到公开仓库**。
> `cookies.txt` holds your Bilibili session — gitignored; **never commit it**.

---

<a name="中文"></a>
## 中文

### 这是什么

一个能被 AI agent 调用、也能人手跑的 B站归档**技能**。装好后对 Claude 说"下载某 UP 主的合集"即可;也支持纯命令行(适合定时增量)。SKILL.md 遵循 [Agent Skills 开放标准](https://agentskills.io),Cursor / Codex / Windsurf 等 agent 也支持。

### 📌 适用场景

趁内容还在,留一份在本地:

- 🗑️ **防删除 / 防下架备份** —— UP 主删稿、视频下架前抢救
- 🚪 **停更 / 注销前存档** —— 喜欢的博主跑路就找不回了
- ✈️ **离线观看** —— 通勤、断网、省流量
- 📚 **系列课程 / 知识合集本地化** —— 反复学习、做笔记
- 🔋 **充电 / 已购系列离线留存** —— 不受在线时长限制,慢慢看
- ✂️ **二创 / 剪辑素材** —— 原片留存备用
- ⭐ **收藏夹 / 追更系列归档** —— 怕失效、想集齐

> 请在遵守 B站用户协议、仅用于个人已获授权内容(如自己充电支持、已购系列)的前提下使用。

### 🚀 安装

**方式 A — 作为 Claude skill(推荐)**

```bash
git clone https://github.com/Langni/bilibili-collection-downloader ~/.claude/skills/bili-download
cd ~/.claude/skills/bili-download
powershell -ExecutionPolicy Bypass -File install.ps1   # Windows
# bash install.sh                                      # Mac/Linux/Git Bash
```

install 脚本自动:装 yt-dlp/ffmpeg(国内镜像多源 fallback)+ 把目录注册为 skill。重启 Claude Code 后即可自动触发。

**方式 B — 纯命令行(任何环境,不当 skill)**

```bash
git clone https://github.com/Langni/bilibili-collection-downloader
cd bilibili-collection-downloader
bash install.sh                 # Mac/Linux;Windows 用 install.ps1。只装依赖
node scripts/bili_download.js <UID 或 BV号 或 链接>
```

### 🤖 用法

**A. 在 Claude Code 里自动触发(推荐)**

装好 skill 后直接对话,Claude 会读 SKILL.md 自动调脚本:

- "下载 https://space.bilibili.com/508171633 的全部合集"
- "归档这个视频 https://www.bilibili.com/video/BV1U691YDEHz"
- "把 XX 的充电系列离线留存"

也可显式调用:`/bili-download`。

**B. 命令行直接跑(定时任务 / 脚本编排 / CI)**

```bash
# 首次:扫码登录(合集/付费视频必需;单个公开视频可跳过)
node scripts/login.js
# → 弹二维码 → 手机 B站 App 扫 → 生成 cookies.txt

# 下载(输入自动识别:UID/主页链接 → 合集;BV号/视频链接 → 单视频)
node scripts/bili_download.js 508171633
node scripts/bili_download.js BV1U691YDEHz
node scripts/bili_download.js "https://space.bilibili.com/508171633/lists"
```

参数:`--out <目录>`(默认 `bili_downloads`)、`--cookie <文件>`(默认 `cookies.txt`)。

配合 cron / 计划任务定期跑,自动增量补 UP 主新发的视频。

### 🌐 跨 agent

SKILL.md 是 [开放标准](https://agentskills.io),以下 agent 也支持(各自扫描自己的 skills 目录):

| Agent | skills 目录 |
|---|---|
| Claude Code | `~/.claude/skills/` |
| Cursor | `~/.cursor/skills/`(兼容扫 `.claude/skills/`) |
| Codex / Windsurf / Gemini CLI / Cline | `~/.<tool>/skills/` 或 `.<tool>/skills/` |

非 Claude Code 用户:把仓库 clone/拷到对应目录即可。**方式 B(命令行)与 agent 无关,任何环境通用**。

### ✨ 为什么用它(vs 裸 yt-dlp)

yt-dlp 是强通用下载器,但下完一堆扁平文件。本技能专注**把创作者内容整整齐齐归档**,并作为 agent 技能一键调用。

| | 裸 yt-dlp | **bili-download** |
|---|---|---|
| 单视频 | ✅ | ✅ 自动识别 |
| 按合集分目录 | ❌ 扁平 | ✅ |
| 序号命名(合集顺序) | ❌ | ✅ `01_标题.mp4` |
| 扫码登录(免装扩展) | ❌ | ✅ 手机扫一下 |
| 已授权内容完整留存 | ⚠️ 要会配 | ✅ 扫码后自动 |
| 增量更新(只下新的) | ⚠️ | ✅ |
| Claude/agent 一键调用 | ❌ | ✅ |

### 📁 产物结构

```
bili_downloads/
├── 合集名/                # 合集 → 一个目录
│   ├── 01_标题.mp4
│   └── 02_标题.mp4
├── 单个视频标题.mp4        # 单视频 → 直接落根目录
├── 结构.json              # 合集元数据
└── downloaded.json        # 增量记录(已下 bvid)
```

### 🔧 工作原理

```
scripts/bili_download.js  (Node 编排)
  ├─ 输入分诊: BV号 → 单视频 / UID → 合集
  ├─ HTTP → B站 API(wbi 签名 + 登录态): 合集结构 + 合集内顺序
  └─ spawn → yt-dlp   解析流 + 下载
              └─ spawn → ffmpeg   合并音视频(DASH)
```

三项访问要求:① wbi 签名 ② 登录态(`scripts/login.js` 扫码) ③ 付费权限(账号已购)。

### 🕳️ 常见问题

- **付费视频只下到 3 分钟预览** → 扫码登录 `node scripts/login.js`(需账号已购)
- **合集下载报 -352**(需登录) → 缺 cookie,跑 `scripts/login.js`(单视频不受此限)
- **中文文件名"乱码"** → 仅控制台**显示**乱码,文件系统**实际正确**
- **10054 连接重置** → 重跑(增量自动补失败的)

### 📦 依赖

Node.js 18+ · `yt-dlp` · `ffmpeg` / `ffprobe`(install 脚本自动装)

---

<a name="english"></a>
## English

### What is this

A Bilibili archiving **skill** — callable by AI agents, also runnable by hand. After install, just tell Claude "download this creator's collections"; a plain CLI is also available (good for scheduled incremental sync). SKILL.md follows the [open Agent Skills standard](https://agentskills.io), so Cursor / Codex / Windsurf support it too.

### 🚀 Install

**Option A — as a Claude skill (recommended)**

```bash
git clone https://github.com/Langni/bilibili-collection-downloader ~/.claude/skills/bili-download
cd ~/.claude/skills/bili-download
powershell -ExecutionPolicy Bypass -File install.ps1   # Windows
# bash install.sh                                      # Mac/Linux
```

The installer fetches yt-dlp/ffmpeg (CN mirrors w/ fallback) and registers the skill. Restart Claude Code and it auto-triggers.

**Option B — plain CLI (any environment, no skill)**

```bash
git clone https://github.com/Langni/bilibili-collection-downloader
cd bilibili-collection-downloader
bash install.sh                 # deps only
node scripts/bili_download.js <UID | BV id | URL>
```

### 🤖 Usage

**A. Auto-trigger in Claude Code (recommended)**

Just talk to Claude — it reads SKILL.md and runs the script:

- "Download all collections of https://space.bilibili.com/508171633"
- "Archive this video https://www.bilibili.com/video/BV1U691YDEHz"

Or explicitly: `/bili-download`.

**B. Plain CLI (cron / scripting / CI)**

```bash
node scripts/login.js                 # first time: QR scan → cookies.txt
node scripts/bili_download.js 508171633                              # collections
node scripts/bili_download.js BV1U691YDEHz                           # single video
```

Auto input detection: UID / space URL → collections; BV id / video URL → single.
Flags: `--out <dir>` (default `bili_downloads`), `--cookie <file>` (default `cookies.txt`).

### 🌐 Cross-agent

SKILL.md is an [open standard](https://agentskills.io); these agents support it (each scans its own skills dir): Claude Code (`~/.claude/skills/`), Cursor (`~/.cursor/skills/`, also scans `.claude/skills/`), Codex / Windsurf / Gemini CLI / Cline. Non-Claude users: clone into the matching dir. **Option B is agent-agnostic.**

### 🔧 How it works

Node script orchestrates: input triage → Bilibili API (wbi-signed + login session) → spawns `yt-dlp` (download) → `ffmpeg` (merge DASH). Three access requirements: wbi signature, login session, paid-content permission.

### 📦 Requirements

Node.js 18+ · `yt-dlp` · `ffmpeg` / `ffprobe` (installer fetches them)

---

## 📁 目录结构 / Layout

```
bilibili-collection-downloader/   (= skill 目录 bili-download)
├── SKILL.md            # skill 入口 / skill descriptor
├── README.md           # 本文档 / this doc
├── package.json
├── install.ps1 / .sh   # 装依赖 + 注册 skill / installer
├── scripts/
│   ├── bili_download.js # 主脚本(单视频+合集) / main
│   └── login.js        # 扫码登录 / QR login
├── cookies.txt.example # cookie 格式示例 / sample
└── .gitignore
```

## License

MIT © 大龙虾
