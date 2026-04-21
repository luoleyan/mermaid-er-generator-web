import React, { useRef, useEffect, useMemo, useState } from 'react'
import { Card, Spin, Alert, Typography } from 'antd'
import mermaid from 'mermaid'

const { Text } = Typography

interface DiagramRendererProps {
  code: string
  theme?: string
  onRenderMetricsChange?: (metrics: { renderCount: number; skippedCount: number }) => void
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

const DiagramRenderer: React.FC<DiagramRendererProps> = ({ code, theme = 'default', onRenderMetricsChange }) => {
  const diagramRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const renderSeqRef = useRef(0)
  const lastRenderKeyRef = useRef<string>('')
  const lastThemeRef = useRef<string>('')
  const renderJobRef = useRef(0)
  const renderCountRef = useRef(0)
  const skippedCountRef = useRef(0)
  const safeCode = useMemo(() => sanitizeMermaidERCode(code), [code])

  useEffect(() => {
    if (!safeCode || !diagramRef.current) return

    let cancelled = false
    const currentJob = ++renderJobRef.current
    const timer = window.setTimeout(async () => {
      if (cancelled || currentJob !== renderJobRef.current) return
      setLoading(true)
      setError(null)

      try {
        const isDarkUI = !!document.querySelector('.app-root.theme-dark')
        const resolvedTheme = theme === 'default' && isDarkUI ? 'dark' : theme
        const renderKey = `${resolvedTheme}::${safeCode}`
        if (lastRenderKeyRef.current === renderKey) {
          skippedCountRef.current += 1
          onRenderMetricsChange?.({
            renderCount: renderCountRef.current,
            skippedCount: skippedCountRef.current
          })
          setLoading(false)
          return
        }

        if (lastThemeRef.current !== resolvedTheme) {
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'loose',
            theme: resolvedTheme,
            fontFamily: 'sans-serif'
          })
          lastThemeRef.current = resolvedTheme
        }

        renderSeqRef.current += 1
        const renderId = `er-diagram-${Date.now()}-${renderSeqRef.current}`
        const { svg } = await mermaid.render(renderId, safeCode)
        
        if (!cancelled && currentJob === renderJobRef.current && diagramRef.current) {
          diagramRef.current.innerHTML = ''
          diagramRef.current.innerHTML = svg
          lastRenderKeyRef.current = renderKey
          renderCountRef.current += 1
          onRenderMetricsChange?.({
            renderCount: renderCountRef.current,
            skippedCount: skippedCountRef.current
          })
        }
      } catch (err) {
        console.error('Error rendering diagram:', err)
        if (!cancelled && currentJob === renderJobRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram')
        }
      } finally {
        if (!cancelled && currentJob === renderJobRef.current) {
          setLoading(false)
        }
      }
    }, 120)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [safeCode, theme])

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