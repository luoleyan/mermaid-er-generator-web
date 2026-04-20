import React, { useRef, useEffect, useState } from 'react'
import { Card, Spin, Alert, Typography } from 'antd'
import mermaid from 'mermaid'

const { Text } = Typography

interface DiagramRendererProps {
  code: string
  theme?: string
}

const sanitizeMermaidERCode = (source: string): string => {
  if (!source.trimStart().startsWith('erDiagram')) {
    return source
  }

  const lines = source.split('\n')
  const normalizedLines: string[] = []
  let inEntityBlock = false

  for (const rawLine of lines) {
    let line = rawLine
    const trimmed = line.trim()

    if (trimmed.endsWith('{')) {
      inEntityBlock = true
      normalizedLines.push(line)
      continue
    }

    if (trimmed === '}') {
      inEntityBlock = false
      normalizedLines.push(line)
      continue
    }

    if (inEntityBlock) {
      // Skip table-level SQL constraints unsupported by Mermaid ER attribute grammar
      if (
        /^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE\s+KEY|UNIQUE\s*\(|KEY\s+|CONSTRAINT\s+)/i.test(trimmed)
      ) {
        continue
      }

      // Strip SQL-style constraints not supported in Mermaid ER attribute definitions
      line = line
        .replace(/\s+NOT\s+NULL\b/gi, '')
        .replace(/\s+NULL\b/gi, '')
        .replace(/\s+DEFAULT\s+('[^']*'|"[^"]*"|`[^`]*`|[^\s]+(?:\s+[^\s]+)*)/gi, '')
        .replace(/\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP\b/gi, '')
        .replace(/\s+AUTO_INCREMENT\b/gi, '')
        .replace(/\s+COMMENT\s+('[^']*'|"[^"]*"|`[^`]*`)/gi, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+$/, '')
    } else {
      // Only normalize obviously unsafe quoted labels in relationship lines
      line = line.replace(/(['"`])([^'"`]+)\1/g, (_, __, value: string) => {
        const compact = value.trim().replace(/[^\w.\-:]+/g, '_').replace(/^_+|_+$/g, '')
        return compact || 'VALUE'
      })
    }

    normalizedLines.push(line)
  }

  return normalizedLines.join('\n')
}

const DiagramRenderer: React.FC<DiagramRendererProps> = ({ code, theme = 'default' }) => {
  const diagramRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const renderSeqRef = useRef(0)

  useEffect(() => {
    if (!code || !diagramRef.current) return

    const renderDiagram = async () => {
      setLoading(true)
      setError(null)

      try {
        // Initialize mermaid
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme,
          fontFamily: 'sans-serif'
        })

        // Render diagram
        const safeCode = sanitizeMermaidERCode(code)
        renderSeqRef.current += 1
        const renderId = `er-diagram-${Date.now()}-${renderSeqRef.current}`
        const { svg } = await mermaid.render(renderId, safeCode)
        
        if (diagramRef.current) {
          diagramRef.current.innerHTML = ''
          diagramRef.current.innerHTML = svg
        }
      } catch (err) {
        console.error('Error rendering diagram:', err)
        setError(err instanceof Error ? err.message : 'Failed to render diagram')
      } finally {
        setLoading(false)
      }
    }

    renderDiagram()
  }, [code, theme])

  if (loading) {
    return (
      <Card title="ER 图">
        <div className="loading-spinner">
          <Spin size="large" />
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card title="ER 图">
        <Alert message="图表渲染错误" description={error} type="error" showIcon />
      </Card>
    )
  }

  if (!code) {
    return (
      <Card title="ER 图">
        <div className="diagram-container">
          <Text type="secondary">请输入 Mermaid 代码以生成 ER 图</Text>
        </div>
      </Card>
    )
  }

  return (
    <Card title="ER 图">
      <div 
        ref={diagramRef} 
        className="diagram-container"
        style={{ minHeight: 400 }}
      />
    </Card>
  )
}

export default DiagramRenderer