import { useState } from 'react';
import { Gamepad2, Info } from 'lucide-react';
import { DEFAULT_GAMES, isGameUrl } from '../data/games.js';
import { resolvePublicAssetPath } from '../utils/publicAsset.js';

function GameIcon({ src }) {
  const [failedSrc, setFailedSrc] = useState(null);
  return src && failedSrc !== src ? (
    <img
      src={resolvePublicAssetPath(src)}
      alt=""
      width={88}
      height={88}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
    />
  ) : (
    <Gamepad2 size={40} aria-hidden="true" />
  );
}

export function GamesPage({ games = DEFAULT_GAMES }) {
  const visibleGames = (Array.isArray(games) ? games : [])
    .filter((game) => game.enabled !== false && isGameUrl(game.url));

  return (
    <section className="album-page games-page" aria-label="小游戏">
      {visibleGames.length ? (
        <>
          <div className="games-notice" role="note">
            <span className="games-notice-head">
              <Info size={16} aria-hidden="true" />
              <strong>小游戏需跳转到第三方网站</strong>
            </span>
            <span className="games-notice-body">
              点击图标会在新页面打开；微信内打不开时，请点右上角「···」，选择「在浏览器中打开」。
            </span>
          </div>
          <div className="games-grid">
            {visibleGames.map((game) => (
              <a
                className="game-link"
                key={game.id}
                href={game.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`打开 ${game.name}`}
              >
                <span className="game-icon"><GameIcon src={game.iconSrc} /></span>
                <span className="game-name">{game.name}</span>
              </a>
            ))}
          </div>
        </>
      ) : (
        <p className="empty-state">暂无上架游戏</p>
      )}
    </section>
  );
}
