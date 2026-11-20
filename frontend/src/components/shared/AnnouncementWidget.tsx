import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Bell, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  date: string;
  tag: string;
  variant?: 'emerald' | 'amber' | 'blue';
}

const DEFAULT_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: '1',
    title: 'Integrasi Akun Santri & Guru SIDIQ Aktif',
    content: 'Akun e-learning Anda kini tersinkronisasi otomatis dengan database pusat Pesantren SIDIQ. Nilai dan progres belajar dapat dipantau langsung.',
    date: 'Hari ini',
    tag: 'Sistem Terpadu',
    variant: 'emerald',
  },
  {
    id: '2',
    title: 'Jadwal Penilaian Akhir Semester Ganjil',
    content: 'Seluruh materi kuis dan tugas wajib diselesaikan sebelum batas waktu evaluasi akademik pesantren pada pekan depan.',
    date: '3 hari lalu',
    tag: 'Akademik',
    variant: 'amber',
  },
  {
    id: '3',
    title: 'Sertifikat Digital Otomatis Tersedia',
    content: 'Santri yang telah menuntaskan kursus dengan nilai kelulusan di atas 70 dapat langsung mengunduh sertifikat digital berbarcode.',
    date: 'Pekan ini',
    tag: 'Fitur Baru',
    variant: 'blue',
  },
];

export function AnnouncementWidget({ items = DEFAULT_ANNOUNCEMENTS }: { items?: AnnouncementItem[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const prev = () => {
    setCurrentIndex((i) => (i === 0 ? items.length - 1 : i - 1));
  };

  const next = () => {
    setCurrentIndex((i) => (i === items.length - 1 ? 0 : i + 1));
  };

  const active = items[currentIndex] || items[0];

  return (
    <Card className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-emerald-500/5 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              Pengumuman & Info Terkini
              <Sparkles className="h-3 w-3 text-amber-500" />
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-muted-foreground mr-1">
            {currentIndex + 1}/{items.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 rounded-lg hover:bg-muted"
            onClick={prev}
            title="Sebelumnya"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 rounded-lg hover:bg-muted"
            onClick={next}
            title="Berikutnya"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Badge
            variant={active.variant === 'emerald' ? 'success' : active.variant === 'amber' ? 'warning' : 'outline'}
            className="text-[10px] px-2 py-0.5"
          >
            {active.tag}
          </Badge>
          <span className="text-[10px] text-muted-foreground font-mono">{active.date}</span>
        </div>
        <h4 className="text-sm font-bold text-foreground leading-snug">
          {active.title}
        </h4>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {active.content}
        </p>
      </CardContent>
    </Card>
  );
}

export default AnnouncementWidget;
