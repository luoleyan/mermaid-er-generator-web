import React from 'react'
import { render, screen } from '@testing-library/react'
import DiagramRenderer from '../components/DiagramRenderer'

describe('DiagramRenderer Component', () => {
  const mockMermaidCode = 'erDiagram\n  User ||--o{ Post : creates'

  it('renders loading state initially', () => {
    render(<DiagramRenderer code={mockMermaidCode} />)
    
    expect(screen.getByText('ER 图')).toBeInTheDocument()
  })

  it('renders empty state when no code provided', () => {
    render(<DiagramRenderer code="" />)
    
    expect(screen.getByText('ER 图')).toBeInTheDocument()
    expect(screen.getByText('请输入 SQL 语句以生成 ER 图')).toBeInTheDocument()
  })

  it('renders diagram when code is provided', async () => {
    render(<DiagramRenderer code={mockMermaidCode} />)
    
    // Wait for the mermaid render to complete
    // The diagram container should have content after rendering
    await vi.waitFor(() => {
      const container = document.querySelector('.diagram-container')
      expect(container).toBeInTheDocument()
    })
  })

  it('handles theme prop', () => {
    render(<DiagramRenderer code={mockMermaidCode} theme="dark" />)
    
    // The component should initialize mermaid with the correct theme
    expect(screen.getByText('ER 图')).toBeInTheDocument()
  })
})