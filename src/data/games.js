export const DEFAULT_GAMES = [
  {
    id: 'hill-climb-racing',
    name: '登山赛车',
    url: 'https://poki.com/zh/g/hill-climb-racing-lite',
    iconSrc: '/images/games/hill-climb-racing.png',
    enabled: true,
  },
  {
    id: 'blocky-blast-puzzle',
    name: '方块消除',
    url: 'https://poki.com/zh/g/blocky-blast-puzzle',
    iconSrc: '/images/games/blocky-blast-puzzle.png',
    enabled: true,
  },
  {
    id: 'tiny-fishing',
    name: 'Tiny Fishing',
    url: 'https://poki.com/en/g/tiny-fishing',
    iconSrc: '/images/games/tiny-fishing.jpg',
    enabled: true,
  },
  {
    id: 'fishing-world',
    name: 'Fishing World',
    url: 'https://poki.com/en/g/fishing-world',
    iconSrc: '/images/games/fishing-world.jpg',
    enabled: true,
  },
  {
    id: 'game-of-farmers',
    name: 'Game of Farmers',
    url: 'https://poki.com/en/g/game-of-farmers',
    iconSrc: '/images/games/game-of-farmers.jpg',
    enabled: true,
  },
  {
    id: 'fruit-ninja',
    name: 'Fruit Ninja',
    url: 'https://poki.com/zh/g/fruit-ninja',
    iconSrc: '/images/games/fruit-ninja.jpg',
    enabled: true,
  },
  {
    id: 'zhuadae',
    name: '抓大鹅',
    url: 'https://kunpo.cc/game-detail.html?id=2',
    iconSrc: '/images/games/zhuadae.jpg',
    enabled: true,
  },
  {
    id: 'monkey-mart',
    name: 'Monkey Mart',
    url: 'https://poki.com/en/g/monkey-mart',
    iconSrc: '/images/games/monkey-mart.jpg',
    enabled: true,
  },
];

export function isGameUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}
