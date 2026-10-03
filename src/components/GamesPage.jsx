import { useEffect, useState } from 'react';
import { Gamepad2, Info } from 'lucide-react';
import { DEFAULT_GAMES, GAME_CATEGORIES, isGameUrl } from '../data/games.js';
import { resolvePublicAssetPath } from '../utils/publicAsset.js';

const ALL_TAB = 'all';
const DEFAULT_TAB = 'racing';

function detectWeChat() {
  return typeof navigator !== 'undefined' && /micromessenger/i.test(navigator.userAgent || '');
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy path below.
    }
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
}

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
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
  const [guardOpen, setGuardOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wechat = detectWeChat();

  const visibleGames = (Array.isArray(games) ? games : [])
    .filter((game) => game.enabled !== false && isGameUrl(game.url));
  const tabs = [
    ...GAME_CATEGORIES
      .map((category) => ({
        ...category,
        count: visibleGames.filter((game) => game.category === category.key).length,
      }))
      .filter((category) => category.count > 0),
    { key: ALL_TAB, label: '全部', count: visibleGames.length },
  ];
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.key === activeTab));
  const currentTab = tabs[activeIndex] ?? tabs[0];
  const shownGames = !currentTab || currentTab.key === ALL_TAB
    ? visibleGames
    : visibleGames.filter((game) => game.category === currentTab.key);

  useEffect(() => {
    if (!guardOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setGuardOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [guardOpen]);

  // WeChat cannot run these games at all, so push the switch before the user picks anything.
  useEffect(() => {
    if (wechat) setGuardOpen(true);
  }, [wechat]);

  const guardAgainstWeChat = (event) => {
    if (!wechat) return;
    event.preventDefault();
    setCopied(false);
    setGuardOpen(true);
  };

  const moveTab = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const nextTab = tabs[(activeIndex + step + tabs.length) % tabs.length];
    setActiveTab(nextTab.key);
    document.getElementById(`games-tab-${nextTab.key}`)?.focus();
  };

  const copyPageLink = async () => {
    const ok = await copyText(window.location.href);
    setCopied(ok);
  };

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
              游戏由第三方网站提供；微信内请先点右上角「···」，选「在浏览器中打开」，再挑游戏。
            </span>
          </div>
          <div className="games-tabs" role="tablist" aria-label="游戏分类" onKeyDown={moveTab}>
            {tabs.map((tab) => (
              <button
                className={`games-tab${tab.key === currentTab.key ? ' is-active' : ''}`}
                key={tab.key}
                type="button"
                role="tab"
                id={`games-tab-${tab.key}`}
                aria-selected={tab.key === currentTab.key}
                aria-controls="games-panel"
                tabIndex={tab.key === currentTab.key ? 0 : -1}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div
            className="games-grid"
            id="games-panel"
            role="tabpanel"
            aria-labelledby={`games-tab-${currentTab.key}`}
          >
            {shownGames.map((game) => (
              <a
                className="game-link"
                key={game.id}
                href={game.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`打开 ${game.name}`}
                onClick={guardAgainstWeChat}
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
      {guardOpen && (
        <div className="game-guard" role="dialog" aria-modal="true" aria-label="请先换到浏览器">
          <div className="game-guard-panel">
            <h2>请先换到浏览器</h2>
            <p>微信内置浏览器无法打开游戏。点右上角「···」，选「在浏览器中打开」，再回到游戏列表。</p>
            <div className="game-guard-actions">
              <button type="button" onClick={copyPageLink}>{copied ? '已复制本页链接' : '复制本页链接'}</button>
              <button type="button" className="is-primary" onClick={() => setGuardOpen(false)}>知道了</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
