# 📺 bilibili-collection-downloader

> 把你**支持、关注的 B站创作者内容**完整、有序地留在本地 —— 单视频或整合集,按合集分类、扫码登录、增量更新,可作为 **Claude / AI agent 技能**一键调用。
> Archive the Bilibili creators you follow — a single video or whole collections — organized by season, with QR login, incremental sync, and one-click **Claude skill** integration.

**[中文](#中文) · [English](#english)**

<!-- 首图:录一段 login 扫码 + 下载的 GIF(转化率核心)。命令: node scripts/login.js && node scripts/bili_download.js <UID> -->
<!-- ![demo](docs/demo.gif) -->
_（演示 GIF 待补 / demo GIF coming soon）_

> ⚠️ **安全提示 / Security**:`cookies.txt` 由扫码登录生成,**含你的 B站账号登录态**。已在 `.gitignore` 排除,**切勿提交到公开仓库**。
> `cookies.txt` contains your Bilibili login session — it is gitignored; **never commit it**.

---

<a name="中文"></a>
## 中文

### 📌 适用场景

把喜欢的 B站内容,趁还在的时候留一份:

- 🗑️ **防删除 / 防和谐备份** —— UP 主删稿、视频下架前抢救留存
- 🚪 **停更 / 注销前存档** —— 喜欢的博主跑路,内容就找不回了
- ✈️ **离线观看** —— 通勤、断网、省流量,提前存好慢慢看
- 📚 **系列课程 / 知识合集本地化** —— 反复学习、做笔记、建资料库
- 🔋 **充电支持的系列离线留存** —— 已充电支持的内容,离线也能慢慢看,不受在线时长限制
- ✂️ **二创 / 剪辑素材** —— 原片、弹幕留存备用
- ⭐ **收藏夹 / 追更系列归档** —— 收藏怕失效,追的系列想集齐

> 请在遵守 B站用户协议、仅用于个人已获授权内容(如自己充电支持、已购的系列)的前提下使用。

### ✨ 为什么用它(而不是 yt-dlp)

yt-dlp 是通用下载器(强,但下完一堆扁平文件)。本工具专注:**把创作者的内容整整齐齐归档**,并能作为 AI agent 的技能。

| | yt-dlp | **本工具** |
|---|---|---|
| 单视频下载 | ✅ | ✅ 自动识别 |
| 按合集分类目录 | ❌ 扁平 | ✅ 每合集一目录 |
| 序号命名(合集顺序) | ❌ | ✅ `01_标题.mp4` |
| 扫码登录(免装扩展) | ❌ | ✅ 手机扫一下 |
| 已授权内容完整留存 | ⚠️ 要会配 | ✅ 扫码后自动 |
| 高画质(大会员1080P+/4K) | ⚠️ 要会配 | ✅ cookie 为大会员即可* |
| 增量更新(只下新的) | ⚠️ | ✅ |
| Claude skill 一键调用 | ❌ | ✅ |

<sub>*高画质前提:cookie 对应账号为大会员,且原视频本身支持该清晰度。</sub>

### 🚀 快速开始

```bash
# 1. 装依赖 + 注册 Claude skill
powershell -ExecutionPolicy Bypass -File install.ps1    # Windows
bash install.sh                                         # Mac/Linux/Git Bash

# 2. 扫码登录(下合集/付费视频需要;下单个公开视频可跳过)
node scripts/login.js
# → 弹二维码 → 手机 B站 App 扫一下 → 自动生成 cookies.txt

# 3a. 下载整个 UP 主的合集(自动识别 UID)
node scripts/bili_download.js 508171633
node scripts/bili_download.js "https://space.bilibili.com/508171633/lists"

# 3b. 下载单个视频(自动识别 BV号)
node scripts/bili_download.js BV1U691YDEHz
node scripts/bili_download.js "https://www.bilibili.com/video/BV1U691YDEHz"
```

**输入自动识别**:给 UID / 主页链接 → 下合集;给 BV号 / 视频链接 → 下单个。无需选模式。

**参数**:
- `--out <目录>`:下载目录(默认 `bili_downloads`)
- `--cookie <文件>`:cookie 文件(默认 `cookies.txt`)

### 📁 产物结构

```
bili_downloads/
├── 认知跃迁/              # 合集 → 一个目录
│   ├── 01_遇到问题为什么有人能抓住本质.mp4
│   └── 02_如何提升抽象能力.mp4
├── 单个视频标题.mp4        # 单视频 → 直接落根目录
├── 结构.json             # 合集元数据
└── downloaded.json       # 增量记录
```

### 🤖 作为 Claude skill 用

跑过 `install.ps1` 后,skill 注册到 `~/.claude/skills/bili-download/`。在 Claude Code 里直接说:

> "下载 space.bilibili.com/508171633 的合集" / "下载这个视频 BV1U691YDEHz"

Claude 自动调脚本。也可配合定时任务定期增量归档关注的博主。

### 🔧 工作原理

```
scripts/bili_download.js  (Node 编排)
  ├─ 输入分诊: BV号→单视频 / UID→合集
  ├─ HTTP → B站API  (wbi签名+cookie): 合集结构 + 合集内顺序
  └─ spawn → yt-dlp.exe   解析流+下载
              └─ spawn → ffmpeg.exe   合并音视频(DASH)
```

**三项访问要求**:① wbi 签名(Node `crypto` MD5) ② 登录态(`scripts/login.js` 扫码拿 SESSDATA+buvid3) ③ 付费权限(登录账号已购即得完整流)。

### 🕳️ 常见问题

- **付费视频只下到 3 分钟预览** → 扫码登录 `node scripts/login.js`(需账号已购)
- **合集下载报 -352**(需登录) → 缺 cookie,跑 `scripts/login.js`(单视频不受此限)
- **中文文件名"乱码"** → 只是控制台**显示**乱码,文件系统**实际正确**
- **10054 连接重置** → 重跑(增量自动补失败的)

### 📦 依赖

Node.js 18+ · `yt-dlp` / `ffmpeg` / `ffprobe`(install 脚本自动装 yt-dlp;ffmpeg 需手动放同目录)

---

<a name="english"></a>
## English

### ✨ Why (vs yt-dlp)

yt-dlp is a powerful general downloader, but leaves you a flat pile of files. This tool focuses on **archiving a creator's collections neatly**, and works as an AI-agent skill.

| | yt-dlp | **this** |
|---|---|---|
| Single video | ✅ | ✅ auto-detect |
| Group by collection | ❌ flat | ✅ one dir per season |
| Ordered naming | ❌ | ✅ `01_title.mp4` |
| QR login (no extension) | ❌ | ✅ scan with phone |
| Paid video full download | ⚠️ manual | ✅ via QR login |
| Incremental sync | ⚠️ | ✅ |
| Claude skill | ❌ | ✅ |

### 🚀 Quick start

```bash
# 1. Install deps + register Claude skill
powershell -ExecutionPolicy Bypass -File install.ps1    # Windows
bash install.sh                                         # Mac/Linux

# 2. QR login (needed for collections / paid videos; skippable for single public video)
node scripts/login.js      # scan the QR with the Bilibili mobile app → cookies.txt

# 3a. Download a creator's collections (UID auto-detected)
node scripts/bili_download.js 508171633

# 3b. Download a single video (BV id auto-detected)
node scripts/bili_download.js BV1U691YDEHz
```

**Auto input detection**: UID / space URL → collections; BV id / video URL → single video.

**Flags**: `--out <dir>` (default `bili_downloads`), `--cookie <file>` (default `cookies.txt`).

### 🔧 How it works

Node script orchestrates: input triage → Bilibili API (wbi-signed + cookie) for collection structure → spawns `yt-dlp` (stream + download) → `ffmpeg` (merge DASH). Handles three access requirements: wbi signature, login session (SESSDATA+buvid3 via QR login), paid-content permission.

### 📦 Requirements

Node.js 18+ · `yt-dlp` / `ffmpeg` / `ffprobe` (install script fetches yt-dlp; place ffmpeg alongside).

---

## 📁 目录结构 / Layout

```
bilibili-collection-downloader/
├── README.md           # 本文档 / this doc
├── LICENSE             # MIT
├── package.json
├── SKILL.md            # Claude skill 描述 / skill descriptor
├── install.ps1 / .sh   # 一键安装 / installer
├── scripts/
│   ├── login.js        # 扫码登录 / QR login → cookies.txt
│   └── bili_download.js # 主脚本(单视频+合集) / main (single + collection)
├── cookies.txt.example # cookie 格式示例 / sample format
└── .gitignore
```

## License

MIT © 大龙虾
