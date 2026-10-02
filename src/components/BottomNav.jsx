import { Gamepad2, Home, Images, Newspaper, Trophy } from 'lucide-react';

const items = [
  { key: 'home', label: '首页', hash: '', icon: Home },
  { key: 'news', label: '资讯', hash: 'news', icon: Newspaper },
  { key: 'leaderboard', label: '积分榜', hash: 'leaderboard', icon: Trophy },
  { key: 'album', label: '相册', hash: 'album', icon: Images },
  { key: 'games', label: '小游戏', hash: 'games', icon: Gamepad2 },
];

export function BottomNav({ active, onNavigate }) {
  return (
    <nav className="bottom-nav" aria-label="底部主导航">
      {items.map(({ key, label, hash, icon: Icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            className={`bottom-nav-item${isActive ? ' is-active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onNavigate(hash)}
          >
            <Icon size={21} aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
