# Original Hero Top Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the original homepage welcome heading into a separate 56px black top bar with a blue divider, keeping the configured hero image below it without overlap.

**Architecture:** Keep `Hero` as the owner of the first-viewport structure. Replace the animated gradient heading with a plain semantic `h1` inside a normal-flow `.hero-brand-bar`; keep `.hero-media` as the hero image layer inside `.hero-section`, with the section beginning after the bar. Preserve the existing `team.heroImage` CSS variable and all downstream homepage modules.

**Tech Stack:** React 19, Vite, CSS modules by co-located global stylesheet, Vitest, Testing Library.

---

### Task 1: Lock the new Hero contract with a failing test

**Files:**
- Modify: `src/App.test.jsx` in the existing `renders all main sections from configuration` test

- [ ] **Step 1: Replace the old gradient assertions with structural assertions**

Change the Hero assertions to:

```jsx
const brandBar = container.querySelector('.hero-brand-bar');
const heroSection = container.querySelector('.hero-section');

expect(brandBar).toHaveTextContent('欢迎来到星屿车队');
expect(brandBar).toContainElement(container.querySelector('.hero-brand'));
expect(brandBar).not.toHaveClass('animated-gradient-text');
expect(heroSection.querySelector('.hero-media')).toBeInTheDocument();
expect(brandBar.nextElementSibling).toBe(heroSection);
expect(heroSection.firstElementChild).toHaveClass('hero-media');
```

Remove the old expectation that `.hero-brand` has `animated-gradient-text`; keep the existing text and section assertions.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```text
npm test -- src/App.test.jsx
```

Expected result: the App suite fails because the current `Hero` has no `.hero-brand-bar` and still renders `GradientText`.

### Task 2: Implement the independent top bar

**Files:**
- Modify: `src/components/Hero.jsx`
- Modify: `src/styles/global.css` in the Hero rules and desktop media query

- [ ] **Step 1: Replace the GradientText wrapper with a normal-flow brand bar**

Update `Hero.jsx` to:

```jsx
export function Hero({ team }) {
  const mediaStyle = team.heroImage
    ? { '--hero-image': `url("${team.heroImage}")` }
    : undefined;

  return (
    <>
      <div className="hero-brand-bar">
        <h1 id="team-title" className="hero-brand">
          欢迎来到星屿车队
        </h1>
      </div>
      <section className="hero-section" aria-labelledby="team-title">
        <div className="hero-media" style={mediaStyle} aria-hidden="true" />
        <div className="hero-content" aria-hidden="true" />
      </section>
    </>
  );
}
```

Remove the unused `GradientText` import. The empty `.hero-content` remains only as the existing positioning hook and does not contain overlapping text.

- [ ] **Step 2: Add the bar and remove image-overlay title positioning**

Add before `.hero-section` in `global.css`:

```css
.hero-brand-bar {
  position: relative;
  z-index: 4;
  min-height: 56px;
  display: grid;
  place-items: center;
  padding: 12px 20px 10px;
  color: #ffffff;
  background: #050607;
  border-bottom: 2px solid var(--signal);
}
```

Change `.hero-section` so it no longer reserves title padding at its top:

```css
.hero-section {
  padding: 0 20px 58px;
}
```

Change `.hero-content` to retain only the existing full-section layer without a title grid, and change `.hero-brand` to a centered static heading:

```css
.hero-content {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.hero-brand {
  margin: 0;
  color: #ffffff;
  font-size: 1.15rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0;
  white-space: nowrap;
}
```

Delete the obsolete `.hero-brand--centered` rules and the title-only animation rule because the heading is no longer on top of the image. In the desktop media query, keep the bar height stable and set `.hero-brand` to `1.45rem`; do not add a second overlay title.

- [ ] **Step 3: Run the focused test and verify GREEN**

Run:

```text
npm test -- src/App.test.jsx
```

Expected result: the App suite passes, including the new DOM order assertions.

### Task 3: Verify responsive rendering and record the change

**Files:**
- Modify: `AGENTS.md` with the implementation and verification result

- [ ] **Step 1: Run the complete automated checks**

Run:

```text
npm test
npm run build
```

Expected result: all Vitest suites pass and Vite produces a successful production build.

- [ ] **Step 2: Check the live page at four target widths**

Use the existing local frontend/API and inspect `390px`, `768px`, `1024px`, and `1280px` viewports. Confirm `.hero-brand-bar` is above `.hero-media`, the heading is visible in one line, the image is not covered, and `document.documentElement.scrollWidth === document.documentElement.clientWidth`.

- [ ] **Step 3: Update AGENTS.md**

Record that the original homepage now uses the confirmed A top-bar design, list the files changed, note test/build/browser results, and state that the Pit Wall branch remains untouched.

- [ ] **Step 4: Commit the implementation**

```text
git add src/App.test.jsx src/components/Hero.jsx src/styles/global.css AGENTS.md
git commit -m feat: add original hero top bar
```
