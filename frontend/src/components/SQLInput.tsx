import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Card, Row, Col, Space, Typography, Button, Select } from 'antd'
import { Editor } from '@monaco-editor/react'
import { SaveOutlined, FolderOpenOutlined, ReloadOutlined } from '@ant-design/icons'
import { sqlService } from '../services/api'
import { SQLParseResult, ViewMode } from '../types'
import EntityList from './EntityList'
import DiagramRenderer from './DiagramRenderer'
import ExportPanel from './ExportPanel'
import { notify } from '../utils/notify'

const { Title, Text } = Typography
const { Option } = Select

const SQLInput: React.FC = () => {
  const [sql, setSql] = useState<string>('')
  const [theme, setTheme] = useState<string>('default')
  const [viewMode, setViewMode] = useState<ViewMode>('classic')
  const [chenPinnedEntities, setChenPinnedEntities] = useState<string[]>(['USERS', 'ARTICLES'])
  const [parseResult, setParseResult] = useState<SQLParseResult | null>(null)
  const [mermaidCode, setMermaidCode] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [activeSection, setActiveSection] = useState<'input' | 'model' | 'preview'>('input')
  const inputSectionRef = useRef<HTMLDivElement | null>(null)
  const modelSectionRef = useRef<HTMLDivElement | null>(null)
  const previewSectionRef = useRef<HTMLDivElement | null>(null)

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleSqlChange = useCallback((value: string | undefined) => {
    setSql(value || '')
  }, [])

  const handleParse = async () => {
    if (!sql.trim()) {
      notify.warning('请输入 SQL 语句')
      return
    }

    setLoading(true)
    try {
      const response = await sqlService.parse(sql)
      if (response.success && response.data) {
        setParseResult(response.data)
        notify.success('SQL 解析成功')
      } else {
        notify.error(response.error || '解析失败')
      }
    } catch (error) {
      console.error('Parse error:', error)
      notify.error('解析失败，请检查 SQL 语法')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateDiagram = useCallback(async (silent: boolean = false) => {
    if (!sql.trim()) {
      if (!silent) {
        notify.warning('请输入 SQL 语句')
      }
      return
    }

    setLoading(true)
    try {
      const response = await sqlService.generateDiagram(sql, theme, viewMode, chenPinnedEntities)
      if (response.success && response.data) {
        setMermaidCode(response.data.diagram)
        setParseResult(response.data)
        if (!silent) {
          notify.success('ER 图生成成功')
        }
      } else {
        if (!silent) {
          notify.error(response.error || '生成失败')
        }
      }
    } catch (error) {
      console.error('Generate error:', error)
      if (!silent) {
        notify.error('生成失败，请重试')
      }
    } finally {
      setLoading(false)
    }
  }, [sql, theme, viewMode, chenPinnedEntities])

  const handleThemeChange = (value: string) => {
    setTheme(value)
  }

  const handleViewModeChange = (value: ViewMode) => {
    setViewMode(value)
  }

  useEffect(() => {
    if (!sql.trim() || !parseResult) {
      return
    }
    void handleGenerateDiagram(true)
    // Re-generate diagram when mode or Chen anchor list changes.
  }, [viewMode, chenPinnedEntities, sql, parseResult, handleGenerateDiagram])

  useEffect(() => {
    const onHotkey = (event: KeyboardEvent) => {
      const meta = event.ctrlKey || event.metaKey
      if (meta && event.key === 'Enter') {
        event.preventDefault()
        void handleGenerateDiagram()
      }
    }
    window.addEventListener('keydown', onHotkey)
    return () => window.removeEventListener('keydown', onHotkey)
  }, [sql, theme, viewMode, chenPinnedEntities, handleGenerateDiagram])

  useEffect(() => {
    const onGlobalGenerate = () => {
      void handleGenerateDiagram()
    }
    window.addEventListener('app:generate-sql-diagram', onGlobalGenerate)
    return () => window.removeEventListener('app:generate-sql-diagram', onGlobalGenerate)
  }, [handleGenerateDiagram])

  useEffect(() => {
    const sections: Array<{ key: 'input' | 'model' | 'preview'; ref: React.RefObject<HTMLDivElement> }> = [
      { key: 'input', ref: inputSectionRef },
      { key: 'model', ref: modelSectionRef },
      { key: 'preview', ref: previewSectionRef }
    ]

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (!visible) return
        const found = sections.find((section) => section.ref.current === visible.target)
        if (found) {
          setActiveSection(found.key)
        }
      },
      { threshold: [0.25, 0.45, 0.7], rootMargin: '-80px 0px -35% 0px' }
    )

    sections.forEach((section) => {
      if (section.ref.current) observer.observe(section.ref.current)
    })

    return () => observer.disconnect()
  }, [!!parseResult])

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }} className="fade-in">
      <div className="section-nav" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Button size="small" type={activeSection === 'input' ? 'primary' : 'default'} onClick={() => scrollToSection(inputSectionRef)}>输入区</Button>
          <Button size="small" type={activeSection === 'model' ? 'primary' : 'default'} onClick={() => scrollToSection(modelSectionRef)} disabled={!parseResult}>结构结果</Button>
          <Button size="small" type={activeSection === 'preview' ? 'primary' : 'default'} onClick={() => scrollToSection(previewSectionRef)} disabled={!parseResult}>图与导出</Button>
          <Text className="hotkey-hint">快捷键：Ctrl/Cmd + Enter 生成 ER 图</Text>
        </Space>
      </div>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <div ref={inputSectionRef}>
          <Card title="SQL 输入" className="soft-card">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div className="toolbar-wrap action-toolbar-sticky" style={{ justifyContent: 'space-between' }}>
                <div className="toolbar-row">
                  <Text>主题：</Text>
                  <Select value={theme} onChange={handleThemeChange} style={{ width: 120 }}>
                    <Option value="default">默认</Option>
                    <Option value="dark">深色</Option>
                    <Option value="forest">森林</Option>
                    <Option value="neutral">中性</Option>
                  </Select>
                  <Text>视图模式：</Text>
                  <Select value={viewMode} onChange={handleViewModeChange} style={{ width: 140 }}>
                    <Option value="classic">经典ER</Option>
                    <Option value="physical">物理表结构</Option>
                    <Option value="chen">Chen概念模型</Option>
                  </Select>
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
                  <Button type="default" icon={<SaveOutlined />} onClick={handleParse} loading={loading}>
                    解析 SQL
                  </Button>
                  <Button type="primary" icon={<FolderOpenOutlined />} onClick={handleGenerateDiagram} loading={loading}>
                    生成 ER 图
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={() => void handleGenerateDiagram(true)} disabled={!sql.trim() || loading}>
                    刷新图
                  </Button>
                </div>
              </div>
              
              <div className="sql-editor">
                <Editor
                  height="400px"
                  defaultLanguage="sql"
                  value={sql}
                  onChange={handleSqlChange}
                  theme="vs-light"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    roundedSelection: false,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  }}
                />
              </div>
            </Space>
          </Card>
          </div>
        </Col>
      </Row>

      {parseResult && (
        <>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }} ref={modelSectionRef}>
            <Col span={24}>
              <EntityList data={parseResult} />
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }} className="workspace-grid" ref={previewSectionRef}>
            <Col xs={24} xl={16}>
              <DiagramRenderer code={mermaidCode} theme={theme} />
            </Col>
            <Col xs={24} xl={8}>
              <ExportPanel
                sql={sql}
                theme={theme}
                viewMode={viewMode}
                chenPinnedEntities={chenPinnedEntities}
              />
            </Col>
          </Row>
        </>
      )}
    </div>
  )
}

export default SQLInput