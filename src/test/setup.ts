import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock IndexedDB for jsdom
import 'fake-indexeddb/auto';

// Mock Firebase
vi.mock('@/config/firebase', () => ({
  getFirestoreInstancePublic: vi.fn(),
  getAuthInstancePublic: vi.fn(),
  enableOfflineSupport: vi.fn(),
  disableOfflineSupport: vi.fn(),
  enableOnlineSupport: vi.fn(),
}));

// Mock Supabase
vi.mock('@/config/supabase', () => ({
  callEdgeFunction: vi.fn(),
  isSupabaseConfigured: vi.fn(() => false),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Clean up after each test
afterEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});
