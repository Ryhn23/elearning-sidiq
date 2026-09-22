/**
 * RequireAuth Component Tests
 * Verifies access control redirect behavior for authenticated/unauthenticated users.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Mock Zustand auth store
const mockAuthStore = { token: null as string | null };

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (s: typeof mockAuthStore) => unknown) => selector(mockAuthStore),
}));

// Import AFTER mocking
import { RequireAuth } from '@/components/auth/RequireAuth';

function renderWithRouter(token: string | null) {
  mockAuthStore.token = token;

  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={
            <RequireAuth>
              <div data-testid="protected-content">Authenticated Content</div>
            </RequireAuth>
          }
        />
        <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RequireAuth Component', () => {
  beforeEach(() => {
    mockAuthStore.token = null;
  });

  it('should redirect to /login when user is unauthenticated (no token)', () => {
    renderWithRouter(null);
    // Should show login page, not protected content
    expect(screen.getByTestId('login-page')).toBeTruthy();
    expect(screen.queryByTestId('protected-content')).toBeNull();
  });

  it('should render children when user is authenticated (has token)', () => {
    renderWithRouter('valid.jwt.token');
    // Should show protected content, not login page
    expect(screen.getByTestId('protected-content')).toBeTruthy();
    expect(screen.queryByTestId('login-page')).toBeNull();
  });

  it('should redirect to /login when token is empty string', () => {
    renderWithRouter('');
    // Empty string is falsy → should redirect
    expect(screen.getByTestId('login-page')).toBeTruthy();
    expect(screen.queryByTestId('protected-content')).toBeNull();
  });
});
