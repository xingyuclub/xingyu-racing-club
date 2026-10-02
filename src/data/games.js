export const DEFAULT_GAMES = [
  {
    id: 'hill-climb-racing',
    name: '登山赛车',
    url: 'https://poki.com/zh/g/hill-climb-racing-lite',
    iconSrc: 'https://media.xn--0tr48cxwl51iluvqh7c.xn--fiqs8s/games/icons/c32d52d6238d5b9e-hill-climb-racing.png',
    enabled: true,
  },
  {
    id: 'blocky-blast-puzzle',
    name: '方块消除',
    url: 'https://poki.com/zh/g/blocky-blast-puzzle',
    iconSrc: 'https://media.xn--0tr48cxwl51iluvqh7c.xn--fiqs8s/games/icons/ec32121a04821a94-blocky-blast-puzzle.png',
    enabled: true,
  },
  {
    id: 'tiny-fishing',
    name: 'Tiny Fishing',
    url: 'https://poki.com/en/g/tiny-fishing',
    iconSrc: 'https://media.xn--0tr48cxwl51iluvqh7c.xn--fiqs8s/games/icons/657cc980cff2d0c3-tiny-fishing.jpg',
    enabled: true,
  },
  {
    id: 'fishing-world',
    name: 'Fishing World',
    url: 'https://poki.com/en/g/fishing-world',
    iconSrc: 'https://media.xn--0tr48cxwl51iluvqh7c.xn--fiqs8s/games/icons/774abed0c10d0294-fishing-world.jpg',
    enabled: true,
  },
  {
    id: 'game-of-farmers',
    name: 'Game of Farmers',
    url: 'https://poki.com/en/g/game-of-farmers',
    iconSrc: 'https://media.xn--0tr48cxwl51iluvqh7c.xn--fiqs8s/games/icons/d172723d40dbb0d5-game-of-farmers.jpg',
    enabled: true,
  },
  {
    id: 'fruit-ninja',
    name: 'Fruit Ninja',
    url: 'https://poki.com/zh/g/fruit-ninja',
    iconSrc: 'https://media.xn--0tr48cxwl51iluvqh7c.xn--fiqs8s/games/icons/5f35bfcf161e96f7-fruit-ninja.jpg',
    enabled: true,
  },
  {
    id: 'zhuadae',
    name: '抓大鹅',
    url: 'https://kunpo.cc/game-detail.html?id=2',
    iconSrc: 'https://media.xn--0tr48cxwl51iluvqh7c.xn--fiqs8s/games/icons/46bddb32bd3ef7ac-zhuadae.jpg',
    enabled: true,
  },
  {
    id: 'monkey-mart',
    name: 'Monkey Mart',
    url: 'https://poki.com/en/g/monkey-mart',
    iconSrc: 'https://media.xn--0tr48cxwl51iluvqh7c.xn--fiqs8s/games/icons/77362b4d147a62ab-monkey-mart.jpg',
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
