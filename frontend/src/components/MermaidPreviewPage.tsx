import React from 'react'
import { Button, Card, Col, Input, Row, Select, Space, Typography } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import DiagramRenderer from './DiagramRenderer'
import { ViewMode } from '../types'
import { sqlService } from '../services/api'
import { notify } from '../utils/notify'

const { Paragraph } = Typography
const { TextArea } = Input

const sampleByMode: Record<ViewMode, string> = {
  classic: `erDiagram
  USER {
    int id PK
    string email
  }
  ORDER {
    int id PK
    int user_id FK
  }
  USER ||--o{ ORDER : places`,
  physical: `erDiagram
  USERS {
    bigint id PK
    varchar username UK
  }
  ARTICLES {
    bigint id PK
    bigint author_id FK
  }
  ARTICLE_TAGS {
    bigint article_id FK
    bigint tag_id FK
  }
  USERS ||--o{ ARTICLES : writes
  ARTICLES ||--o{ ARTICLE_TAGS : has`,
  chen: `flowchart LR
  E_USER["USER"]
  A_USER_ID(("<u>id</u>"))
  A_USER_NAME(("name"))
  E_USER --- A_USER_ID
  E_USER --- A_USER_NAME
  E_ORDER["ORDER"]
  A_ORDER_ID(("<u>id</u>"))
  A_ORDER_USER(("user_id"))
  E_ORDER --- A_ORDER_ID
  E_ORDER --- A_ORDER_USER
  R_PLACES{"places"}
  E_USER -- "1" --- R_PLACES
  R_PLACES -- "N" --- E_ORDER`
}

const MermaidPreviewPage: React.FC = () => {
  const [viewMode, setViewMode] = React.useState<ViewMode>('classic')
  const [chenPinnedEntities, setChenPinnedEntities] = React.useState<string[]>(['USERS', 'ARTICLES'])
  const [draftCode, setDraftCode] = React.useState(sampleByMode.classic)
  const [renderCode, setRenderCode] = React.useState(sampleByMode.classic)
  const [convertedCode, setConvertedCode] = React.useState(sampleByMode.classic)
  const [theme, setTheme] = React.useState('default')
  const [activeSection, setActiveSection] = React.useState<'source' | 'result'>('source')
  const sourceRef = React.useRef<HTMLDivElement | null>(null)
  const resultRef = React.useRef<HTMLDivElement | null>(null)

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleCopySample = async () => {
    try {
      await navigator.clipboard.writeText(sampleByMode[viewMode])
      notify.success('示例代码已复制')
    } catch (error) {
      notify.error('复制失败，请手动复制')
    }
  }

  const copyConverted = async () => {
    try {
      await navigator.clipboard.writeText(convertedCode)
      notify.success('转换后代码已复制')
    } catch (error) {
      notify.error('复制失败，请手动复制')
    }
  }

  const handleClear = () => {
    setDraftCode('')
    setRenderCode('')
    setConvertedCode('')
  }

  React.useEffect(() => {
    const onHotkey = (event: KeyboardEvent) => {
      const meta = event.ctrlKey || event.metaKey
      if (meta && event.key === 'Enter') {
        event.preventDefault()
        void handleRender()
      }
      if (meta && event.shiftKey && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        void copyConverted()
      }
    }
    window.addEventListener('keydown', onHotkey)
    return () => window.removeEventListener('keydown', onHotkey)
  }, [draftCode, viewMode, theme, chenPinnedEntities, convertedCode])

  React.useEffect(() => {
    const sections: Array<{ key: 'source' | 'result'; ref: React.RefObject<HTMLDivElement> }> = [
      { key: 'source', ref: sourceRef },
      { key: 'result', ref: resultRef }
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

  const handleRender = React.useCallback(async () => {
    try {
      const response = await sqlService.transformPreview(
        draftCode,
        viewMode,
        theme,
        chenPinnedEntities
      )
      if (response.success && response.data?.diagramCode) {
        setRenderCode(response.data.diagramCode)
        setConvertedCode(response.data.diagramCode)
        const warning = (response.data as { warning?: string }).warning
        if (warning) {
          notify.warning(`转换降级: ${warning}`)
        } else {
          notify.success('渲染成功')
        }
      } else {
        notify.error(response.error || '转换失败，请检查代码格式')
      }
    } catch (error) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      setRenderCode(draftCode)
      setConvertedCode(draftCode)
      notify.error(axiosError.response?.data?.error || '转换失败，请检查代码格式')
    }
  }, [draftCode, viewMode, theme, chenPinnedEntities])

  React.useEffect(() => {
    const onGlobalRender = () => {
      void handleRender()
    }
    window.addEventListener('app:render-mermaid-preview', onGlobalRender)
    return () => window.removeEventListener('app:render-mermaid-preview', onGlobalRender)
  }, [handleRender])

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }} className="fade-in">
      <div className="section-nav">
        <Space wrap>
          <Button size="small" type={activeSection === 'source' ? 'primary' : 'default'} onClick={() => scrollToSection(sourceRef)}>源码输入</Button>
          <Button size="small" type={activeSection === 'result' ? 'primary' : 'default'} onClick={() => scrollToSection(resultRef)}>图与代码</Button>
          <span className="hotkey-hint">快捷键：Ctrl/Cmd + Enter 渲染，Ctrl/Cmd + Shift + C 复制结果</span>
        </Space>
      </div>
      <div ref={sourceRef}>
      <Card title="Mermaid 代码预览" className="soft-card">
        <Paragraph style={{ marginBottom: 12 }}>
          在这里直接输入 Mermaid ER 语法并渲染预览，不依赖 SQL 解析流程。
        </Paragraph>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <TextArea
              rows={12}
              value={draftCode}
              onChange={(event) => setDraftCode(event.target.value)}
              placeholder="请输入 Mermaid 代码，例如 erDiagram ..."
            />
          </Col>
          <Col span={24}>
            <div className="toolbar-wrap">
              <div className="toolbar-row">
              <span>主题：</span>
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
              <span>视图模式：</span>
              <Select
                value={viewMode}
                onChange={setViewMode}
                style={{ width: 140 }}
                options={[
                  { value: 'classic', label: '经典ER' },
                  { value: 'physical', label: '物理表结构' },
                  { value: 'chen', label: 'Chen概念模型' }
                ]}
              />
              {viewMode === 'chen' && (
                <>
                  <span>主实体固定名单：</span>
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
              <Button type="primary" onClick={handleRender}>
                渲染预览
              </Button>
              <Button
                onClick={() => {
                  const sample = sampleByMode[viewMode]
                  setDraftCode(sample)
                  setRenderCode(sample)
                  setConvertedCode(sample)
                }}
              >
                填充示例代码
              </Button>
              <Button onClick={() => void handleCopySample()}>
                复制示例代码
              </Button>
              <Button danger onClick={handleClear}>
                清空代码
              </Button>
              </div>
            </div>
          </Col>
        </Row>
      </Card>
      </div>

      <div ref={resultRef}>
      <DiagramRenderer code={renderCode} theme={theme} />

      <Card title="转换后代码" className="soft-card" extra={<Button size="small" icon={<CopyOutlined />} onClick={() => void copyConverted()}>复制</Button>}>
        <TextArea
          className="code-panel"
          rows={14}
          value={convertedCode}
          readOnly
          placeholder="点击“渲染预览”后，这里会显示后端转换后的 Mermaid 代码"
        />
      </Card>
      </div>
    </Space>
  )
}

export default MermaidPreviewPage
