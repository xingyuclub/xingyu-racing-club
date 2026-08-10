import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  LoaderCircle,
  Redo2,
  UnderlineIcon,
  Undo2,
} from 'lucide-react';
import { uploadFile } from './adminApi.js';

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const createContent = (html, text) => html || String(text || '')
  .split(/\r?\n/)
  .map((line) => `<p>${escapeHtml(line)}</p>`)
  .join('');

function ToolButton({ label, active = false, disabled = false, onClick, children }) {
  return (
    <button
      className="rich-text-tool"
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({ html, text, onChange, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions: [
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
    ],
    content: createContent(html, text),
    editorProps: {
      attributes: {
        'aria-label': '新闻正文',
        'aria-multiline': 'true',
        class: 'rich-text-content',
        role: 'textbox',
      },
    },
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor: currentEditor }) => {
      onChangeRef.current(
        currentEditor.getHTML(),
        currentEditor.getText({ blockSeparator: '\n' }).trim(),
      );
    },
  });

  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const content = createContent(html, text);
    if (editor.getHTML() !== content) editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, html, text]);

  if (!editor) return <div className="rich-text-loading">正文编辑器加载中</div>;

  const setLink = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const href = window.prompt('请输入链接地址');
    if (href?.trim()) editor.chain().focus().setLink({ href: href.trim() }).run();
  };

  const uploadImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const result = await uploadFile(file);
      if (result.type !== 'image') throw new Error('正文只支持图片文件');
      editor.chain().focus().setImage({ src: result.path, alt: file.name }).run();
      onUploaded?.(result);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setUploading(false);
    }
  };

  const textStyle = editor.getAttributes('textStyle');
  const alignment = editor.getAttributes('paragraph').textAlign
    || editor.getAttributes('heading').textAlign
    || 'left';

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar" role="toolbar" aria-label="正文格式工具栏">
        <ToolButton label="撤销" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={16} /></ToolButton>
        <ToolButton label="重做" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={16} /></ToolButton>
        <select
          aria-label="段落格式"
          value={editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'}
          onChange={(event) => {
            const command = editor.chain().focus();
            if (event.target.value === 'p') command.setParagraph().run();
            else command.setHeading({ level: Number(event.target.value.slice(1)) }).run();
          }}
        >
          <option value="p">正文</option>
          <option value="h2">标题 2</option>
          <option value="h3">标题 3</option>
        </select>
        <select
          aria-label="字体"
          value={textStyle.fontFamily || ''}
          onChange={(event) => {
            const command = editor.chain().focus();
            if (event.target.value) command.setFontFamily(event.target.value).run();
            else command.unsetFontFamily().run();
          }}
        >
          <option value="">默认字体</option>
          <option value="Microsoft YaHei">微软雅黑</option>
          <option value="SimHei">黑体</option>
          <option value="SimSun">宋体</option>
          <option value="KaiTi">楷体</option>
        </select>
        <select
          aria-label="字号"
          value={textStyle.fontSize || ''}
          onChange={(event) => {
            const command = editor.chain().focus();
            if (event.target.value) command.setFontSize(event.target.value).run();
            else command.unsetFontSize().run();
          }}
        >
          <option value="">默认字号</option>
          {[14, 16, 18, 20, 24, 28].map((size) => <option key={size} value={`${size}px`}>{size}px</option>)}
        </select>
        <label className="rich-text-color" title="文字颜色">
          <span className="sr-only">文字颜色</span>
          <input
            aria-label="文字颜色"
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(textStyle.color || '') ? textStyle.color : '#17202a'}
            onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
          />
        </label>
        <ToolButton label="粗体" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} /></ToolButton>
        <ToolButton label="斜体" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} /></ToolButton>
        <ToolButton label="下划线" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={16} /></ToolButton>
        <ToolButton label="左对齐" active={alignment === 'left'} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft size={16} /></ToolButton>
        <ToolButton label="居中" active={alignment === 'center'} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter size={16} /></ToolButton>
        <ToolButton label="右对齐" active={alignment === 'right'} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight size={16} /></ToolButton>
        <ToolButton label="无序列表" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></ToolButton>
        <ToolButton label="有序列表" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></ToolButton>
        <ToolButton label="添加链接" active={editor.isActive('link')} onClick={setLink}><Link2 size={16} /></ToolButton>
        <label className={`rich-text-image-tool${uploading ? ' is-loading' : ''}`} title="插入正文图片">
          {uploading ? <LoaderCircle className="spin" size={16} /> : <ImagePlus size={16} />}
          <span>插入图片</span>
          <input aria-label="插入正文图片" type="file" accept="image/*" disabled={uploading} onChange={uploadImage} />
        </label>
      </div>
      <EditorContent editor={editor} />
      {error && <small className="admin-error">{error}</small>}
    </div>
  );
}
