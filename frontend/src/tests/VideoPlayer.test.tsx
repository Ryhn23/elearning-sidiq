/**
 * VideoPlayer Component Tests
 * Verifies: correct src rendering, auto-complete trigger at ≥80%, speed controls
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// Mock the api module to avoid real HTTP calls in unit tests
vi.mock('@/lib/api', () => ({
  api: {
    patch: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

// Mock lucide-react icons (not relevant to functionality)
vi.mock('lucide-react', () => ({
  Gauge: () => <span data-testid="icon-gauge" />,
  RotateCcw: () => <span data-testid="icon-rotate" />,
}));

import VideoPlayer from '@/components/course/VideoPlayer';

const defaultProps = {
  src: '/uploads/videos/test-video.mp4',
  lessonId: 'lesson-123',
  sectionId: 'section-456',
  savedPositionSec: null,
  onAutoComplete: vi.fn(),
};

describe('VideoPlayer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the onAutoComplete mock
    defaultProps.onAutoComplete = vi.fn();
  });

  it('should render a video element with the correct src', () => {
    render(<VideoPlayer {...defaultProps} />);
    const video = document.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.src).toContain('test-video.mp4');
  });

  it('should render video with controls attribute', () => {
    render(<VideoPlayer {...defaultProps} />);
    const video = document.querySelector('video');
    expect(video?.controls).toBe(true);
  });

  it('should render speed control button', () => {
    render(<VideoPlayer {...defaultProps} />);
    const speedButton = screen.getByLabelText('Kecepatan putar');
    expect(speedButton).toBeTruthy();
    expect(speedButton.textContent).toContain('1x');
  });

  it('should call onAutoComplete when video reaches ≥80% progress', () => {
    const onAutoComplete = vi.fn();
    render(<VideoPlayer {...defaultProps} onAutoComplete={onAutoComplete} />);

    const video = document.querySelector('video') as HTMLVideoElement;
    expect(video).not.toBeNull();

    // Simulate video at 80% of total duration
    Object.defineProperty(video, 'duration', { value: 100, writable: true });
    Object.defineProperty(video, 'currentTime', { value: 80, writable: true });

    act(() => {
      video.dispatchEvent(new Event('timeupdate'));
    });

    expect(onAutoComplete).toHaveBeenCalledTimes(1);
  });

  it('should NOT call onAutoComplete when video is at < 80% progress', () => {
    const onAutoComplete = vi.fn();
    render(<VideoPlayer {...defaultProps} onAutoComplete={onAutoComplete} />);

    const video = document.querySelector('video') as HTMLVideoElement;

    Object.defineProperty(video, 'duration', { value: 100, writable: true });
    Object.defineProperty(video, 'currentTime', { value: 50, writable: true });

    act(() => {
      video.dispatchEvent(new Event('timeupdate'));
    });

    expect(onAutoComplete).not.toHaveBeenCalled();
  });

  it('should NOT call onAutoComplete twice (only fires once)', () => {
    const onAutoComplete = vi.fn();
    render(<VideoPlayer {...defaultProps} onAutoComplete={onAutoComplete} />);

    const video = document.querySelector('video') as HTMLVideoElement;

    Object.defineProperty(video, 'duration', { value: 100, writable: true });
    Object.defineProperty(video, 'currentTime', { value: 81, writable: true });

    act(() => {
      video.dispatchEvent(new Event('timeupdate'));
    });

    // Fire again at 95%
    Object.defineProperty(video, 'currentTime', { value: 95, writable: true });
    act(() => {
      video.dispatchEvent(new Event('timeupdate'));
    });

    // Should only have been called once
    expect(onAutoComplete).toHaveBeenCalledTimes(1);
  });

  it('should not show "resume from" message when savedPositionSec is null', () => {
    render(<VideoPlayer {...defaultProps} savedPositionSec={null} />);
    expect(screen.queryByText(/Melanjutkan dari menit/)).toBeNull();
  });
});
