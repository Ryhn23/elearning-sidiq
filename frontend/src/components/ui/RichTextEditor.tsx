import { useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Eye,
  Edit3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitizeHtml } from '@/lib/sanitize';

interface RichTextEditorProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
}

export function RichTextEditor({
  label,
  value,
  onChange,
  placeholder = 'Tulis materi atau gunakan tombol format di atas...',
  rows = 8,
  disabled = false,
  className,
}: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<'write' | 'preview'>('write');

  /**
   * Helper to insert opening and closing tags around selected text,
   * or insert default text if no text is selected.
   */
  const insertTag = (openTag: string, closeTag: string, defaultText = 'teks') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const content = selectedText || defaultText;

    const replacement = `${openTag}${content}${closeTag}`;
    const newValue = value.substring(0, start) + replacement + value.substring(end);
    onChange(newValue);

    // Reposition cursor
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + openTag.length + content.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleBold = () => insertTag('<strong>', '</strong>', 'teks tebal');
  const handleItalic = () => insertTag('<em>', '</em>', 'teks miring');
  const handleUnderline = () => insertTag('<u>', '</u>', 'teks garis bawah');
  const handleH2 = () => insertTag('\n<h2>', '</h2>\n', 'Judul Bagian');
  const handleH3 = () => insertTag('\n<h3>', '</h3>\n', 'Subjudul');
  const handleBulletList = () =>
    insertTag('\n<ul>\n  <li>', '</li>\n  <li>Poin kedua</li>\n</ul>\n', 'Poin pertama');
  const handleOrderedList = () =>
    insertTag('\n<ol>\n  <li>', '</li>\n  <li>Langkah kedua</li>\n</ol>\n', 'Langkah pertama');
  const handleQuote = () =>
    insertTag(
      '\n<blockquote class="border-l-4 border-primary-500 pl-3 italic my-2">\n  ',
      '\n</blockquote>\n',
      'Kutipan atau catatan penting'
    );
  const handleCode = () =>
    insertTag(
      '\n<pre class="bg-muted p-2 rounded text-xs font-mono overflow-x-auto my-2"><code>',
      '</code></pre>\n',
      '// kode di sini'
    );
  const handleLink = () => {
    const url = window.prompt('Masukkan alamat URL (contoh: https://example.com):');
    if (!url) return;
    insertTag(
      `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary-600 underline">`,
      '</a>',
      'Tautan'
    );
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">{label}</label>
          <div className="flex rounded-md border border-border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setTab('write')}
              className={cn(
                'flex items-center gap-1 rounded px-2.5 py-1 font-medium transition-colors cursor-pointer',
                tab === 'write'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Edit3 className="h-3 w-3" /> Tulis
            </button>
            <button
              type="button"
              onClick={() => setTab('preview')}
              className={cn(
                'flex items-center gap-1 rounded px-2.5 py-1 font-medium transition-colors cursor-pointer',
                tab === 'preview'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Eye className="h-3 w-3" /> Pratinjau
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-background shadow-xs focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500">
        {/* Toolbar */}
        {tab === 'write' && (
          <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 p-1.5">
            <button
              type="button"
              title="Tebal (Bold)"
              disabled={disabled}
              onClick={handleBold}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 cursor-pointer"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Miring (Italic)"
              disabled={disabled}
              onClick={handleItalic}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 cursor-pointer"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Garis Bawah (Underline)"
              disabled={disabled}
              onClick={handleUnderline}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 cursor-pointer"
            >
              <Underline className="h-3.5 w-3.5" />
            </button>
            <div className="h-4 w-px bg-border mx-0.5" />
            <button
              type="button"
              title="Judul Bagian (H2)"
              disabled={disabled}
              onClick={handleH2}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 cursor-pointer"
            >
              <Heading2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Subjudul (H3)"
              disabled={disabled}
              onClick={handleH3}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 cursor-pointer"
            >
              <Heading3 className="h-3.5 w-3.5" />
            </button>
            <div className="h-4 w-px bg-border mx-0.5" />
            <button
              type="button"
              title="Daftar Poin (Bullet List)"
              disabled={disabled}
              onClick={handleBulletList}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 cursor-pointer"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Daftar Angka (Numbered List)"
              disabled={disabled}
              onClick={handleOrderedList}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 cursor-pointer"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </button>
            <div className="h-4 w-px bg-border mx-0.5" />
            <button
              type="button"
              title="Kutipan (Quote)"
              disabled={disabled}
              onClick={handleQuote}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 cursor-pointer"
            >
              <Quote className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Blok Kode"
              disabled={disabled}
              onClick={handleCode}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 cursor-pointer"
            >
              <Code className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Tautan Web (Link)"
              disabled={disabled}
              onClick={handleLink}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 cursor-pointer"
            >
              <LinkIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Content Area */}
        {tab === 'write' ? (
          <textarea
            ref={textareaRef}
            rows={rows}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full resize-y bg-transparent p-3 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        ) : (
          <div
            className="prose prose-sm dark:prose-invert min-h-[160px] max-w-none p-4 text-foreground leading-relaxed overflow-x-auto"
            dangerouslySetInnerHTML={{
              __html:
                sanitizeHtml(value) ||
                '<p class="italic text-muted-foreground">Belum ada konten untuk dipratinjau.</p>',
            }}
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Mendukung tag HTML standar (<code className="text-xs font-mono">&lt;p&gt;</code>,{' '}
        <code className="text-xs font-mono">&lt;strong&gt;</code>,{' '}
        <code className="text-xs font-mono">&lt;ul&gt;</code>, dll.) atau gunakan tombol toolbar di atas.
      </p>
    </div>
  );
}
export default RichTextEditor;
