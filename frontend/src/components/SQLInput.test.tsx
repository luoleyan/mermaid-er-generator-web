import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import SQLInput from '../components/SQLInput'
import { sqlService } from '../services/api'

// Mock the api service
vi.mock('../services/api', () => ({
  sqlService: {
    parse: vi.fn(),
    generateDiagram: vi.fn(),
  },
}))

describe('SQLInput Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders SQL editor input', () => {
    render(<SQLInput />)
    
    expect(screen.getByText('SQL 输入')).toBeInTheDocument()
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument()
  })

  it('handles SQL input change', () => {
    render(<SQLInput />)
    
    const editor = screen.getByTestId('monaco-editor')
    fireEvent.change(editor, { target: { value: 'CREATE TABLE users (id INT);' } })
    
    expect(editor).toHaveValue('CREATE TABLE users (id INT);')
  })

  it('calls parse API when parse button is clicked', async () => {
    const mockParseResponse = {
      success: true,
      data: {
        entities: [],
        relationships: [],
        errors: []
      }
    }
    
    vi.mocked(sqlService.parse).mockResolvedValue(mockParseResponse)
    
    render(<SQLInput />)
    
    fireEvent.change(screen.getByTestId('monaco-editor'), {
      target: { value: 'CREATE TABLE users (id INT);' }
    })
    
    fireEvent.click(screen.getByText('解析 SQL'))
    
    await waitFor(() => {
      expect(sqlService.parse).toHaveBeenCalledWith('CREATE TABLE users (id INT);')
    })
  })

  it('shows error message when parse fails', async () => {
    const mockErrorResponse = {
      success: false,
      error: 'SQL syntax error'
    }
    
    vi.mocked(sqlService.parse).mockResolvedValue(mockErrorResponse)
    
    render(<SQLInput />)
    
    fireEvent.change(screen.getByTestId('monaco-editor'), {
      target: { value: 'INVALID SQL' }
    })
    
    fireEvent.click(screen.getByText('解析 SQL'))
    
    await waitFor(() => {
      expect(screen.getByText('解析失败，请检查 SQL 语法')).toBeInTheDocument()
    })
  })

  it('handles theme change', () => {
    render(<SQLInput />)
    
    // Use getByRole to find the select combobox
    const themeSelect = screen.getByRole('combobox')
    fireEvent.mouseDown(themeSelect)
    
    // Wait for the dropdown to open and find the option
    const darkOption = screen.getByText('深色')
    fireEvent.click(darkOption)
    
    // Check that the selection changed
    expect(screen.getByTitle('深色')).toBeInTheDocument()
  })
})