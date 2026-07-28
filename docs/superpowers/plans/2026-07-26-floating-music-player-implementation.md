# Floating Music Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an autoplaying, looping background track controlled by a rotating circular avatar fixed to the right edge of the H5 site.

**Architecture:** A focused `MusicPlayer` component owns the native `<audio>` element, playback state, autoplay fallback listener, and long-press timer. `App` mounts it outside normal document flow, while CSS handles fixed positioning, circular cropping, status badge, rotation, and responsive sizing.

**Tech Stack:** React 19, native HTML audio, lucide-react, CSS, Vitest, Testing Library, Vite.

---

### Task 1: Specify player behavior with failing integration tests

**Files:**
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Mock native media methods for app tests**

Add `act` and `waitFor` to the Testing Library import, then create media spies:

```jsx
let mediaPlay;
let mediaPause;

beforeEach(() => {
  mediaPlay = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  mediaPause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});

afterEach(() => {
  window.location.hash = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
});
```

- [ ] **Step 2: Add tests for autoplay, tap toggle, fallback, and long press**

```jsx
it('auto-plays looping background music from the floating avatar', async () => {
  const { container } = render(<App />);
  const audio = container.querySelector('audio');

  await waitFor(() => expect(mediaPlay).toHaveBeenCalled());
  expect(audio).toHaveAttribute('src', '/audio/full-heart-departure.flac');
  expect(audio).toHaveAttribute('autoplay');
  expect(audio).toHaveAttribute('loop');
  expect(screen.getByRole('button', { name: '音乐播放中，点击暂停，长按关闭' })).toHaveClass('is-playing');
});

it('pauses and resumes music when the avatar is clicked', async () => {
  const user = userEvent.setup();
  render(<App />);

  const playingButton = await screen.findByRole('button', { name: '音乐播放中，点击暂停，长按关闭' });
  await user.click(playingButton);
  expect(mediaPause).toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: '音乐已暂停，点击继续，长按关闭' }));
  expect(mediaPlay).toHaveBeenCalledTimes(2);
});

it('retries blocked autoplay on the first page interaction', async () => {
  mediaPlay.mockRejectedValueOnce(new Error('autoplay blocked')).mockResolvedValueOnce();
  render(<App />);

  await waitFor(() => expect(mediaPlay).toHaveBeenCalledTimes(1));
  fireEvent.pointerDown(document.body);
  await waitFor(() => expect(mediaPlay).toHaveBeenCalledTimes(2));
});

it('stops and closes the music player after a long press', () => {
  vi.useFakeTimers();
  mediaPlay.mockImplementation(() => new Promise(() => {}));
  render(<App />);

  const player = screen.getByRole('button', { name: '音乐已暂停，点击继续，长按关闭' });
  fireEvent.pointerDown(player);
  act(() => vi.advanceTimersByTime(650));

  expect(mediaPause).toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /音乐/ })).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Run tests and verify the missing feature fails**

Run: `npm test -- --run src/App.test.jsx`

Expected: FAIL because no floating music button or audio element exists.

### Task 2: Add assets and implement the player

**Files:**
- Create: `public/audio/full-heart-departure.flac`
- Create: `public/images/music-avatar.png`
- Create: `src/components/MusicPlayer.jsx`
- Modify: `src/App.jsx`
- Modify: `src/styles/global.css`
- Test: `src/App.test.jsx`

- [ ] **Step 1: Copy the supplied assets under stable ASCII names**

Copy the provided FLAC to `public/audio/full-heart-departure.flac` and the supplied PNG to `public/images/music-avatar.png`. Preserve binary contents without recompression.

- [ ] **Step 2: Implement the focused player component**

Create `src/components/MusicPlayer.jsx`:

```jsx
import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const LONG_PRESS_MS = 650;

export function MusicPlayer({ src, cover }) {
  const audioRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressedRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (isDismissed) return undefined;

    const audio = audioRef.current;
    let active = true;

    const attemptPlay = async () => {
      try {
        await audio.play();
        if (active) setIsPlaying(true);
      } catch {
        if (active) {
          setIsPlaying(false);
          document.addEventListener('pointerdown', attemptPlay, { once: true });
        }
      }
    };

    void attemptPlay();

    return () => {
      active = false;
      document.removeEventListener('pointerdown', attemptPlay);
      window.clearTimeout(longPressTimerRef.current);
    };
  }, [isDismissed]);

  const togglePlayback = async () => {
    if (longPressedRef.current) {
      longPressedRef.current = false;
      return;
    }

    const audio = audioRef.current;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const dismiss = () => {
    longPressedRef.current = true;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
    setIsDismissed(true);
  };

  const startLongPress = () => {
    longPressedRef.current = false;
    longPressTimerRef.current = window.setTimeout(dismiss, LONG_PRESS_MS);
  };

  const clearLongPress = () => window.clearTimeout(longPressTimerRef.current);

  if (isDismissed) return null;

  return (
    <button
      type="button"
      className={`music-player ${isPlaying ? 'is-playing' : 'is-paused'}`}
      aria-label={isPlaying ? '音乐播放中，点击暂停，长按关闭' : '音乐已暂停，点击继续，长按关闭'}
      onClick={togglePlayback}
      onPointerDown={startLongPress}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
      onPointerLeave={clearLongPress}
      onContextMenu={(event) => event.preventDefault()}
    >
      <audio
        ref={audioRef}
        src={src}
        autoPlay
        loop
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      <img src={cover} alt="" draggable="false" />
      <span className="music-player-state" aria-hidden="true">
        {isPlaying ? <Pause size={12} /> : <Play size={12} />}
      </span>
    </button>
  );
}
```

- [ ] **Step 3: Mount the player in both App branches**

Import `MusicPlayer` in `src/App.jsx`. Render the same player after each `main` so it remains outside document layout:

```jsx
<MusicPlayer
  src="/audio/full-heart-departure.flac"
  cover="/images/music-avatar.png"
/>
```

- [ ] **Step 4: Add fixed circular styling and rotation**

Append to `src/styles/global.css`:

```css
.music-player {
  position: fixed;
  top: 58%;
  right: max(10px, env(safe-area-inset-right));
  z-index: 60;
  width: 56px;
  height: 56px;
  padding: 0;
  overflow: visible;
  border: 2px solid rgba(255, 255, 255, 0.94);
  border-radius: 50%;
  background: var(--surface);
  box-shadow: 0 10px 28px rgba(4, 24, 58, 0.24), 0 0 0 2px var(--signal);
  cursor: pointer;
  touch-action: manipulation;
  -webkit-touch-callout: none;
}

.music-player > img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  border-radius: 50%;
  animation: music-avatar-spin 8s linear infinite;
  animation-play-state: paused;
  user-select: none;
}

.music-player.is-playing > img {
  animation-play-state: running;
}

.music-player-state {
  position: absolute;
  right: -3px;
  bottom: -3px;
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  color: #ffffff;
  border: 2px solid #ffffff;
  border-radius: 50%;
  background: var(--signal-strong);
}

@keyframes music-avatar-spin {
  to { transform: rotate(360deg); }
}

@media (min-width: 700px) {
  .music-player {
    right: max(16px, env(safe-area-inset-right));
    width: 62px;
    height: 62px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .music-player > img { animation: none; }
}
```

- [ ] **Step 5: Run the focused tests until green**

Run: `npm test -- --run src/App.test.jsx`

Expected: all App tests PASS.

### Task 3: Verify production and responsive behavior

**Files:**
- Verify: `src/components/MusicPlayer.jsx`
- Verify: `src/styles/global.css`

- [ ] **Step 1: Run complete automated verification**

Run: `npm test -- --run`

Expected: all tests PASS.

Run: `npm run build`

Expected: Vite production build exits with code 0.

- [ ] **Step 2: Verify in the in-app browser**

Reload `http://127.0.0.1:4177/`, test default desktop and 390x844 H5 viewports, and confirm:

- Avatar is circular and fixed to the right edge without page overflow.
- Audio source is loaded and the button reports playing or blocked-autoplay state accurately.
- Clicking toggles play/pause and rotation state.
- Holding for at least 650ms stops audio and removes the control.
- Local page console has no errors.

- [ ] **Step 3: Review the final diff**

Run: `git diff --check`

Expected: exit code 0 with no whitespace errors.
