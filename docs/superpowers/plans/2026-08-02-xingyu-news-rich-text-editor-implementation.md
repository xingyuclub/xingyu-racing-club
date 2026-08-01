# 星屿车队新闻富文本编辑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为配置后台增加默认折叠的新闻卡片、独立封面上传和 Tiptap 富文本正文编辑，并让公开新闻弹窗安全展示多图富文本且兼容旧纯文本。

**Architecture:** 新闻继续保留 `imageSrc`、`summary` 和纯文本 `body`，新增可选 `bodyHtml`。后台 `RichTextEditor` 负责编辑、格式命令和正文图片上传；配置存储层在写盘前统一清洗 HTML 并重新派生 `body`；公开 `NewsFeed` 只渲染已经清洗的 HTML并在字段缺失时回退纯文本。

**Tech Stack:** React 19、Vite 6、Vitest、Testing Library、Tiptap 3.29.2、sanitize-html 2.17.6、html-to-text 10.0.0、现有 Express/Multer 上传 API、Lucide React。

**Design reference:** `docs/superpowers/specs/2026-08-02-xingyu-news-rich-text-editor-design.md`

---

## File Map

- Create `server/lib/newsRichText.js`: 富文本标签、属性、样式和 URL 白名单；返回清洗后的 HTML 与纯文本。
- Create `server/lib/newsRichText.test.js`: 清洗、安全 URL、图片来源和纯文本派生单元测试。
- Modify `server/lib/configStore.js`: 保存前清洗所有新闻，校验可选 `bodyHtml`，拒绝清洗后为空的富文本。
- Modify `server/lib/configStore.test.js`: 配置写盘清洗、非法类型和旧数据回退测试。
- Modify `src/data/siteConfig.test.js`: 验证旧新闻不被强制重写、已有富文本被保留。
- Create `src/admin/RichTextEditor.jsx`: Tiptap 扩展、工具栏、上传插图、上传错误和 `bodyHtml`/`body` 回调。
- Create `src/admin/RichTextEditor.test.jsx`: 工具栏、旧正文载入、格式命令、图片上传成功/失败和多图测试。
- Modify `src/admin/ConfigEditor.jsx`: 新闻专属连续布局、新旧新闻折叠规则、封面图片类型限制和新建模板。
- Modify `src/admin/AdminApp.test.jsx`: 新闻折叠、新建展开、字段保存和封面/正文图片区分测试。
- Modify `src/components/NewsFeed.jsx`: 日期、导语、清洗后的富文本和旧正文回退渲染。
- Modify `src/App.test.jsx`: 富文本标题、列表、链接、多图和旧正文回退测试。
- Modify `src/admin/admin.css`: 新闻编辑器、响应式工具栏、编辑区和状态样式。
- Modify `src/styles/global.css`: 新闻弹窗阅读排版、多图、长正文滚动和移动端适配。
- Modify `package.json` and `package-lock.json`: 固定 Tiptap 与 sanitize-html 依赖。
- Modify `docs/config-admin-guide.md`: 新闻封面、正文工具栏、插图和兼容说明。
- Modify `AGENTS.md`: 交接记录、验证状态和风险。

---

### Task 1: 建立基线并安装精确依赖

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: 运行改动前基线测试**

Run: `npm test -- --run`

Expected: 当前全部测试通过；若失败，记录现有失败且先排除与本任务无关的工作区状态，不进入浏览器验收。

- [ ] **Step 2: 运行改动前基线构建**

Run: `npm run build`

Expected: Vite production build succeeds。

- [ ] **Step 3: 安装编辑器与清洗依赖**

Run:

```powershell
npm install @tiptap/react@3.29.2 @tiptap/pm@3.29.2 @tiptap/starter-kit@3.29.2 @tiptap/extension-text-style@3.29.2 @tiptap/extension-text-align@3.29.2 @tiptap/extension-underline@3.29.2 @tiptap/extension-link@3.29.2 @tiptap/extension-image@3.29.2 sanitize-html@2.17.6 html-to-text@10.0.0
```

Expected: install succeeds，`package-lock.json` 只增加上述直接依赖及其传递依赖。

- [ ] **Step 4: 验证依赖可解析**

Run:

```powershell
node -e "Promise.all([import('@tiptap/react'),import('@tiptap/extension-text-style/font-size'),import('sanitize-html'),import('html-to-text')]).then(()=>console.log('dependencies ok'))"
```

Expected: prints `dependencies ok`。

- [ ] **Step 5: 提交依赖**

```powershell
git add package.json package-lock.json
git commit -m "build: add news rich text dependencies"
```

---

### Task 2: 服务端富文本白名单与纯文本派生

**Files:**
- Create: `server/lib/newsRichText.js`
- Create: `server/lib/newsRichText.test.js`

- [ ] **Step 1: 写失败测试**

在 `server/lib/newsRichText.test.js` 覆盖以下真实输入：

```js
import { describe, expect, it } from 'vitest';
import { sanitizeNewsBodyHtml } from './newsRichText.js';

describe('sanitizeNewsBodyHtml', () => {
  it('keeps supported formatting and derives readable plain text', () => {
    const result = sanitizeNewsBodyHtml(
      '<h2 style="text-align:center">规则</h2><p><strong style="color:#ff0000;font-family:SimHei;font-size:20px">第一条</strong></p><ul><li>保持活跃</li></ul>',
    );
    expect(result.html).toContain('<h2 style="text-align:center">规则</h2>');
    expect(result.html).toContain('color:#ff0000');
    expect(result.html).toContain('<ul><li>保持活跃</li></ul>');
    expect(result.text).toMatch(/规则[\s\S]*第一条[\s\S]*保持活跃/);
  });

  it('removes executable markup and unsafe URLs', () => {
    const result = sanitizeNewsBodyHtml(
      '<script>alert(1)</script><p onclick="alert(2)">正文</p><a href="javascript:alert(3)">链接</a><img src="data:image/png;base64,abc" onerror="alert(4)">',
    );
    expect(result.html).toBe('<p>正文</p><a>链接</a>');
    expect(result.html).not.toMatch(/script|onclick|javascript:|data:|onerror/);
  });

  it('allows project images and rejects remote image hotlinks', () => {
    const result = sanitizeNewsBodyHtml(
      '<img src="/uploads/a.jpg" alt="A"><img src="/images/album/b.jpg" alt="B"><img src="https://example.com/c.jpg" alt="C">',
    );
    expect(result.html).toContain('/uploads/a.jpg');
    expect(result.html).toContain('/images/album/b.jpg');
    expect(result.html).not.toContain('example.com');
  });

  it('adds safe attributes to external links', () => {
    const result = sanitizeNewsBodyHtml('<a href="https://example.com/news">官网</a>');
    expect(result.html).toContain('target="_blank"');
    expect(result.html).toContain('rel="noopener noreferrer"');
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `npm test -- server/lib/newsRichText.test.js`

Expected: FAIL because `server/lib/newsRichText.js` does not exist。

- [ ] **Step 3: 实现最小清洗模块**

`sanitizeNewsBodyHtml(html)` 必须：

- 允许 `p,h2,h3,ul,ol,li,strong,em,u,s,span,a,img,br`。
- 只保留 `color`、`font-family`、`font-size`、`font-weight`、`text-align` 样式，值分别限制为十六进制/RGB 颜色、`Microsoft YaHei|SimHei|SimSun|KaiTi|sans-serif`、`14|16|18|20|24|28px`、`400|700`、`left|center|right`。
- 只允许 `/uploads/` 与 `/images/` 图片路径。
- 允许相对站内链接以及 `http`、`https`、`mailto`；外部 HTTP(S) 链接写入 `target="_blank" rel="noopener noreferrer"`。
- 返回 `{ html, text }`，其中 `text` 把块级节点分隔为换行、合并连续空白并清除首尾空白。

核心导出签名固定为：

```js
export function sanitizeNewsBodyHtml(html) {
  if (typeof html !== 'string') return { html: '', text: '' };
  const cleanHtml = sanitizeHtml(html, SANITIZE_OPTIONS);
  const text = convert(cleanHtml, {
    wordwrap: false,
    selectors: [
      { selector: 'img', format: 'skip' },
      { selector: 'a', options: { ignoreHref: true } },
    ],
  })
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { html: cleanHtml, text };
}
```

使用 `sanitize-html` 的 `transformTags` 和 `exclusiveFilter` 完成链接、图片规则，使用 `html-to-text` 从清洗后的 HTML 派生纯文本，不用正则直接解析 HTML。

- [ ] **Step 4: 运行测试确认 GREEN**

Run: `npm test -- server/lib/newsRichText.test.js`

Expected: 4 tests pass。

- [ ] **Step 5: 提交清洗模块**

```powershell
git add server/lib/newsRichText.js server/lib/newsRichText.test.js
git commit -m "feat: sanitize news rich text"
```

---

### Task 3: 配置存储接入富文本并兼容旧新闻

**Files:**
- Modify: `server/lib/configStore.js`
- Modify: `server/lib/configStore.test.js`
- Modify: `src/data/siteConfig.test.js`

- [ ] **Step 1: 写配置存储失败测试**

在 `server/lib/configStore.test.js` 新增：

```js
it('sanitizes news HTML and persists its derived plain text', async () => {
  const store = await createConfigStore({ dataDir });
  const config = await store.read();
  config.news[0].bodyHtml = '<h2>规则</h2><p onclick="bad()">安全正文</p><img src="/uploads/rule.jpg" alt="规则图">';
  config.news[0].body = '伪造正文';

  const saved = await store.write(config);

  expect(saved.news[0].bodyHtml).toContain('<h2>规则</h2><p>安全正文</p>');
  expect(saved.news[0].bodyHtml).toContain('/uploads/rule.jpg');
  expect(saved.news[0].body).toMatch(/规则[\s\S]*安全正文/);
});

it('rejects non-string and empty-after-sanitize rich text', async () => {
  const store = await createConfigStore({ dataDir });
  const config = await store.read();
  config.news[0].bodyHtml = 42;
  await expect(store.write(config)).rejects.toMatchObject({
    code: 'INVALID_CONFIG',
    details: expect.arrayContaining(['news[0].bodyHtml must be a string']),
  });

  config.news[0].bodyHtml = '<script>alert(1)</script>';
  await expect(store.write(config)).rejects.toMatchObject({
    code: 'INVALID_CONFIG',
    details: expect.arrayContaining(['news[0].bodyHtml must contain readable text']),
  });
});
```

在 `src/data/siteConfig.test.js` 新增：

```js
it('preserves optional news rich text without rewriting legacy news', () => {
  const legacy = structuredClone(teamData);
  expect(migrateRawConfig(legacy).news[0]).not.toHaveProperty('bodyHtml');
  legacy.news[0].bodyHtml = '<p><strong>富文本</strong></p>';
  expect(migrateRawConfig(legacy).news[0].bodyHtml).toBe('<p><strong>富文本</strong></p>');
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `npm test -- server/lib/configStore.test.js src/data/siteConfig.test.js`

Expected: FAIL because `bodyHtml` is neither validated nor sanitized and `body` is not derived。

- [ ] **Step 3: 接入清洗与校验**

在 `configStore.js`：

1. 导入 `sanitizeNewsBodyHtml`。
2. `validateConfig` 对存在的 `bodyHtml` 要求字符串。
3. 新增 `sanitizeNews(config)`，克隆每条新闻；空字符串保持为空，非空字符串清洗后必须产生非空 `text`，然后写入清洗后的 `bodyHtml` 与派生 `body`。
4. `write` 的顺序固定为：选择原始顶层字段并克隆 → 校验类型 → 清洗新闻 → 再校验 → 序列化与原子写盘。

固定接口：

```js
function sanitizeNews(config) {
  return {
    ...config,
    news: config.news.map((item, index) => {
      if (!item.bodyHtml?.trim()) return item;
      const richText = sanitizeNewsBodyHtml(item.bodyHtml);
      if (!richText.text) {
        const error = new Error('Invalid configuration');
        error.code = 'INVALID_CONFIG';
        error.details = [`news[${index}].bodyHtml must contain readable text`];
        throw error;
      }
      return { ...item, bodyHtml: richText.html, body: richText.text };
    }),
  };
}
```

`migrateRawConfig` 不增加 `bodyHtml` 默认值；其现有深克隆已自然保留该字段。

- [ ] **Step 4: 运行定向测试确认 GREEN**

Run: `npm test -- server/lib/configStore.test.js src/data/siteConfig.test.js`

Expected: 两个测试文件全部通过。

- [ ] **Step 5: 提交配置链路**

```powershell
git add server/lib/configStore.js server/lib/configStore.test.js src/data/siteConfig.test.js
git commit -m "feat: persist sanitized news articles"
```

---

### Task 4: Tiptap 编辑器与正文图片上传

**Files:**
- Create: `src/admin/RichTextEditor.jsx`
- Create: `src/admin/RichTextEditor.test.jsx`
- Modify: `src/test/setup.js`

- [ ] **Step 1: 写编辑器失败测试**

测试使用真实 `RichTextEditor`，仅模拟网络上传函数。为 jsdom 增加 ProseMirror 所需的 `document.elementFromPoint` 守卫，不模拟 Tiptap 编辑器本身。

核心测试：

```jsx
it('loads legacy text and reports HTML plus plain text changes', async () => {
  const onChange = vi.fn();
  render(<RichTextEditor html="" text="旧正文\n第二行" onChange={onChange} />);
  expect(screen.getByRole('textbox', { name: '新闻正文' })).toHaveTextContent('旧正文');
  expect(screen.getByRole('textbox', { name: '新闻正文' })).toHaveTextContent('第二行');
});

it('shows every confirmed formatting control', () => {
  render(<RichTextEditor html="<p>正文</p>" text="正文" onChange={vi.fn()} />);
  ['撤销', '重做', '粗体', '斜体', '下划线', '左对齐', '居中', '右对齐', '无序列表', '有序列表', '添加链接', '插入正文图片']
    .forEach((name) => expect(screen.getByRole('button', { name })).toBeInTheDocument());
  expect(screen.getByLabelText('段落格式')).toBeInTheDocument();
  expect(screen.getByLabelText('字体')).toBeInTheDocument();
  expect(screen.getByLabelText('字号')).toBeInTheDocument();
  expect(screen.getByLabelText('文字颜色')).toBeInTheDocument();
});

it('uploads multiple article images at the current selection', async () => {
  uploadFile
    .mockResolvedValueOnce({ path: '/uploads/a--第一张.jpg', type: 'image' })
    .mockResolvedValueOnce({ path: '/uploads/b--第二张.jpg', type: 'image' });
  const onChange = vi.fn();
  render(<RichTextEditor html="<p>正文</p>" text="正文" onChange={onChange} />);
  const picker = screen.getByLabelText('插入正文图片');
  await userEvent.upload(picker, new File(['a'], '第一张.jpg', { type: 'image/jpeg' }));
  await userEvent.upload(picker, new File(['b'], '第二张.jpg', { type: 'image/jpeg' }));
  expect(screen.getByRole('img', { name: '第一张.jpg' })).toHaveAttribute('src', '/uploads/a--第一张.jpg');
  expect(screen.getByRole('img', { name: '第二张.jpg' })).toHaveAttribute('src', '/uploads/b--第二张.jpg');
  expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('/uploads/b--第二张.jpg'), '正文');
});

it('keeps article content when an image upload fails', async () => {
  uploadFile.mockRejectedValueOnce(new Error('上传失败'));
  render(<RichTextEditor html="<p>保留正文</p>" text="保留正文" onChange={vi.fn()} />);
  await userEvent.upload(screen.getByLabelText('插入正文图片'), new File(['x'], '失败.jpg', { type: 'image/jpeg' }));
  expect(await screen.findByText('上传失败')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '新闻正文' })).toHaveTextContent('保留正文');
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `npm test -- src/admin/RichTextEditor.test.jsx`

Expected: FAIL because `RichTextEditor.jsx` does not exist。

- [ ] **Step 3: 实现编辑器扩展与受控回调**

使用以下扩展：

```js
StarterKit.configure({
  heading: { levels: [2, 3] },
  link: false,
  underline: false,
}),
TextStyle,
Color,
FontFamily,
FontSize,
Underline,
TextAlign.configure({ types: ['heading', 'paragraph'] }),
Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
Image.configure({ allowBase64: false }),
```

组件签名固定为：

```jsx
export function RichTextEditor({ html, text, onChange, onUploaded })
```

初始化内容使用 `html || text.split('\n').map(escapeTextAsParagraph).join('')`。`onUpdate` 调用：

```js
onChange(editor.getHTML(), editor.getText({ blockSeparator: '\n' }).trim());
```

工具栏使用 Lucide 图标按钮、原生 `select` 和原生颜色输入。字体只列出默认、微软雅黑、黑体、宋体、楷体；字号只列出 14、16、18、20、24、28px。链接按钮用 `window.prompt('请输入链接地址')` 获取地址；空地址取消命令，已有链接再次操作可移除。

图片上传流程固定为：文件选择 → `uploadFile(file)` → 检查 `result.type === 'image'` → `editor.chain().focus().setImage({ src: result.path, alt: file.name }).run()` → `onUploaded?.(result)`。失败时显示局部 `.admin-error`，不调用 `setContent`。

外部 `html` 变化时，仅在值确实不同且编辑器未聚焦时同步 `editor.commands.setContent`，避免每次输入重置光标。

- [ ] **Step 4: 运行编辑器测试确认 GREEN**

Run: `npm test -- src/admin/RichTextEditor.test.jsx`

Expected: 4 tests pass，无 React `act` 或 ProseMirror console error。

- [ ] **Step 5: 提交编辑器组件**

```powershell
git add src/admin/RichTextEditor.jsx src/admin/RichTextEditor.test.jsx src/test/setup.js
git commit -m "feat: add news rich text editor"
```

---

### Task 5: 新闻专属布局、封面图与折叠规则

**Files:**
- Modify: `src/admin/ConfigEditor.jsx`
- Modify: `src/admin/AdminApp.test.jsx`

- [ ] **Step 1: 写后台失败测试**

新增三条行为测试：

```jsx
it('collapses existing news into title category and date summaries', async () => {
  render(<ConfigEditor initialConfig={createSeedConfig()} onAuthError={() => false} />);
  const news = createSeedConfig().news[0];
  const button = screen.getByRole('button', { name: `展开 ${news.title}` });
  const card = button.closest('.array-item');
  expect(within(card).getByText(`${news.title} · ${news.category} · ${news.date}`)).toBeInTheDocument();
  expect(within(card).queryByLabelText('标题')).not.toBeInTheDocument();
  await userEvent.click(button);
  expect(within(card).getByLabelText('标题')).toHaveValue(news.title);
  expect(within(card).getByRole('textbox', { name: '新闻正文' })).toHaveTextContent(news.body);
});

it('opens a newly added news item and separates cover from article images', async () => {
  render(<ConfigEditor initialConfig={createSeedConfig()} onAuthError={() => false} />);
  const section = screen.getByRole('heading', { name: '新闻管理' }).closest('section');
  await userEvent.click(within(section).getByRole('button', { name: '新增' }));
  expect(within(section).getByLabelText('首页封面图上传')).toBeInTheDocument();
  expect(within(section).getByLabelText('插入正文图片')).toBeInTheDocument();
  expect(within(section).getByRole('textbox', { name: '新闻正文' })).toBeInTheDocument();
});

it('saves rich HTML together with its derived plain text', async () => {
  const config = createSeedConfig();
  config.news[0].bodyHtml = '<p><strong>新规则</strong></p>';
  render(<ConfigEditor initialConfig={config} onAuthError={() => false} />);
  await userEvent.click(screen.getByRole('button', { name: `展开 ${config.news[0].title}` }));
  await userEvent.click(screen.getByRole('button', { name: '保存全部配置' }));
  const saved = JSON.parse(fetch.mock.calls.findLast(([url]) => url === '/api/admin/config')[1].body);
  expect(saved.news[0].bodyHtml).toContain('<strong>新规则</strong>');
  expect(saved.news[0].body).toBe('新规则');
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `npm test -- src/admin/AdminApp.test.jsx`

Expected: FAIL because news cards are not collapsible and the rich editor is not connected。

- [ ] **Step 3: 实现新闻专属分支**

在 `ConfigEditor.jsx`：

- `empty.news` 增加 `bodyHtml: ''`。
- `ArrayItem` 的 `collapsible` 改为 `['roster', 'news'].includes(fieldKey)`。
- 新闻初始折叠值为 `fieldKey === 'news' && Boolean(item.title)`；成员仍默认展开。
- 新闻折叠摘要使用 `${title || '未填写标题'} · ${category || '未填写分类'} · ${date || '未填写日期'}`。
- 新增 `NewsFields` 组件，按确认顺序渲染字段；`imageSrc` 使用 `<UploadField label="首页封面图上传" allowedTypes={['image']}>`。
- `RichTextEditor` 的 `onChange(nextHtml, nextText)` 一次克隆 draft，并同时写入当前新闻的 `bodyHtml` 和 `body`。
- 通用对象树过滤新闻的 `bodyHtml` 与 `body`，避免再次生成普通文本输入框。

保持排序、删除、保存和上传素材列表刷新逻辑不变。

- [ ] **Step 4: 运行后台测试确认 GREEN**

Run: `npm test -- src/admin/AdminApp.test.jsx src/admin/RichTextEditor.test.jsx`

Expected: 两个测试文件全部通过。

- [ ] **Step 5: 提交后台集成**

```powershell
git add src/admin/ConfigEditor.jsx src/admin/AdminApp.test.jsx
git commit -m "feat: upgrade news management workflow"
```

---

### Task 6: 公开新闻弹窗渲染富文本和多图

**Files:**
- Modify: `src/components/NewsFeed.jsx`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: 写前台失败测试**

在 `src/App.test.jsx` 中直接渲染 `NewsFeed`，避免修改全局种子数据：

```jsx
it('renders rich news content, safe links and multiple inline images', async () => {
  const item = {
    ...teamData.news[0],
    bodyHtml: '<h2>比赛规则</h2><p style="color:#ff0000;font-family:SimHei;font-size:20px"><strong>重点</strong></p><ul><li>第一局</li></ul><a href="https://example.com" target="_blank" rel="noopener noreferrer">规则链接</a><img src="/uploads/a.jpg" alt="正文图一"><img src="/uploads/b.jpg" alt="正文图二">',
  };
  render(<NewsFeed items={[item]} />);
  await userEvent.click(screen.getByRole('button', { name: `查看资讯 ${item.title}` }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByRole('heading', { name: '比赛规则' })).toBeInTheDocument();
  expect(within(dialog).getByText('重点')).toHaveStyle({ color: '#ff0000', fontFamily: 'SimHei', fontSize: '20px' });
  expect(within(dialog).getByRole('list')).toHaveTextContent('第一局');
  expect(within(dialog).getByRole('link', { name: '规则链接' })).toHaveAttribute('rel', 'noopener noreferrer');
  expect(within(dialog).getByRole('img', { name: '正文图一' })).toBeInTheDocument();
  expect(within(dialog).getByRole('img', { name: '正文图二' })).toBeInTheDocument();
});

it('falls back to legacy plain news body', async () => {
  render(<NewsFeed items={[teamData.news[0]]} />);
  await userEvent.click(screen.getByRole('button', { name: `查看资讯 ${teamData.news[0].title}` }));
  expect(screen.getByRole('dialog')).toHaveTextContent(teamData.news[0].body);
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `npm test -- src/App.test.jsx`

Expected: rich content test fails because `bodyHtml` is rendered as neither elements nor images。

- [ ] **Step 3: 实现详情内容结构**

在 `NewsFeed.jsx`：

- 元信息同时展示分类与 `<time dateTime={selectedNews.date}>`。
- 封面图保留 `.news-cover-image`，不与正文图片共用选择器。
- 摘要使用 `.news-lead`。
- `bodyHtml` 非空时渲染：

```jsx
<div
  className="news-article-content"
  dangerouslySetInnerHTML={{ __html: selectedNews.bodyHtml }}
/>
```

- 否则渲染 `<p className="news-article-legacy">{selectedNews.body || selectedNews.summary}</p>`。

不在前端修改 HTML，不执行客户端迁移；服务端存储白名单是可信边界。

- [ ] **Step 4: 运行前台测试确认 GREEN**

Run: `npm test -- src/App.test.jsx`

Expected: `src/App.test.jsx` 全部通过。

- [ ] **Step 5: 提交前台展示**

```powershell
git add src/components/NewsFeed.jsx src/App.test.jsx
git commit -m "feat: render rich news articles"
```

---

### Task 7: 后台编辑器与新闻阅读样式

**Files:**
- Modify: `src/admin/admin.css`
- Modify: `src/styles/global.css`

- [ ] **Step 1: 为测试锁定必要结构类**

在 `RichTextEditor.test.jsx` 和 `App.test.jsx` 增加结构断言：

```js
expect(screen.getByRole('toolbar', { name: '正文格式工具栏' })).toHaveClass('rich-text-toolbar');
expect(screen.getByRole('textbox', { name: '新闻正文' })).toHaveClass('rich-text-content');
expect(screen.getByRole('dialog').querySelector('.news-article-content')).toBeInTheDocument();
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `npm test -- src/admin/RichTextEditor.test.jsx src/App.test.jsx`

Expected: FAIL until the semantic toolbar role and stable classes are present。

- [ ] **Step 3: 实现后台样式**

在 `admin.css` 增加：

- `.news-fields` 连续单列布局；基础字段在桌面端两列、移动端一列。
- `.rich-text-editor` 普通边框容器，圆角不超过 6px，不嵌套卡片阴影。
- `.rich-text-toolbar` 使用 `display:flex; flex-wrap:wrap; gap:4px`；控件最小触摸高度 36px，图标按钮有清晰 active 与 focus-visible 状态。
- `.rich-text-content` 最小高度 240px，正文段落和标题保持可读行高，图片 `max-width:100%; height:auto`。
- 390px 宽度下工具栏分组换行，选择框不撑破容器。

- [ ] **Step 4: 实现公开弹窗样式**

在 `global.css` 调整：

- `.news-modal` 最大高度 `min(90dvh, 900px)`，正文较长时自身纵向滚动。
- `.news-cover-image` 与 `.news-article-content img` 分开设置；正文图 `display:block; max-width:100%; height:auto; margin:20px auto`。
- `.news-lead` 与正文建立明确层次；正文标题、段落、列表和链接保持舒适阅读间距。
- `.news-article-content` 使用 `overflow-wrap:anywhere`，任何文字、链接和图片不产生横向溢出。
- 移动端弹窗使用接近全屏的稳定内边距，关闭按钮不遮挡标题。

- [ ] **Step 5: 运行结构测试确认 GREEN**

Run: `npm test -- src/admin/RichTextEditor.test.jsx src/App.test.jsx`

Expected: 两个测试文件全部通过。

- [ ] **Step 6: 提交样式**

```powershell
git add src/admin/RichTextEditor.test.jsx src/App.test.jsx src/admin/RichTextEditor.jsx src/admin/admin.css src/styles/global.css
git commit -m "style: polish news editing and reading"
```

---

### Task 8: 文档、全量验证与浏览器验收

**Files:**
- Modify: `docs/config-admin-guide.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: 更新后台操作指南**

在 `docs/config-admin-guide.md` 增加“新闻管理”章节，明确：

1. 已有新闻默认收起，新建新闻默认展开。
2. 首页封面图只用于列表和详情顶部。
3. 正文图片从编辑器工具栏上传，可在光标处重复插入。
4. 工具栏支持的格式范围。
5. 旧正文自动兼容，外部图片与不支持样式会被清理。

- [ ] **Step 2: 运行全量测试**

Run: `npm test -- --run`

Expected: 所有测试文件和测试项通过，无未处理异常或 React warning。

- [ ] **Step 3: 运行生产构建**

Run: `npm run build`

Expected: Vite production build succeeds；记录主前台 chunk 与后台相关 chunk 的变化，不声称 Tiptap 被动态拆包，除非构建输出实际证明。

- [ ] **Step 4: 启动 API 与前端开发服务器**

Run in separate terminals:

```powershell
$env:PORT=3000; $env:HOST='127.0.0.1'; npm run dev:api
npm run dev -- --host 127.0.0.1 --port 4173
```

Expected: API at `http://127.0.0.1:3000` and Vite at `http://127.0.0.1:4173`；若端口被占用，先检查是否为本项目现有服务，再使用空闲端口且不终止无关进程。

- [ ] **Step 5: 浏览器验收后台**

使用浏览器工具登录 `/admin`，在 390、768、1280 宽度验证：

- 已有新闻默认收起，摘要含标题、分类、日期。
- 新增新闻自动展开。
- 封面图与正文图片入口标签明确不同。
- 工具栏可换行，正文编辑区可输入、换行、加粗、改色、设置字体并插入两张图片。
- 保存后重新获取 `/api/admin/config`，`bodyHtml` 为清洗后的 HTML，`body` 为对应纯文本。
- `document.documentElement.scrollWidth === document.documentElement.clientWidth`。

- [ ] **Step 6: 浏览器验收公开弹窗**

在 390、768、1280 宽度打开同一新闻详情，验证：

- 首页列表只展示封面图。
- 弹窗展示封面、导语、标题/段落/颜色/字体/列表/链接和两张正文图。
- 长正文可滚动，关闭按钮可见，图片不变形。
- 页面与弹窗内容区均无横向溢出。
- 对旧新闻删除 `bodyHtml` 后，弹窗仍显示 `body`。

- [ ] **Step 7: 更新交接记录**

在 `AGENTS.md` 追加 2026-08-02 记录，写明实际新增字段、Tiptap 工具栏、折叠规则、多图上传、安全清洗、前台回退、测试数量、构建结果、三档浏览器结果和真实剩余风险。不得预填测试数量或声称未执行的验证。

- [ ] **Step 8: 最终差异检查**

Run:

```powershell
git diff --check
git status --short
git diff --stat
```

Expected: 无空白错误；改动只覆盖本计划文件及用户原有未提交改动，不删除或回滚任何既有工作。

- [ ] **Step 9: 提交文档与最终修正**

```powershell
git add docs/config-admin-guide.md AGENTS.md
git commit -m "docs: document news rich text workflow"
```

最终交付时报告测试、构建、浏览器地址、未提交工作区状态和剩余风险，不合并 Pit Wall 分支。
