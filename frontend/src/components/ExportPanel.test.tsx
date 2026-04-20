import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import ExportPanel from '../components/ExportPanel'
import { exportService } from '../services/api'

// Mock the export service
vi.mock('../services/api', () => ({
  exportService: {
    exportSVG: vi.fn(),
    exportPNG: vi.fn(),
    exportPDF: vi.fn(),
  },
}))

describe('ExportPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock successful export
    vi.mocked(exportService.exportSVG).mockResolvedValue(new Blob(['test'], { type: 'image/svg+xml' }))
    vi.mocked(exportService.exportPNG).mockResolvedValue(new Blob(['test'], { type: 'image/png' }))
    vi.mocked(exportService.exportPDF).mockResolvedValue(new Blob(['test'], { type: 'application/pdf' }))
  })

  it('renders export buttons', () => {
    render(<ExportPanel sql="CREATE TABLE users (id INT);" />)
    
    expect(screen.getByText('导出选项')).toBeInTheDocument()
    expect(screen.getByText('导出 SVG')).toBeInTheDocument()
    expect(screen.getByText('导出 PNG')).toBeInTheDocument()
    expect(screen.getByText('导出 PDF')).toBeInTheDocument()
  })

  it('calls export service when SVG button is clicked', async () => {
    render(<ExportPanel sql="CREATE TABLE users (id INT);" />)
    
    fireEvent.click(screen.getByText('导出 SVG'))
    
    await waitFor(() => {
      expect(exportService.exportSVG).toHaveBeenCalledWith('CREATE TABLE users (id INT);', 'default')
    })
  })

  it('shows error when no SQL is provided', async () => {
    render(<ExportPanel sql="" />)
    
    fireEvent.click(screen.getByText('导出 SVG'))
    
    await waitFor(() => {
      expect(screen.getByText('请先输入 SQL 语句')).toBeInTheDocument()
    })
  })

  it('handles loading state', async () => {
    // Mock slow export
    vi.mocked(exportService.exportSVG).mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 1000))
    )
    
    render(<ExportPanel sql="CREATE TABLE users (id INT);" />)
    
    fireEvent.click(screen.getByText('导出 SVG'))
    
    expect(screen.getByText('导出 SVG')).toBeDisabled()
    
    await waitFor(() => {
      expect(screen.getByText('导出 SVG')).not.toBeDisabled()
    }, { timeout: 2000 })
  })
})