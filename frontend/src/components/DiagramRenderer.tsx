import React, { useRef, useEffect } from 'react'
import { Card, Spin, Alert } from 'antd'
import mermaid from 'mermaid'

interface DiagramRendererProps {
  code: string
  theme?: string
}

const DiagramRenderer: React.FC<DiagramRendererProps> = ({ code, theme = 'default' }) => {
  const diagramRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        const { svg } = await mermaid.render('er-diagram', code)
        
        if (diagramRef.current) {
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
          <Text type="secondary">请输入 SQL 语句以生成 ER 图</Text>
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