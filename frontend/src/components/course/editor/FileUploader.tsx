import { useRef, useState } from 'react';
import { UploadCloud, FileVideo, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/Progress';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/useToast';

export interface UploadedFile {
  url: string;
  fileName: string;
  sizeBytes: number;
}

interface FileUploaderProps {
  kind: 'video' | 'document' | 'image' | 'assignment';
  hint?: string;
  /** Dipanggil setelah upload sukses. */
  onUploaded: (file: UploadedFile) => void;
  className?: string;
}

const ACCEPT: Record<FileUploaderProps['kind'], string> = {
  video: 'video/mp4,video/webm,video/quicktime,video/x-matroska',
  document: '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip',
  image: 'image/*',
  assignment: '.pdf,.doc,.docx,.zip,.rar,.txt,.md,image/*',
};

const KIND_ICON = {
  video: FileVideo,
  document: FileText,
  image: ImageIcon,
  assignment: UploadCloud,
} as const;

/**
 * Upload file ke POST /upload/:kind dengan progress bar (XHR).
 */
export default function FileUploader({ kind, hint, onUploaded, className }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const Icon = KIND_ICON[kind];

  function handleFile(file: File) {
    setUploading(true);
    setProgress(0);
    setFileName(file.name);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/v1/upload/${kind}`);
    const token = localStorage.getItem('token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      setUploading(false);
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          toast('Upload berhasil');
          onUploaded({ url: res.url, fileName: res.fileName ?? file.name, sizeBytes: res.sizeBytes ?? file.size });
        } else {
          setError(res.error || `Gagal upload (${xhr.status})`);
        }
      } catch {
        setError(`Gagal upload (${xhr.status})`);
      }
    };
    xhr.onerror = () => {
      setUploading(false);
      setError('Terjadi kesalahan jaringan saat upload.');
    };

    xhr.send(formData);
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[kind]}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />

      <div className="rounded-md border border-dashed border-border bg-muted/30 p-4">
        {uploading ? (
          <div className="space-y-2">
            <p className="truncate text-sm font-medium text-foreground">{fileName}</p>
            <Progress value={progress} />
            <p className="text-xs text-muted-foreground">Mengunggah... {progress}%</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 py-2 text-center"
          >
            <Icon className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Klik untuk pilih file</span>
            {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
          </button>
        )}
      </div>

      {error && !uploading && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-red-600">{error}</p>
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
            Coba lagi
          </Button>
        </div>
      )}

      {fileName && !uploading && !error && (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="hidden h-3 w-3" />
          Terunggah: <span className="font-medium text-foreground">{fileName}</span>
        </p>
      )}
    </div>
  );
}
