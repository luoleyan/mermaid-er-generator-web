import React from 'react'
import { App } from './App'

// Test setup file
import '@testing-library/jest-dom'

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock Monaco Editor
jest.mock('@monaco-editor/react', () => ({
  Editor: jest.fn(({ value, onChange, theme, options }) => (
    <textarea
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      data-testid="monaco-editor"
    />
  )),
}))

// Mock mermaid
jest.mock('mermaid', () => ({
  initialize: jest.fn(),
  render: jest.fn().mockResolvedValue({ svg: '<svg>Mock SVG</svg>' }),
}))

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    interceptors: {
      response: { use: jest.fn() },
      request: { use: jest.fn() },
    },
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  })),
}))

export default { App }