import { useEffect, useRef, useState } from 'react';
import { Gauge, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];

interface VideoPlayerProps {
  src: string;
  lessonId: string;
  sectionId: string;
  savedPositionSec?: number | null;
  /** Dipanggil sekali saat video mencapai >=80% (auto-complete). */
  onAutoComplete: () => void;
}

export default function VideoPlayer({ src, lessonId, sectionId, savedPositionSec, onAutoComplete }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSavedRef = useRef<number>(savedPositionSec ?? 0);
  const autoDoneRef = useRef(false);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [resumedFrom, setResumedFrom] = useState<number | null>(null);

  // Resume dari posisi tersimpan
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const saved = savedPositionSec ?? 0;
    const onMeta = () => {
      if (saved > 5 && saved < v.duration - 5) {
        v.currentTime = saved;
        setResumedFrom(saved);
      }
    };
    v.addEventListener('loadedmetadata', onMeta, { once: true });
    return () => v.removeEventListener('loadedmetadata', onMeta);
  }, [src, savedPositionSec]);

  // Simpan posisi tiap 10 detik + saat unmount
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const save = async (position: number) => {
      try {
        await api.patch(`/sections/${sectionId}/lessons/${lessonId}/video-position`, { positionSec: Math.floor(position) });
        lastSavedRef.current = position;
      } catch {
        // abaikan — posisi video bukan fitur kritis
      }
    };

    const interval = setInterval(() => {
      if (!v.paused && v.currentTime > lastSavedRef.current + 5) save(v.currentTime);
    }, 10000);

    const onUnload = () => {
      if (v.currentTime > lastSavedRef.current + 2) void save(v.currentTime);
    };
    v.addEventListener('pause', onUnload);
    return () => {
      clearInterval(interval);
      v.removeEventListener('pause', onUnload);
      // Simpan saat keluar halaman
      if (!v.paused && v.currentTime > lastSavedRef.current + 2) void save(v.currentTime);
    };
  }, [src, lessonId, sectionId]);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration || autoDoneRef.current) return;
    // Auto-complete setelah 80% ditonton
    if (v.currentTime / v.duration >= 0.8) {
      autoDoneRef.current = true;
      onAutoComplete();
    }
  };

  const changeSpeed = (s: number) => {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
    setSpeedMenuOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-md bg-slate-900">
        <video
          ref={videoRef}
          src={src}
          controls
          playsInline
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          className="aspect-video w-full"
        />
      </div>

      {resumedFrom !== null && (
        <p className="text-xs text-muted-foreground">
          Melanjutkan dari menit ke-{Math.floor(resumedFrom / 60)}:
          {String(Math.floor(resumedFrom % 60)).padStart(2, '0')}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="relative">
          <button
            onClick={() => setSpeedMenuOpen((o) => !o)}
            aria-label="Kecepatan putar"
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <Gauge className="h-3.5 w-3.5" /> {speed}x
          </button>
          {speedMenuOpen && (
            <div className="absolute bottom-full left-0 z-10 mb-1 rounded-md border border-border bg-background p-1 shadow-md">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => changeSpeed(s)}
                  className={cn(
                    'block w-full rounded px-3 py-1 text-left text-xs hover:bg-muted',
                    s === speed ? 'font-semibold text-primary-600' : 'text-foreground',
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RotateCcw className="h-3 w-3" /> Posisi tersimpan otomatis
        </p>
      </div>
    </div>
  );
}
