# bili_downloader 纯 skill 化 — 需求决策

> 状态:brainstorming 进行中(2026-07-09)
> 冻结的决策不要推翻,待定项讨论后补。

## 背景 / 根因

当前项目是「npm 项目 + Claude skill」混合体。安装脚本(`install.ps1` / `install.sh`)把
`SKILL.md` + `bili_download.js` + `login.js` + `package.json` **复制一份**到
`~/.claude/skills/bili-download/`。

**根因(为什么违和)**:
1. Claude skill 本质是「一个含 SKILL.md 的目录」,项目根目录本身已是合规 skill,却用「挑几个文件复制」的方式安装 → 产生脱离源仓库的副本。
2. 复制式安装 = 双份维护:源仓库改了,skills 目录副本不自动更新,要重跑 install。
3. 依赖二进制(yt-dlp/ffmpeg)没被复制,skill 目录实际缺依赖,靠 PATH 兜底。

## 已冻结决策

- **Q1 项目定位 = 纯 skill,主要给 agent 用**(2026-07-09 确认)
  - 整个仓库就是一个 skill 目录,人类也照 SKILL 说明用。
  - 安装 = clone/软链到 `~/.claude/skills/`,不再复制副本。
  - 仍可开源,但定位是「一个能被 agent 调用的技能」。
- **Q3 依赖二进制(yt-dlp/ffmpeg/ffprobe)交付方式 = 国内镜像 install 脚本(方案B)**(2026-07-10 确认)
  - 二进制**不进 git 仓库**(.gitignore 已排除),保持仓库轻量 + 跨平台。
  - `install.ps1`/`install.sh` 内置**国内镜像 + 多源 fallback**:逐个尝试,首个成功即用,末位回退官方源。
  - 否决理由(方案A 塞 git):① 合计 ~212MB 违反 git 内容寻址本质,每次升级永久焊进历史;② Windows .exe 跨平台死结(违背强可移植);③ yt-dlp 更新频繁需独立可更新。
  - 方案C(GitHub Release 附 prebuilt)作为开源门面**辅助**,不替代 B(国内访问 release 仍慢)。
- **Q6 敏感词中性化 = 已完成**(2026-07-10)
  - 删除所有「爬虫/反爬/风控/anti-scraping/破三关」对抗性表述,改中性叙事(登录态/访问要求/接口规范)。
  - 清理 6 处:SKILL.md×2 / README.md×3 / bili_download.js×1。
  - 原则:把"破解 B站反爬"叙事 → "登录后合规访问已授权内容"叙事,避免开源后被定性为对抗工具/触发平台投诉。
- **Q4 package.json 精简 = 已完成**(2026-07-10)
  - 保留开源元数据(name/version/description/keywords/repository/license/engines)。
  - 删 `bin`(全局命令需 `npm i -g`,纯 skill 走软链不用)、删 `main`(非 require 库)。
  - scripts 只留 `check`(语法自检),删 login/download/start(直接 `node scripts/xxx.js`)。
- **Q5 js 收 scripts/ 子目录 = 已完成**(2026-07-10)
  - `bili_download.js` + `login.js` → `scripts/`,根目录只留入口+文档+安装脚本(符合 skill 惯例)。
  - 执行入口统一 `node scripts/bili_download.js` / `node scripts/login.js`,SKILL/README/install 全同步。
  - 关键:`findBin` 的 `__dirname/..` 兜底(`scripts/bili_download.js:27`)让二进制查找不受 js 位置影响 —— 端到端实测移动后下载仍通。
  - install.sh 顺带从"复制副本"升级为软链(对齐 Q1 + install.ps1);其国内镜像增强(Q3 sh 版)待补。
- **Q2 分发机制 = 个人 skill(clone/软链),暂不做 plugin**(2026-07-10 确认)
  - 开源后用户 `git clone` + 软链/clone 到 `~/.claude/skills/bili-download/` 即用(install 脚本自动软链)。
  - 暂不接入 Claude Code plugin marketplace(版本化/marketplace.json 等开销暂不需要)。
  - 可逆:未来若要正式分发,再按 plugin 规范打包,不影响现有结构。

## 待定项

(无 —— Q1~Q6 已全部冻结,2026-07-10)

## 约束(来自用户长期偏好)

- 要开源到 GitHub。
- 强可移植性。
- 工程化(如支持通过 skill 设置定时增量任务)。
- 用户在用 `~/.claude` 作为配置同步仓库(claude_conf),skill 可能随之同步。

## 第 6 点清理记录(2026-07-10 已全部完成 ✅,grep 复验代码文档无残留)

| 位置 | 旧表述(对抗叙事) | 新表述(中性叙事) |
|---|---|---|
| `bili_download.js:145` | 匿名返 -352 风控 | 接口对匿名请求返回 -352 |
| `README.md:107` | 反爬破三关 | 三项访问要求 |
| `README.md:112` | -352 风控 | -352(需登录) |
| `README.md:162` | Beats three anti-scraping layers | Handles three access requirements |
| `SKILL.md:30` | arc/search 接口对匿名返风控 | 合集内容需登录访问 |
| `SKILL.md:65` | -352 风控 | -352(需登录) |
