import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('id');

/** Merge Tailwind classes dengan prioritas yang benar. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format tanggal: "5 September 2026". */
export function formatDate(date: string | Date) {
  return dayjs(date).format('D MMMM YYYY');
}

/** Waktu relatif: "2 jam yang lalu". */
export function formatRelative(date: string | Date) {
  return dayjs(date).fromNow();
}

/** Durasi dari menit: "1 jam 30 menit" / "45 menit". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} menit`;
  if (m === 0) return `${h} jam`;
  return `${h} jam ${m} menit`;
}

/** Format harga Rupiah: "Rp150.000". */
export function formatPrice(price: number): string {
  if (price === 0) return 'Gratis';
  return `Rp${price.toLocaleString('id-ID')}`;
}
