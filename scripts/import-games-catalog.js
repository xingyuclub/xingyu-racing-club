import 'dotenv/config';
import { createHash } from 'node:crypto';
import * as fileSystem from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { createCosStorageFromEnv } from '../server/lib/cosStorage.js';
import { createConfigStore } from '../server/lib/configStore.js';
import { createPublicConfigPublisher } from '../server/lib/publicConfigPublisher.js';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(rootDir, 'server', 'data');
const outputDir = join(rootDir, 'output');
const gamesModulePath = join(rootDir, 'src', 'data', 'games.js');
const ICON_SIZE = 256;
const ICON_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const applyChanges = process.argv.includes('--apply') || process.argv.includes('--publish');
const publishChanges = process.argv.includes('--publish');

export const GAME_CATEGORIES = [
  { key: 'racing', label: '竞速' },
  { key: 'level', label: '闯关' },
  { key: 'action', label: '动作' },
  { key: 'puzzle', label: '益智' },
  { key: 'casual', label: '休闲' },
  { key: 'sim', label: '经营' },
  { key: 'sports', label: '体育对战' },
];

// [id, 显示名, 分类]，id 与 Poki slug 一致
const POKI_GAMES = [
  ['hill-climb-racing-lite', '登山赛车', 'racing'],
  ['moto-x3m', 'Moto X3M', 'racing'],
  ['drift-boss', '漂移老板', 'racing'],
  ['drive-mad', '疯狂驾驶', 'racing'],
  ['mad-cars-racing-and-crash', '疯狂赛车', 'racing'],
  ['mr-racer-car-racing', 'MR RACER 赛车', 'racing'],
  ['real-cars-in-city', '城市真车', 'racing'],
  ['tuning-car-racing', '改装赛车', 'racing'],
  ['top-speed-3d', '极速 3D', 'racing'],
  ['red-ball-4', 'Red Ball 4', 'level'],
  ['level-devil', '恶魔关卡', 'level'],
  ['run-3', 'Run 3', 'level'],
  ['blockpost', 'Blockpost 方块战场', 'action'],
  ['war-master', '战争大师', 'action'],
  ['lethal-sniper-3d-army-soldier', '致命狙击 3D', 'action'],
  ['sword-road', '剑之路', 'action'],
  ['gladihoppers', '角斗士跳跳', 'action'],
  ['stickman-battle', '火柴人大战', 'action'],
  ['stickman-fury', '火柴人狂怒', 'action'],
  ['mr-bullet', '子弹先生', 'action'],
  ['tank-stars', '坦克之星', 'action'],
  ['2048', '2048', 'puzzle'],
  ['blocky-blast-puzzle', '方块消除', 'puzzle'],
  ['tear-blocks-down', '拆方块', 'puzzle'],
  ['marble-run-3d', '3D 弹珠', 'puzzle'],
  ['find-the-nibbys', '找找 Nibbys', 'puzzle'],
  ['count-control-legends', '数字控制传奇', 'puzzle'],
  ['tower-merge', '合成塔', 'puzzle'],
  ['subway-surfers-blast', '地铁跑酷 Blast', 'casual'],
  ['temple-run-2', '神庙逃亡 2', 'casual'],
  ['stickman-hook', '火柴人钩爪', 'casual'],
  ['monkey-mart', '猴子超市', 'casual'],
  ['fruit-ninja', '水果忍者', 'casual'],
  ['tunnel-rush', '隧道冲刺', 'casual'],
  ['blumgi-slime', '史莱姆弹跳', 'casual'],
  ['hole-io', '黑洞大作战', 'casual'],
  ['kick-the-buddy', '解压玩偶', 'casual'],
  ['slime-laboratory', '史莱姆实验室', 'casual'],
  ['cat-pizza', '猫咪披萨店', 'sim'],
  ['my-perfect-hotel', '我的完美酒店', 'sim'],
  ['robo-cleaner-simulator', '清洁机器人', 'sim'],
  ['idle-mining-empire', '放置矿业帝国', 'sim'],
  ['build-your-island', '建岛', 'sim'],
  ['dino-simulator', '恐龙模拟器', 'sim'],
  ['basketball-stars', '篮球明星', 'sports'],
  ['basketball-real', '真实篮球', 'sports'],
  ['retro-bowl', '复古橄榄球', 'sports'],
  ['pool-club', '台球俱乐部', 'sports'],
  ['penalty-shooters-2', '点球大战 2', 'sports'],
  ['power-badminton', '羽毛球', 'sports'],
  ['karate-fighter', '空手道格斗', 'sports'],
  ['smash-karts', '卡丁车大乱斗', 'sports'],
];

// 保留线上已有条目：名称/链接沿用现有配置，图标复用 COS 上已有的文件
const RETAINED_GAMES = [
  { id: 'tiny-fishing', category: 'casual' },
  { id: 'fishing-world', category: 'casual' },
  { id: 'game-of-farmers', category: 'sim' },
  { id: 'zhuadae', category: 'puzzle' },
];

// 这几款 Poki 游戏线上已有条目但 id 变了，图标按旧 id 复用，不重复上传
const REUSE_ICON_FROM = {
  'hill-climb-racing-lite': 'hill-climb-racing',
};

// 关卡/生涯进度会被浏览器保存的游戏，前台打「存档」角标
const SAVED_GAME_IDS = new Set(['moto-x3m', 'level-devil', 'red-ball-4', 'run-3', 'retro-bowl']);

function iconKey(id, bytes) {
  const digest = createHash('sha256')
    .update(bytes)
    .digest('hex')
    .slice(0, 16);
  return `games/icons/${digest}-${id}.webp`;
}

async function fetchText(url) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return response.text();
}

async function fetchBuffer(url) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function resolveOgImage(slug) {
  const html = await fetchText(`https://poki.com/zh/g/${slug}`);
  const matched = /og:image"\s+content="([^"]+)"/.exec(html);
  if (!matched) throw new Error(`no og:image for ${slug}`);
  return matched[1];
}

async function uploadIcon(storage, id, ogImage) {
  const source = await fetchBuffer(ogImage);
  const resized = await sharp(source)
    .resize(ICON_SIZE, ICON_SIZE, { fit: 'cover' })
    .webp({ quality: 80, alphaQuality: 90 })
    .toBuffer();
  const key = iconKey(id, resized);
  await storage.putObject({
    key,
    body: resized,
    contentType: 'image/webp',
    cacheControl: ICON_CACHE_CONTROL,
  });
  return { url: storage.publicUrl(key), bytes: resized.length, key };
}

function renderGamesModule(games) {
  const lines = [];
  lines.push('// Generated by scripts/import-games-catalog.js. Re-run that script instead of editing the catalog by hand.');
  lines.push('');
  lines.push('export const GAME_CATEGORIES = [');
  for (const category of GAME_CATEGORIES) {
    lines.push(`  { key: '${category.key}', label: '${category.label}' },`);
  }
  lines.push('];');
  lines.push('');
  lines.push('export const DEFAULT_GAMES = [');
  for (const game of games) {
    lines.push('  {');
    lines.push(`    id: '${game.id}',`);
    lines.push(`    name: '${game.name}',`);
  lines.push(`    category: '${game.category}',`);
  lines.push(`    hasSave: ${game.hasSave},`);
  lines.push(`    url: '${game.url}',`);
    lines.push(`    iconSrc: '${game.iconSrc}',`);
    lines.push(`    enabled: ${game.enabled},`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');
  lines.push('const CATEGORY_KEYS = new Set(GAME_CATEGORIES.map((category) => category.key));');
  lines.push('');
  lines.push('export function isGameCategory(value) {');
  lines.push("  return typeof value === 'string' && CATEGORY_KEYS.has(value);");
  lines.push('}');
  lines.push('');
  lines.push('export function isGameUrl(value) {');
  lines.push("  if (typeof value !== 'string' || !value.trim()) return false;");
  lines.push('  try {');
  lines.push('    const url = new URL(value);');
  lines.push("    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;");
  lines.push('  } catch {');
  lines.push('    return false;');
  lines.push('  }');
  lines.push('}');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const storage = createCosStorageFromEnv(process.env, { required: true });
  const store = await createConfigStore({ dataDir });
  const current = await store.read();
  const existingById = new Map((current.games ?? []).map((game) => [game.id, game]));

  const uploaded = [];
  const reused = [];
  const catalog = [];

  for (const [slug, name, category] of POKI_GAMES) {
    const reuseId = REUSE_ICON_FROM[slug];
    const reusedGame = existingById.get(slug) ?? (reuseId ? existingById.get(reuseId) : null);
    let iconSrc;
    if (reusedGame?.iconSrc) {
      iconSrc = reusedGame.iconSrc;
      reused.push(slug);
    } else {
      const ogImage = await resolveOgImage(slug);
      const result = await uploadIcon(storage, slug, ogImage);
      iconSrc = result.url;
      uploaded.push({ slug, bytes: result.bytes, key: result.key });
    }
    catalog.push({
      id: slug,
      name,
      category,
      hasSave: SAVED_GAME_IDS.has(slug),
      url: `https://poki.com/zh/g/${slug}`,
      iconSrc,
      enabled: true,
    });
  }

  for (const retained of RETAINED_GAMES) {
    const existing = existingById.get(retained.id);
    if (!existing) throw new Error(`retained game ${retained.id} is missing from the runtime config`);
    catalog.push({
      id: existing.id,
      name: existing.name,
      category: retained.category,
      hasSave: existing.hasSave === true,
      url: existing.url,
      iconSrc: existing.iconSrc,
      enabled: existing.enabled !== false,
    });
    reused.push(retained.id);
  }

  await fileSystem.mkdir(outputDir, { recursive: true });
  const catalogPath = join(outputDir, 'games-catalog-2026-10-03.json');
  await fileSystem.writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  await fileSystem.writeFile(
    join(outputDir, 'games-catalog-uploaded-keys.json'),
    `${JSON.stringify(uploaded, null, 2)}\n`,
    'utf8',
  );
  await fileSystem.writeFile(gamesModulePath, renderGamesModule(catalog), 'utf8');

  console.log(`catalog entries: ${catalog.length}`);
  console.log(`icons uploaded: ${uploaded.length} (${uploaded.reduce((total, item) => total + item.bytes, 0)} bytes)`);
  console.log(`icons reused: ${reused.length}`);
  console.log(`wrote ${catalogPath}`);
  console.log(`wrote ${gamesModulePath}`);

  if (!applyChanges) {
    console.log('dry run: runtime config untouched. Re-run with --apply to write it and publish.');
    return;
  }

  const backupPath = join(outputDir, `site-config-before-games-catalog-${Date.now()}.json`);
  await fileSystem.copyFile(join(dataDir, 'site-config.json'), backupPath);
  await store.write({ ...current, games: catalog });
  if (publishChanges) {
    const publisher = createPublicConfigPublisher({ configStore: store, mediaStorage: storage });
    if (publisher) {
      const published = await publisher();
      console.log(`published ${published.key}`);
    }
  } else {
    console.log('skipped COS publish; re-run with --publish to update the public config script.');
  }
  console.log(`backup ${backupPath}`);
  console.log('runtime config updated');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
