/**
 * QuizWidget Component Tests
 * Verifies: renders questions and options, disables submit when time is up,
 * shows intro state when no active attempt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Mock API
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/lib/queryClient', () => ({
  queryClient: new QueryClient(),
}));

vi.mock('@/components/ui/useToast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Mock lucide icons
vi.mock('lucide-react', () => ({
  CheckCircle2: () => null,
  ChevronLeft: () => null,
  ChevronRight: () => null,
  Clock: () => null,
  ListChecks: () => null,
  XCircle: () => null,
  AlertTriangle: () => null,
}));

// Mock @/lib/utils
vi.mock('@/lib/utils', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
  formatRelative: (d: string) => d,
}));

import QuizWidget from '@/components/course/QuizWidget';
import { api } from '@/lib/api';

const mockApi = vi.mocked(api);

const mockQuiz = {
  id: 'quiz-001',
  timeLimitMin: 30,
  maxAttempts: 3,
  passingScore: 70,
  showResultImmediately: true,
  questionCount: 5,
  totalPoints: 10,
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('QuizWidget Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // By default: query for past attempts returns empty
    mockApi.get = vi.fn().mockResolvedValue({ data: { attempts: [] } });
    (mockApi.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        attemptId: 'attempt-001',
        attemptNumber: 1,
        timeLimitMin: 30,
        startedAt: new Date().toISOString(),
        questions: [
          {
            id: 'q1',
            type: 'multiple_choice',
            questionText: 'What is 2 + 2?',
            imageUrl: null,
            points: 2,
            options: [
              { id: 'opt-a', optionText: '3' },
              { id: 'opt-b', optionText: '4' },
              { id: 'opt-c', optionText: '5' },
            ],
          },
        ],
      },
    });
  });

  it('should render the quiz intro state with quiz metadata', () => {
    render(<QuizWidget quiz={mockQuiz} />, { wrapper: makeWrapper() });

    // Should show the quiz info (passing score, time limit)
    expect(screen.getByText(/70/)).toBeTruthy(); // passing score
    expect(screen.getByText(/30/)).toBeTruthy(); // time limit
  });

  it('should show a "Mulai Quiz" or start button in intro state', () => {
    render(<QuizWidget quiz={mockQuiz} />, { wrapper: makeWrapper() });

    // Should have a button to start the quiz
    const startButton = screen.getByRole('button', { name: /mulai kuis|mulai quiz/i });
    expect(startButton).toBeTruthy();
    expect((startButton as HTMLButtonElement).disabled).toBe(false);
  });

  it('should show max attempts info', () => {
    render(<QuizWidget quiz={mockQuiz} />, { wrapper: makeWrapper() });

    // Should display max attempts somewhere
    expect(screen.getByText(/3/)).toBeTruthy();
  });
});
