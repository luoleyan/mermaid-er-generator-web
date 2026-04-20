import React from 'react'
import { Button, Card, Col, Input, Row, Select, Space, Typography } from 'antd'
import { ThunderboltOutlined, CopyOutlined } from '@ant-design/icons'
import DiagramRenderer from './DiagramRenderer'
import { ViewMode } from '../types'
import { sqlService } from '../services/api'
import { notify } from '../utils/notify'

const { Paragraph, Text } = Typography
const { TextArea } = Input

const defaultCode = `erDiagram
  USER {
    int id PK
    string email
  }
  ORDER {
    int id PK
    int user_id FK
  }
  USER ||--o{ ORDER : places`

const MermaidWorkspace: React.FC = () => {
  const [theme, setTheme] = React.useState('default')
  const [viewMode, setViewMode] = React.useState<ViewMode>('classic')
  const [chenPinnedEntities, setChenPinnedEntities] = React.useState<string[]>(['USERS', 'ARTICLES'])
  const [sourceCode, setSourceCode] = React.useState(defaultCode)
  const [diagramCode, setDiagramCode] = React.useState(defaultCode)
  const [loading, setLoading] = React.useState(false)
  const [activeSection, setActiveSection] = React.useState<'source' | 'result'>('source')
  const sourceSectionRef = React.useRef<HTMLDivElement | null>(null)
  const resultSectionRef = React.useRef<HTMLDivElement | null>(null)

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const copyConverted = async () => {
    try {
      await navigator.clipboard.writeText(diagramCode)
      notify.success('转换后代码已复制')
    } catch (error) {
      notify.error('复制失败，请手动复制')
    }
  }

  const handleTransform = React.useCallback(async () => {
    if (!sourceCode.trim()) {
      notify.warning('请输入 Mermaid 或 SQL 代码')
      return
    }

    setLoading(true)
    try {
      const response = await sqlService.transformPreview(
        sourceCode,
        viewMode,
        theme,
        chenPinnedEntities
      )
      if (response.success && response.data?.diagramCode) {
        setDiagramCode(response.data.diagramCode)
        const warning = (response.data as { warning?: string }).warning
        if (warning) {
          notify.warning(`转换降级: ${warning}`)
        } else {
          notify.success('解析并生成图成功')
        }
      } else {
        notify.error(response.error || '转换失败')
      }
    } catch (error) {
      notify.error('转换失败，请检查代码格式')
    } finally {
      setLoading(false)
    }
  }, [sourceCode, viewMode, theme, chenPinnedEntities])

  React.useEffect(() => {
    const onHotkey = (event: KeyboardEvent) => {
      const meta = event.ctrlKey || event.metaKey
      if (meta && event.key === 'Enter') {
        event.preventDefault()
        void handleTransform()
      }
      if (meta && event.shiftKey && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        void copyConverted()
      }
    }
    window.addEventListener('keydown', onHotkey)
    return () => window.removeEventListener('keydown', onHotkey)
  }, [sourceCode, viewMode, theme, chenPinnedEntities, diagramCode, handleTransform])

  React.useEffect(() => {
    const onGlobalTransform = () => {
      void handleTransform()
    }
    window.addEventListener('app:transform-mermaid-workspace', onGlobalTransform)
    return () => window.removeEventListener('app:transform-mermaid-workspace', onGlobalTransform)
  }, [handleTransform])

  React.useEffect(() => {
    const sections: Array<{ key: 'source' | 'result'; ref: React.RefObject<HTMLDivElement> }> = [
      { key: 'source', ref: sourceSectionRef },
      { key: 'result', ref: resultSectionRef }
    ]
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (!visible) return
        const found = sections.find((section) => section.ref.current === visible.target)
        if (found) setActiveSection(found.key)
      },
      { threshold: [0.25, 0.45, 0.7], rootMargin: '-80px 0px -35% 0px' }
    )

    sections.forEach((section) => section.ref.current && observer.observe(section.ref.current))
    return () => observer.disconnect()
  }, [])

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }} className="fade-in">
      <div className="section-nav">
        <Space wrap>
          <Button size="small" type={activeSection === 'source' ? 'primary' : 'default'} onClick={() => scrollToSection(sourceSectionRef)}>源码输入</Button>
          <Button size="small" type={activeSection === 'result' ? 'primary' : 'default'} onClick={() => scrollToSection(resultSectionRef)}>图与结果</Button>
          <Text className="hotkey-hint">快捷键：Ctrl/Cmd + Enter 转换，Ctrl/Cmd + Shift + C 复制结果</Text>
        </Space>
      </div>
      <div ref={sourceSectionRef}>
      <Card title="Mermaid 工作台" className="soft-card">
        <Paragraph style={{ marginBottom: 12 }}>
          直接输入 Mermaid 代码（或 SQL DDL），按目标视图模式转换并生成 ER 图。
        </Paragraph>
        <div className="toolbar-wrap action-toolbar-sticky" style={{ marginBottom: 12 }}>
          <div className="toolbar-row">
          <Text>主题：</Text>
          <Select
            value={theme}
            onChange={setTheme}
            style={{ width: 140 }}
            options={[
              { value: 'default', label: '默认' },
              { value: 'dark', label: '深色' },
              { value: 'forest', label: '森林' },
              { value: 'neutral', label: '中性' }
            ]}
          />
          <Text>视图模式：</Text>
          <Select
            value={viewMode}
            onChange={setViewMode}
            style={{ width: 150 }}
            options={[
              { value: 'classic', label: '经典ER' },
              { value: 'physical', label: '物理表结构' },
              { value: 'chen', label: 'Chen概念模型' }
            ]}
          />
          {viewMode === 'chen' && (
            <>
              <Text>主实体固定名单：</Text>
              <Select
                mode="tags"
                value={chenPinnedEntities}
                onChange={(values) => setChenPinnedEntities(values)}
                style={{ minWidth: 280 }}
                placeholder="输入实体名并回车，如 USERS"
              />
            </>
          )}
          </div>
          <div className="toolbar-row">
          <Button type="primary" onClick={handleTransform} loading={loading} icon={<ThunderboltOutlined />}>
            解析并生成
          </Button>
          <Button onClick={() => setSourceCode(defaultCode)}>恢复默认示例</Button>
          </div>
        </div>
        <TextArea
          rows={14}
          value={sourceCode}
          onChange={(event) => setSourceCode(event.target.value)}
          placeholder="请输入 erDiagram / flowchart / SQL DDL"
        />
      </Card>
      </div>

      <Row gutter={[16, 16]} className="workspace-grid" ref={resultSectionRef}>
        <Col xs={24} xl={14}>
          <DiagramRenderer code={diagramCode} theme={theme} />
        </Col>
        <Col xs={24} xl={10}>
          <Card title="转换后代码" className="soft-card" extra={<Button size="small" icon={<CopyOutlined />} onClick={() => void copyConverted()}>复制</Button>}>
            <TextArea rows={20} value={diagramCode} readOnly />
          </Card>
        </Col>
      </Row>
    </Space>
  )
}

export default MermaidWorkspace
