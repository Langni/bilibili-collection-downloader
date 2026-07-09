#!/usr/bin/env node
/**
 * bili_download.js — B站 UP 主合集批量下载
 * 按合集分类 + 序号_标题命名 + 增量下载 + cookie可选(分级:公开零配置/付费带cookie)
 *
 * 用法:
 *   node bili_download.js                       # 默认 UP主(或改 MID)
 *   node bili_download.js 508171633             # 指定 UID
 *   node bili_download.js "space.bilibili.com/508171633/lists"
 *
 * 依赖: yt-dlp.exe / ffmpeg.exe / ffprobe.exe 放脚本同目录
 * Cookie: 可选。有 cookies.txt 则带(下付费/高清); 无则匿名(公开可下)
 *         用 login.js 扫码生成 cookies.txt
 */
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// 智能查找 yt-dlp: 当前目录 → 脚本目录 → 上级目录 → PATH
function findBin(name) {
  const exe = process.platform === 'win32' ? name + '.exe' : name;
  const candidates = [
    path.join(process.cwd(), exe),
    path.join(__dirname, exe),
    path.join(__dirname, '..', exe),
  ];
  for (const c of candidates) { if (fs.existsSync(c)) return c; }
  return exe; // 兜底: 靠 PATH
}
const YTDLP = findBin('yt-dlp');
const FFMPEG_DIR = path.dirname(findBin('ffmpeg'));

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
const TAB = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,36,25,21,20,30,6,22,24,7,51,1,17,4,52,26,44,11,55,40,16,34,0,48,57,59,56,54,60,61,62,63];

// —— 参数解析: node bili_download.js <UID/URL> [--out <dir>] [--cookie <file>] ——
const argv = process.argv.slice(2);
function getFlag(name, def) {
  const i = argv.indexOf('--' + name);
  return (i >= 0 && argv[i + 1]) ? argv[i + 1] : def;
}
const positional = argv.find(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--out' && argv[argv.indexOf(a) - 1] !== '--cookie');

// —— TTY 双模态: 人在终端则可交互提问; agent/管道调用则用默认值 ——
const isTTY = process.stdin.isTTY && process.stdout.isTTY;
function ask(question, def) {
  if (!isTTY) return Promise.resolve(def);   // 非交互(skill/管道): 直接用默认
  return new Promise(resolve => {
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question + (def ? ' [' + def + ']' : '') + ': ', ans => {
      rl.close(); resolve(ans.trim() || def);
    });
  });
}

// Windows 文件名安全: 截断过长标题(路径总长度防超 260)
const MAX_TITLE = 80;

// —— 输入分诊: 提取 BV号(单视频) 或 UID(合集) ——
function parseInput(s) {
  s = String(s);
  const bv = s.match(/BV[0-9A-Za-z]{10}/);         // 单视频: BV号 或含 /video/BV 的URL
  if (bv) return { type: 'video', bvid: bv[0] };
  const uid = s.match(/(?:space\.bilibili\.com\/)?(\d{3,})/);  // 合集: UID 或 space URL
  if (uid) return { type: 'collection', mid: uid[1] };
  return { type: 'unknown', raw: s };
}

// —— 单个视频下载(合集/单视频复用) ——
function downloadOne(bvid, outPath, cookieFile, ffdir) {
  const args = ['-o', outPath, '--ffmpeg-location', ffdir,
    '--no-playlist', '--no-progress', '--retries', '3',
    'https://www.bilibili.com/video/' + bvid];
  if (cookieFile) args.unshift('--cookies', cookieFile);
  return spawnSync(YTDLP, args,
    { env: { ...process.env, PYTHONUTF8: '1' }, encoding: 'utf8', timeout: 300000 });
}

function get(url, cookie, referer) {
  return new Promise((resolve, reject) => {
    const h = { 'User-Agent': UA, 'Referer': referer || 'https://www.bilibili.com/' };
    if (cookie) h.Cookie = cookie;
    https.get(url, { headers: h }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}
function getMixinKey(o) { return TAB.slice(0, 32).map(i => o[i]).join(''); }
function wbiSign(p, ik, sk) {
  const mk = getMixinKey(ik + sk);
  const wts = Math.floor(Date.now() / 1000);
  const all = { ...p, wts };
  const q = Object.keys(all).sort().map(k => k + '=' + encodeURIComponent(all[k])).join('&');
  return q + '&w_rid=' + crypto.createHash('md5').update(q + mk).digest('hex');
}
function loadCookie(file) {
  try {
    return fs.readFileSync(file, 'utf8').split(/\r?\n/)
      .filter(l => l && !l.startsWith('#')).map(l => l.split('\t'))
      .filter(f => f.length >= 7 && /bilibili\.com/.test(f[0]))
      .map(f => f[5] + '=' + f[6]).join('; ');
  } catch (e) { return ''; }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// —— 增量: 已下 bvid 集合(DOWN_LOG 运行时确定) ——
function loadDownloaded(file) {
  try { return new Set(JSON.parse(fs.readFileSync(file, 'utf8'))); }
  catch (e) { return new Set(); }
}
function saveDownloaded(file, set) { fs.writeFileSync(file, JSON.stringify([...set], null, 2)); }

// —— 合集内视频(合集定义顺序) ——
async function getSeasonVideos(mid, sid, cookie, ik, sk) {
  let eps = [];
  const ref = 'https://space.bilibili.com/' + mid + '/lists';
  for (let pn = 1; pn <= 20; pn++) {
    const r = JSON.parse(await get('https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?'
      + wbiSign({ mid, season_id: sid, page_num: pn, page_size: 30 }, ik, sk), cookie, ref));
    const arcs = r.data.archives || [];
    eps = eps.concat(arcs.map(a => a.bvid));
    const total = r.data.page ? r.data.page.total : arcs.length;
    if (eps.length >= total || arcs.length === 0) break;
    await sleep(300);
  }
  return eps;
}

(async () => {
  // —— 1. 输入分诊: 单视频(BV号) or 合集(UID) ——
  let inputArg = positional;
  if (!inputArg) inputArg = await ask('请输入 UP主UID/主页链接,或单个视频 BV号/链接', '508171633');
  const parsed = parseInput(inputArg);
  if (parsed.type === 'unknown') {
    console.log('❌ 无法识别输入: ' + parsed.raw + '  (需 UID / space链接 / BV号 / 视频链接)');
    process.exit(1);
  }

  // —— 2. cookie(单视频公开可匿名,付费/合集需登录) ——
  let cookieFile = getFlag('cookie', process.env.BILI_COOKIE || 'cookies.txt');
  const hasCookieFile = fs.existsSync(cookieFile);
  if (!hasCookieFile && parsed.type === 'collection') {
    console.log('⚠️  未找到 cookie(' + cookieFile + ')。合集下载需登录(arc/search 匿名返 -352 风控)。');
    console.log(isTTY ? '   请运行: node login.js  然后重跑' : '   skill 场景: 请先调用 login.js 扫码生成 cookies.txt');
    process.exit(1);
  }
  const cookie = hasCookieFile ? loadCookie(cookieFile) : '';
  const usedCookieFile = hasCookieFile ? cookieFile : null;

  // —— 3. cookie 预检(有 cookie 就验,顺便拿 wbi key) ——
  const nav = JSON.parse(await get('https://api.bilibili.com/x/web-interface/nav', cookie));
  if (hasCookieFile && !nav.data.isLogin) {
    console.log('❌ cookie 已过期/无效(未登录)。请重新扫码: node login.js');
    process.exit(1);
  }
  if (hasCookieFile) console.log('✅ 已登录: ' + nav.data.uname + (nav.data.vipStatus === 1 ? ' (大会员)' : ''));
  else console.log('ℹ️  无 cookie,匿名模式(单个公开视频可下;付费视频只返预览)');

  // —— 4. 输出目录 ——
  let outDir = getFlag('out', null);
  if (!outDir) outDir = await ask('下载到哪个目录', 'bili_downloads');
  const ROOT = outDir;
  fs.mkdirSync(ROOT, { recursive: true });

  // —— 分支A: 单视频下载(直接落根目录,纯标题命名) ——
  if (parsed.type === 'video') {
    console.log('单视频模式: ' + parsed.bvid + ' | 输出: ' + path.resolve(ROOT));
    const r = downloadOne(parsed.bvid, path.join(ROOT, '%(title).' + MAX_TITLE + 's.%(ext)s'), usedCookieFile, FFMPEG_DIR);
    if (r.status === 0) console.log('✅ 下载完成');
    else { console.log('❌ 下载失败: ' + (r.stderr || '').slice(-120)); process.exit(1); }
    return;
  }

  // —— 分支B: 合集下载 ——
  const MID = parsed.mid;
  const DOWN_LOG = path.join(ROOT, 'downloaded.json');
  console.log('合集模式 | UP主 MID: ' + MID + ' | 输出目录: ' + path.resolve(ROOT));

  const ik = nav.data.wbi_img.img_url.split('/').pop().split('.')[0];
  const sk = nav.data.wbi_img.sub_url.split('/').pop().split('.')[0];
  const ref = 'https://space.bilibili.com/' + MID + '/lists';

  console.log('[1/3] 拉取合集结构...');
  let all = [];
  for (let pn = 1; pn <= 10; pn++) {
    const r = JSON.parse(await get('https://api.bilibili.com/x/space/wbi/arc/search?'
      + wbiSign({ mid: MID, ps: 30, pn, order: 'pubdate' }, ik, sk), cookie, ref));
    if (r.code !== 0 || !r.data || !r.data.list) { console.log('❌ arc/search 返回异常 code=' + r.code + ' ' + (r.message||'')); process.exit(1); }
    const vl = r.data.list.vlist; if (!vl || !vl.length) break;
    all = all.concat(vl.map(v => v.bvid));
    if (all.length >= r.data.page.count) break;
    await sleep(300);
  }
  const seasons = new Map();
  for (const bvid of all) {
    try {
      const j = JSON.parse(await get('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid, cookie, ref));
      const s = j.data.ugc_season;
      if (s && !seasons.has(s.id)) seasons.set(s.id, s.title);
    } catch (e) {}
    await sleep(280);
  }
  fs.writeFileSync(path.join(ROOT, '结构.json'), JSON.stringify([...seasons.entries()].map(([id, t]) => ({ id, title: t })), null, 2));
  console.log('  合集数:' + seasons.size);

  // 预扫描: 统计总视频数(为总进度)
  const seasonEps = new Map();
  let grandTotal = 0;
  for (const [sid] of seasons) {
    const eps = await getSeasonVideos(MID, sid, cookie, ik, sk);
    seasonEps.set(sid, eps); grandTotal += eps.length;
  }

  console.log('[2/3] 增量下载(序号_标题,共 ' + grandTotal + ' 个,已下自动跳过)...');
  const downloaded = loadDownloaded(DOWN_LOG);
  const failed = [];
  let newCount = 0, skipCount = 0, done = 0;
  for (const [sid, title] of seasons) {
    const eps = seasonEps.get(sid);
    const dir = path.join(ROOT, title);
    fs.mkdirSync(dir, { recursive: true });
    console.log('## [' + title + '] ' + eps.length + '集');
    for (let i = 0; i < eps.length; i++) {
      const bvid = eps[i]; done++;
      const seq = String(i + 1).padStart(2, '0');
      if (downloaded.has(bvid)) { skipCount++; continue; }
      // 标题截断防 Windows 260 路径超限
      const nameTpl = seq + '_%(title).' + MAX_TITLE + 's.%(ext)s';
      const r = downloadOne(bvid, path.join(dir, nameTpl), usedCookieFile, FFMPEG_DIR);
      if (r.status === 0) {
        downloaded.add(bvid); saveDownloaded(DOWN_LOG, downloaded);
        newCount++; console.log('  [' + done + '/' + grandTotal + '] 新下 ' + seq + ' ' + bvid);
      } else {
        failed.push({ bvid, seq, title, err: (r.stderr || '').slice(-80) });
        console.log('  [' + done + '/' + grandTotal + '] FAIL ' + seq + ' ' + bvid);
      }
      await sleep(1500);
    }
  }
  // 失败持久化(可 --retry 只补失败)
  if (failed.length) fs.writeFileSync(path.join(ROOT, 'failed.json'), JSON.stringify(failed, null, 2));
  else { try { fs.unlinkSync(path.join(ROOT, 'failed.json')); } catch (e) {} }

  console.log('[3/3] 完成: 新下' + newCount + ' 跳过' + skipCount + ' 失败' + failed.length + ' (累计已下' + downloaded.size + '/' + grandTotal + ')');
  if (failed.length) console.log('失败明细: ' + path.join(ROOT, 'failed.json') + ' —— 重跑本命令自动只补失败的');
})();
