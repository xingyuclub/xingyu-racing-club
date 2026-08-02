import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadFile } from './adminApi.js';
import { RichTextEditor } from './RichTextEditor.jsx';

vi.mock('./adminApi.js', () => ({ uploadFile: vi.fn() }));

describe('RichTextEditor', () => {
  beforeEach(() => {
    uploadFile.mockReset();
  });

  it('loads legacy text as paragraphs', () => {
    render(<RichTextEditor html="" text={'旧正文\n第二行'} onChange={vi.fn()} />);

    const editor = screen.getByRole('textbox', { name: '新闻正文' });
    expect(editor).toHaveTextContent('旧正文');
    expect(editor).toHaveTextContent('第二行');
    expect(editor.querySelectorAll('p')).toHaveLength(2);
  });

  it('shows every confirmed formatting control', () => {
    render(<RichTextEditor html="<p>正文</p>" text="正文" onChange={vi.fn()} />);

    [
      '撤销',
      '重做',
      '粗体',
      '斜体',
      '下划线',
      '左对齐',
      '居中',
      '右对齐',
      '无序列表',
      '有序列表',
      '添加链接',
    ].forEach((name) => expect(screen.getByRole('button', { name })).toBeInTheDocument());
    expect(screen.getByRole('toolbar', { name: '正文格式工具栏' })).toHaveClass('rich-text-toolbar');
    expect(screen.getByLabelText('段落格式')).toBeInTheDocument();
    expect(screen.getByLabelText('字体')).toBeInTheDocument();
    expect(screen.getByLabelText('字号')).toBeInTheDocument();
    expect(screen.getByLabelText('文字颜色')).toBeInTheDocument();
    expect(screen.getByLabelText('插入正文图片')).toBeInTheDocument();
  });

  it('emits paragraph breaks and bold formatting as HTML with plain text', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RichTextEditor html="" text="" onChange={onChange} />);
    const editor = screen.getByRole('textbox', { name: '新闻正文' });

    await user.click(editor);
    await user.type(editor, '第一行{enter}第二行');

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(
      '<p>第一行</p><p>第二行</p>',
      '第一行\n第二行',
    ));

    await user.keyboard('{Control>}a{/Control}');
    await user.click(screen.getByRole('button', { name: '粗体' }));

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(
      '<p><strong>第一行</strong></p><p><strong>第二行</strong></p>',
      '第一行\n第二行',
    ));
  });

  it('uploads multiple article images', async () => {
    const user = userEvent.setup();
    uploadFile
      .mockResolvedValueOnce({ path: '/uploads/a--第一张.jpg', type: 'image' })
      .mockResolvedValueOnce({ path: '/uploads/b--第二张.jpg', type: 'image' });
    const onChange = vi.fn();
    render(<RichTextEditor html="<p>正文</p>" text="正文" onChange={onChange} />);
    const picker = screen.getByLabelText('插入正文图片');

    await user.upload(picker, new File(['a'], '第一张.jpg', { type: 'image/jpeg' }));
    await user.upload(picker, new File(['b'], '第二张.jpg', { type: 'image/jpeg' }));

    expect(await screen.findByRole('img', { name: '第一张.jpg' })).toHaveAttribute('src', '/uploads/a--第一张.jpg');
    expect(screen.getByRole('img', { name: '第二张.jpg' })).toHaveAttribute('src', '/uploads/b--第二张.jpg');
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('/uploads/b--第二张.jpg'),
      '正文',
    ));
  });

  it('keeps article content when an image upload fails', async () => {
    const user = userEvent.setup();
    uploadFile.mockRejectedValueOnce(new Error('上传失败'));
    const onChange = vi.fn();
    render(<RichTextEditor html="<p>保留正文</p>" text="保留正文" onChange={onChange} />);

    await user.upload(
      screen.getByLabelText('插入正文图片'),
      new File(['x'], '失败.jpg', { type: 'image/jpeg' }),
    );

    expect(await screen.findByText('上传失败')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '新闻正文' })).toHaveTextContent('保留正文');
    expect(onChange).not.toHaveBeenCalled();
  });
});
