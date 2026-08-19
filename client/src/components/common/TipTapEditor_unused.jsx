import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Button, Space, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import reportTemplateService from '../../services/reportTemplateService';

const TipTapEditor = ({ value, onChange, placeholderText = 'Write something...' }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Placeholder.configure({ placeholder: placeholderText }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange && onChange(html);
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '');
    }
  }, [value, editor]);

  if (!editor) return null;

  const insertPlaceholder = (placeholder) => {
    editor.chain().focus().insertContent(placeholder).run();
  };

  const handleLogoUpload = async (file) => {
    const formData = new FormData();
    formData.append('logo', file);
    try {
      const res = await reportTemplateService.uploadLogo(formData);
      const logoUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}`.replace(/\/api$/, '') + res.data.logoPath;
      editor.chain().focus().setImage({ src: logoUrl }).run();
      message.success('Logo inserted');
    } catch (error) {
      message.error('Upload failed');
    }
    return false;
  };

  return (
    <div style={{ border: '1px solid #d9d9d9', borderRadius: 4 }}>
      <div style={{ padding: 8, borderBottom: '1px solid #d9d9d9', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Button size="small" onClick={() => editor.chain().focus().toggleBold().run()}>Bold</Button>
        <Button size="small" onClick={() => editor.chain().focus().toggleItalic().run()}>Italic</Button>
        <Button size="small" onClick={() => editor.chain().focus().toggleUnderline().run()}>Underline</Button>
        <Button size="small" onClick={() => editor.chain().focus().setParagraph().run()}>Paragraph</Button>
        <Button size="small" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</Button>
        <Button size="small" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Button>
        <Button size="small" onClick={() => insertPlaceholder('{{companyName}}')}>Company Name</Button>
        <Button size="small" onClick={() => insertPlaceholder('{{reportTitle}}')}>Report Title</Button>
        <Button size="small" onClick={() => insertPlaceholder('{{printedBy}}')}>Printed By</Button>
        <Button size="small" onClick={() => insertPlaceholder('{{printedDateTime}}')}>Date/Time</Button>
        <Button size="small" onClick={() => insertPlaceholder('{{footerText}}')}>Footer Text</Button>
        <Button size="small" onClick={() => insertPlaceholder('{{pageNumber}}')}>Page Number</Button>
        <Upload accept="image/*" showUploadList={false} beforeUpload={handleLogoUpload}>
          <Button size="small" icon={<UploadOutlined />}>Insert Logo</Button>
        </Upload>
      </div>
      <EditorContent editor={editor} style={{ minHeight: 100, padding: 8 }} />
    </div>
  );
};

export default TipTapEditor;