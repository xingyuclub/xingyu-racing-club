# 星屿车队前台全模块入场动画 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为公开前台首页、相册页、音乐浮窗和全部公开弹窗补齐统一、兼容减少动态效果的入场动画。

**Architecture:** 复用现有 `data-reveal` 与 `useRevealOnScroll` 处理滚动入场，通过可选刷新键让相册目录切换后的新网格重新被观察。新增 `data-entrance` 作为挂载即播放的即时入场标记，由全局 CSS 统一控制，业务状态与交互代码保持不变。

**Tech Stack:** React 19、CSS、IntersectionObserver、Vitest、Testing Library、Vite

---

## 文件结构

- 修改 `src/hooks/useRevealOnScroll.js`：支持依赖刷新键，保持无 IntersectionObserver 和减少动态效果时立即可见。
- 修改 `src/components/Hero.jsx`：为完整 Hero 模块增加区块级滚动入场容器。
- 修改 `src/components/AlbumPage.jsx`：相册头部、目录网格和照片网格接入滚动观察，并在目录切换时刷新。
- 修改 `src/components/MusicPlayer.jsx`：为浮窗增加即时入场标记。
- 修改 `src/components/VideoModal.jsx`、`PhotoModal.jsx`、`NewsFeed.jsx`、`ScoreDetailsModal.jsx`：为公开弹窗内容面板增加即时入场标记。
- 修改 `src/styles/global.css`：统一滚动与即时入场样式、相册卡片错峰、减少动态效果覆盖。
- 修改 `src/App.test.jsx`：覆盖首页、相册、音乐浮窗和全部弹窗的动画标记与动态相册视图。

### Task 1: 首页与相册滚动入场

**Files:**
- Modify: `src/App.test.jsx`
- Modify: `src/hooks/useRevealOnScroll.js`
- Modify: `src/components/Hero.jsx`
- Modify: `src/components/AlbumPage.jsx`

- [ ] **Step 1: 写首页和相册标记的失败测试**

在 `src/App.test.jsx` 增加测试，先验证首页七个主要模块都有 `data-reveal`，再进入相册并验证头部、目录网格、照片网格会被立即标记为可见：

```jsx
it('marks every public home module for scroll entrance', () => {
  const { container } = render(<App />);
  const modules = [
    '.hero-module',
    '.stats-bar',
    '.featured-section',
    '.gallery-section',
    '[aria-labelledby="roster-title"]',
    '[aria-labelledby="leaderboard-title"]',
    '.news-section',
  ];

  modules.forEach((selector) => {
    expect(container.querySelector(selector)).toHaveAttribute('data-reveal');
  });
});

it('reveals album header and the current album grid after view changes', async () => {
  const user = userEvent.setup();
  const { container } = render(<App />);

  await user.click(screen.getByRole('button', { name: '查看更多相册' }));
  expect(container.querySelector('.album-header')).toHaveAttribute('data-reveal');
  expect(container.querySelector('.album-folder-grid')).toHaveClass('is-visible');

  await user.click(screen.getAllByTestId('album-folder')[0]);
  expect(container.querySelector('.album-grid')).toHaveAttribute('data-reveal');
  expect(container.querySelector('.album-grid')).toHaveClass('is-visible');
});
```

- [ ] **Step 2: 运行测试并确认因标记缺失而失败**

Run: `npm test -- --run src/App.test.jsx`

Expected: FAIL，`.hero-module`、相册 `data-reveal` 或 `is-visible` 断言失败；不能是语法或测试环境错误。

- [ ] **Step 3: 为滚动观察 Hook 增加刷新键**

将 `src/hooks/useRevealOnScroll.js` 的函数签名和 effect 依赖改为：

```js
export function useRevealOnScroll(enabled = true, refreshKey = null) {
  useEffect(() => {
    if (!enabled) return undefined;

    const elements = document.querySelectorAll('[data-reveal]');
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      elements.forEach((element) => element.classList.add('is-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -40px', threshold: 0.12 },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [enabled, refreshKey]);
}
```

- [ ] **Step 4: 为 Hero 和相册视图增加最小标记**

在 `src/components/Hero.jsx` 用一个不改变布局的容器包住现有品牌栏与媒体区：

```jsx
return (
  <div className="hero-module" data-reveal>
    <div className="hero-brand-bar">...</div>
    <section className={`hero-section${hasMedia ? '' : ' hero-section--empty'}`} ...>
      ...
    </section>
  </div>
);
```

在 `src/components/AlbumPage.jsx` 引入并调用 Hook：

```jsx
import { useRevealOnScroll } from '../hooks/useRevealOnScroll.js';

export function AlbumPage({ albums, onBack, onOpenPhoto }) {
  const [activeAlbumId, setActiveAlbumId] = useState(null);
  useRevealOnScroll(true, activeAlbumId);
  // 其余现有逻辑保持不变
}
```

为 `.album-header`、`.album-folder-grid` 和 `.album-grid` 增加 `data-reveal`。目录和照片按钮继续保留现有 key、点击与媒体逻辑。

- [ ] **Step 5: 运行定向测试并确认通过**

Run: `npm test -- --run src/App.test.jsx`

Expected: PASS，包含新增首页和相册入场测试；现有轮播、相册和弹窗测试不回归。

- [ ] **Step 6: 提交滚动入场改动**

```bash
git add src/App.test.jsx src/hooks/useRevealOnScroll.js src/components/Hero.jsx src/components/AlbumPage.jsx
git commit -m "feat: add scroll entrance to public sections"
```

### Task 2: 音乐浮窗与公开弹窗即时入场

**Files:**
- Modify: `src/App.test.jsx`
- Modify: `src/components/MusicPlayer.jsx`
- Modify: `src/components/VideoModal.jsx`
- Modify: `src/components/PhotoModal.jsx`
- Modify: `src/components/NewsFeed.jsx`
- Modify: `src/components/ScoreDetailsModal.jsx`

- [ ] **Step 1: 写即时入场标记的失败测试**

在 `src/App.test.jsx` 增加以下测试，逐一打开四类弹窗，确认内容面板带 `data-entrance`：

```jsx
it('marks the music player and every public dialog for immediate entrance', async () => {
  const user = userEvent.setup();
  const { container } = render(<App />);

  expect(container.querySelector('.music-player')).toHaveAttribute('data-entrance');

  await user.click(screen.getByRole('button', { name: '查看成员 01 高光视频' }));
  expect(screen.getByRole('dialog')).toHaveAttribute('data-entrance');
  await user.keyboard('{Escape}');

  await user.click(screen.getByRole('button', { name: '查看赛季全家福' }));
  expect(screen.getByRole('dialog')).toHaveAttribute('data-entrance');
  await user.keyboard('{Escape}');

  await user.click(screen.getByRole('button', { name: /查看资讯/ }));
  expect(screen.getByRole('dialog')).toHaveAttribute('data-entrance');
  await user.keyboard('{Escape}');

  await user.click(screen.getByRole('button', { name: '查找' }));
  expect(screen.getByRole('dialog')).toHaveAttribute('data-entrance');
});
```

- [ ] **Step 2: 运行测试并确认因即时标记缺失而失败**

Run: `npm test -- --run src/App.test.jsx`

Expected: FAIL，首个 `data-entrance` 断言失败。

- [ ] **Step 3: 为即时模块增加属性**

只在现有根节点或弹窗内容面板增加属性，不改变事件处理：

```jsx
// MusicPlayer.jsx
<button className={`music-player ${isPlaying ? 'is-playing' : 'is-paused'}`} data-entrance ...>

// VideoModal.jsx
<section className="video-modal member-video-modal" data-entrance role="dialog" ...>

// PhotoModal.jsx
<section className="photo-modal" data-entrance role="dialog" ...>

// NewsFeed.jsx
<section className="photo-modal news-modal" data-entrance role="dialog" ...>

// ScoreDetailsModal.jsx
<section className="video-modal score-details-modal" data-entrance role="dialog" ...>
```

- [ ] **Step 4: 运行定向测试并确认通过**

Run: `npm test -- --run src/App.test.jsx`

Expected: PASS，音乐拖拽、播放、Escape 与背景关闭测试保持通过。

- [ ] **Step 5: 提交即时入场标记**

```bash
git add src/App.test.jsx src/components/MusicPlayer.jsx src/components/VideoModal.jsx src/components/PhotoModal.jsx src/components/NewsFeed.jsx src/components/ScoreDetailsModal.jsx
git commit -m "feat: mark public overlays for entrance animation"
```

### Task 3: 统一动画 CSS 与减少动态效果

**Files:**
- Modify: `src/App.test.jsx`
- Modify: `src/styles/global.css`

- [ ] **Step 1: 写 CSS 行为的失败测试**

沿用 `src/App.test.jsx` 读取 `globalStyles` 的现有方式，增加以下断言：

```jsx
it('defines unified entrance motion with a reduced-motion fallback', () => {
  expect(globalStyles).toMatch(/\[data-entrance\]\s*\{[^}]*animation:\s*modal-in\s+280ms/s);
  expect(globalStyles).toMatch(
    /\[data-reveal\]\.is-visible\s*>\s*\.album-folder,[\s\S]*animation:\s*modal-in\s+420ms/s,
  );
  expect(globalStyles).toMatch(
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\[data-entrance\][^{]*\{[^}]*opacity:\s*1[^}]*transform:\s*none/s,
  );
});
```

若现有测试文件在顶部通过 `readFileSync` 加载 CSS，则复用该变量，不新增第二套文件读取逻辑。

- [ ] **Step 2: 运行测试并确认因 CSS 规则缺失而失败**

Run: `npm test -- --run src/App.test.jsx`

Expected: FAIL，`[data-entrance]` 或相册错峰 CSS 正则不匹配。

- [ ] **Step 3: 新增统一 CSS 并移除重复动画声明**

在现有 `[data-reveal]` 规则附近加入：

```css
[data-entrance] {
  animation: modal-in 280ms cubic-bezier(0.2, 0.75, 0.25, 1) both;
}

[data-reveal].is-visible > .album-folder,
[data-reveal].is-visible > .album-photo {
  animation: modal-in 420ms calc(var(--stagger-index, 0) * 36ms)
    cubic-bezier(0.2, 0.75, 0.25, 1) both;
}
```

在 `AlbumPage.jsx` 的 map 中给文件夹和照片按钮补充有限错峰索引：

```jsx
style={{ '--stagger-index': Math.min(index, 5) }}
```

为此把两个 map 回调改为接收 `index`。从 `.video-modal` 和 `.photo-modal` 删除重复的 `animation: modal-in ...` 行，动画统一由 `data-entrance` 负责。

- [ ] **Step 4: 补齐减少动态效果覆盖**

在现有 `@media (prefers-reduced-motion: reduce)` 可见性规则中加入即时元素和相册子项：

```css
  [data-entrance],
  [data-reveal] > .album-folder,
  [data-reveal] > .album-photo {
    opacity: 1;
    transform: none;
    animation: none !important;
  }
```

保留现有轮播平滑过渡例外、音乐头像停止旋转和阵容卡片规则，不扩大选择器范围。

- [ ] **Step 5: 运行定向测试并确认通过**

Run: `npm test -- --run src/App.test.jsx`

Expected: PASS，新增 CSS 断言和所有既有前台测试通过。

- [ ] **Step 6: 提交统一动画样式**

```bash
git add src/App.test.jsx src/components/AlbumPage.jsx src/styles/global.css
git commit -m "style: unify public entrance animations"
```

### Task 4: 全量验证与浏览器验收

**Files:**
- Verify only; no planned source edits

- [ ] **Step 1: 运行全量测试**

Run: `npm test -- --run`

Expected: 所有测试文件和测试项通过，无新增 warning 或未处理异常。

- [ ] **Step 2: 运行生产构建**

Run: `npm run build`

Expected: Vite 构建成功；ExcelJS 继续保持独立动态代码块，公开首页不新增第三方动画依赖。

- [ ] **Step 3: 启动可访问的前端与 API**

先检查现有端口；若 API 和 Vite 未运行，分别执行：

```powershell
npm run dev:api
npm run dev -- --host 0.0.0.0 --port 4173
```

Expected: API 与前端返回 HTTP 200；若 4173 已占用则选择未占用端口并记录实际 URL。

- [ ] **Step 4: 在三档视口验收公开前台**

使用浏览器检查 390×844、768×1024、1280×800：

- 首页七个模块进入视口后由透明上移状态变为 `is-visible`。
- 相册目录和照片视图切换后均可见，并有短错峰入场。
- 音乐浮窗可播放、暂停、纵向拖动且入场动画不覆盖其位置。
- 视频、照片、资讯和积分详情弹窗打开动画一致，Escape、关闭按钮和背景点击可关闭。
- 阵容圆柱持续滚动、拖拽、居中置顶和成员点击保持正常。
- 页面级横向溢出为 0。

- [ ] **Step 5: 验收减少动态效果**

启用 `prefers-reduced-motion: reduce` 后重新加载并检查：首页、相册、音乐浮窗和弹窗直接可见且没有入场位移；车队风采仍按既有规则自动切换。

- [ ] **Step 6: 检查最终差异**

Run: `git diff --check && git status --short`

Expected: 无空白错误；只包含本计划涉及文件和用户原有未提交改动，不修改或回退无关文件。
