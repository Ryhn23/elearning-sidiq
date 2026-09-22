import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Landing from '@/pages/Landing';

// Mock api to avoid network calls during render
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      data: {
        data: [
          {
            id: 'c-1',
            title: 'Dasar Pemrograman Web Modern',
            slug: 'dasar-pemrograman-web-modern',
            shortDescription: 'Pelajari HTML, CSS, JavaScript hingga mahir',
            thumbnailUrl: null,
            level: 'beginner',
            price: 0,
            averageRating: 4.8,
            reviewCount: 24,
            totalEnrolled: 120,
            instructor: { id: 'inst-1', name: 'Dr. Andi Wijaya' },
            category: { id: 'cat-1', name: 'Pemrograman Web' },
          },
        ],
      },
    }),
  },
}));

function renderLanding() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Landing />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Landing Page Component', () => {
  it('renders hero section and brand title', () => {
    renderLanding();
    expect(screen.getByText(/Platform LMS Terinspirasi Standar Moodle/i)).toBeTruthy();
    expect(screen.getByText(/Tingkatkan Keterampilanmu dengan/i)).toBeTruthy();
    expect(screen.getByText(/Pembelajaran Terstruktur/i)).toBeTruthy();
  });

  it('renders call-to-action buttons for registration and course exploration', () => {
    renderLanding();
    const ctaButtons = screen.getAllByText(/Jelajahi Katalog Kursus/i);
    expect(ctaButtons.length).toBeGreaterThan(0);
    const registerButtons = screen.getAllByText(/Daftar Sekarang/i);
    expect(registerButtons.length).toBeGreaterThan(0);
  });

  it('renders key value proposition feature cards', () => {
    renderLanding();
    expect(screen.getByText(/Pemutar Video Pintar/i)).toBeTruthy();
    expect(screen.getByText(/Kuis & Ujian Terukur/i)).toBeTruthy();
    expect(screen.getByText(/Sertifikat Resmi & QR Code/i)).toBeTruthy();
    expect(screen.getByText(/Kelas Sinkron via Zoom/i)).toBeTruthy();
  });

  it('renders highlights and statistics section', () => {
    renderLanding();
    expect(screen.getByText('500+')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getByText('Otomatis')).toBeTruthy();
    expect(screen.getByText('Zoom Ready')).toBeTruthy();
  });

  it('renders footer with navigation links', () => {
    renderLanding();
    expect(screen.getByText(/Hak Cipta Dilindungi/i)).toBeTruthy();
  });
});
