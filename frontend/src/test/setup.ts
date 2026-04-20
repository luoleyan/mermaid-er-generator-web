import React from 'react'
import { vi } from 'vitest'

// Test setup file
import '@testing-library/jest-dom/vitest'

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  Editor: vi.fn(({ value, onChange }) => {
    return React.createElement('textarea', {
      value: value,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange?.(e.target.value),
      'data-testid': 'monaco-editor'
    });
  }),
}))

// Mock mermaid
vi.mock('mermaid', () => ({
  initialize: vi.fn(),
  render: vi.fn().mockResolvedValue({ svg: '<svg>Mock SVG</svg>' }),
}))

// Mock axios
vi.mock('axios', () => ({
  create: vi.fn(() => ({
    interceptors: {
      response: { use: vi.fn() },
      request: { use: vi.fn() },
    },
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  })),
}))

export {}
