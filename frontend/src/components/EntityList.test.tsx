import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import EntityList from '../components/EntityList'
import { SQLParseResult } from '../types'

// Mock mermaid
vi.mock('mermaid', () => ({
  initialize: vi.fn(),
  render: vi.fn().mockResolvedValue({ svg: '<svg>Mock SVG</svg>' }),
}))

describe('EntityList Component', () => {
  const mockParseResult: SQLParseResult = {
    entities: [
      {
        id: '1',
        name: 'users',
        columns: [
          {
            id: '1',
            name: 'id',
            type: 'INT',
            nullable: false,
            primaryKey: true
          },
          {
            id: '2',
            name: 'name',
            type: 'VARCHAR(100)',
            nullable: false,
            primaryKey: false
          }
        ],
        relationships: []
      }
    ],
    relationships: [
      {
        id: '1',
        from: 'users',
        to: 'posts',
        type: 'one-to-many',
        fromColumn: 'id',
        toColumn: 'user_id'
      }
    ],
    errors: []
  }

  it('renders entity list with data', () => {
    render(<EntityList data={mockParseResult} />)
    
    expect(screen.getByText('实体列表 (1)')).toBeInTheDocument()
    expect(screen.getByText('关系列表 (1)')).toBeInTheDocument()
    expect(screen.getByText('users')).toBeInTheDocument()
    expect(screen.getByText('posts')).toBeInTheDocument()
  })

  it('renders error message when there are parsing errors', () => {
    const errorResult: SQLParseResult = {
      entities: [],
      relationships: [],
      errors: ['SQL syntax error']
    }
    
    render(<EntityList data={errorResult} />)
    
    expect(screen.getByText('SQL 解析错误')).toBeInTheDocument()
    expect(screen.getByText('SQL syntax error')).toBeInTheDocument()
  })

  it('renders empty state when no entities', () => {
    const emptyResult: SQLParseResult = {
      entities: [],
      relationships: [],
      errors: []
    }
    
    render(<EntityList data={emptyResult} />)
    
    expect(screen.getByText('暂无实体')).toBeInTheDocument()
    expect(screen.getByText('暂无关系')).toBeInTheDocument()
  })
})