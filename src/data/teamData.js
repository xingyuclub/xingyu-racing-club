const roster = Array.from({ length: 30 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  return {
    id: `member-${number}`,
    name: `成员 ${number}`,
    number,
    role:
      index === 0
        ? '队长'
        : index < 5
          ? '副队'
          : index < 8
            ? '精英'
            : '正式成员',
    points: Math.max(8, 98 - index * 3),
    wins: Math.max(0, 6 - Math.floor(index / 5)),
    avatar: '',
    videoUrl: '',
  };
});

const albums = [
  {
    id: 'album-season',
    name: '2026 赛季精选',
    date: '2026-07-25',
    coverSrc: '/images/album/placeholder-01.jpg',
    photos: [
      { id: 'photo-01', src: '/images/album/placeholder-01.jpg', title: '赛季全家福', date: '2026-07-25', alt: '星屿车队赛季全家福占位图', featured: true },
      { id: 'photo-02', src: '/images/album/placeholder-02.jpg', title: '车队记录 02', date: '2026-07-25', alt: '星屿车队记录 02 占位图', featured: true, mediaType: 'video' },
      { id: 'photo-03', src: '/images/album/placeholder-03.jpg', title: '车队记录 03', date: '2026-07-25', alt: '星屿车队记录 03 占位图', featured: true },
    ],
  },
  {
    id: 'album-training',
    name: '训练日常',
    date: '2026-07-20',
    coverSrc: '/images/album/placeholder-04.jpg',
    photos: [
      { id: 'photo-04', src: '/images/album/placeholder-04.jpg', title: '车队记录 04', date: '2026-07-20', alt: '星屿车队记录 04 占位图', featured: true },
      { id: 'photo-05', src: '/images/album/placeholder-05.jpg', title: '车队记录 05', date: '2026-07-20', alt: '星屿车队记录 05 占位图', featured: true },
      { id: 'photo-06', src: '/images/album/placeholder-06.jpg', title: '车队记录 06', date: '2026-07-20', alt: '星屿车队记录 06 占位图' },
    ],
  },
  {
    id: 'album-paddock',
    name: '赛道花絮',
    date: '2026-07-15',
    coverSrc: '/images/album/placeholder-07.jpg',
    photos: [
      { id: 'photo-07', src: '/images/album/placeholder-07.jpg', title: '车队记录 07', date: '2026-07-15', alt: '星屿车队记录 07 占位图' },
      { id: 'photo-08', src: '/images/album/placeholder-08.jpg', title: '车队记录 08', date: '2026-07-15', alt: '星屿车队记录 08 占位图' },
    ],
  },
];

const gallery = albums.flatMap((album) => album.photos);

const dailyRoundTemplate = [
  [[1, 6, 5], [1, 3, 2]],
  [[2, 3, 1], [1, 2, 1]],
  [[3, 1, 3], [2, 1, 2]],
  [[5, 4, 4], [0, 0, 0]],
  [[4, 1, 2], [3, 1, 2]],
  [[6, 5, 2], [0, 0, 0]],
  [[4, 2, 6], [0, 0, 0]],
  [[0, 0, 0], [0, 0, 0]],
  [[0, 0, 0], [0, 0, 0]],
  [[2, 3, 4], [0, 0, 0]],
  [[1, 2, 3], [0, 0, 0]],
  [[3, 5, 5], [2, 3, 3]],
  [[0, 0, 0], [0, 0, 0]],
  [[0, 0, 0], [2, 2, 2]],
  [[0, 0, 0], [2, 0, 0]],
  [[5, 4, 1], [0, 0, 0]],
  [[0, 0, 0], [3, 3, 3]],
];

const dailyScores = [
  {
    date: '2026-07-24',
    weekday: '周五',
    rows: roster.map((member, index) => {
      const [teamRace = [0, 0, 0], openRace = [0, 0, 0]] =
        dailyRoundTemplate[index] || [];

      return {
        id: member.id,
        name: member.name,
        teamRace,
        openRace,
        score: [...teamRace, ...openRace].reduce((total, value) => total + value, 0),
        total: member.points,
      };
    }),
  },
];

export const teamData = {
  team: {
    name: '⁢⁣ˣʸ༩·星⁡⁠屿',
    heroLines: ['欢迎来到星屿车队', 'Wellcome To RACING CLUB'],
    label: 'RACING CLUB',
    motto: '以星为序，向屿而行',
    heroMedia: { src: '/images/hero-home.png', type: 'image' },
    heroFallbackImage: '',
  },
  stats: [
    { label: '车队排名', value: '1st' },
    { label: '活跃排名', value: '3rd' },
    { label: '队员数量', value: '30' },
    { label: '单身贵族', value: { male: 12, female: 8 } },
  ],
  featuredMembers: roster.slice(0, 8),
  roster,
  albums,
  gallery,
  dailyScores,
  leaderboard: roster
    .map((member) => ({
      id: member.id,
      rank: Number(member.number),
      name: member.name,
      points: member.points,
      wins: member.wins,
    }))
    .sort((a, b) => b.points - a.points),
  news: [
    {
      id: 'news-01',
      title: '赛季积分榜更新',
      category: '公告',
      date: '2026-07-25',
      imageSrc: '/images/album/placeholder-01.jpg',
      imageAlt: '赛季积分榜更新资讯图',
      summary: '新赛季内部积分榜已整理完成，核心成员和完整阵容数据进入第一版展示。',
      body: '本期积分榜按成员当前总分排序，Top10 将作为 H5 首页重点展示。后续真实比赛数据确认后，可继续替换为最新积分和成员图片。',
    },
    {
      id: 'news-02',
      title: '核心成员高光位预留',
      category: '动态',
      date: '2026-07-25',
      imageSrc: '/images/album/placeholder-04.jpg',
      imageAlt: '核心成员高光位预留资讯图',
      summary: '8 位核心成员高光视频入口已预留，后续替换真实视频地址即可展示。',
      body: '队员风采区域保留高光视频入口，当前先以成员档案样式展示。等真实视频素材补齐后，只需更新成员配置里的视频地址。',
    },
    {
      id: 'news-03',
      title: '车队全家福素材征集中',
      category: '战报',
      date: '2026-07-25',
      imageSrc: '/images/album/placeholder-07.jpg',
      imageAlt: '车队全家福素材征集资讯图',
      summary: '首屏暂用高级深色视觉，真实全家福确认后直接替换配置。',
      body: '相册和资讯图片位均已预留，适合放训练日常、赛季合影、战报截图等素材，优先使用竖图或 4:3 横图以适配 H5 浏览。',
    },
  ],
};
