import React, { useState, useCallback } from 'react'
import { Card, Row, Col, Space, Typography, Button, Select, message } from 'antd'
import { Editor } from '@monaco-editor/react'
import { SaveOutlined, FolderOpenOutlined } from '@ant-design/icons'
import { sqlService } from '../services/api'
import { SQLParseResult } from '../types'
import EntityList from './EntityList'
import DiagramRenderer from './DiagramRenderer'
import ExportPanel from './ExportPanel'

const { Title, Text } = Typography
const { Option } = Select

const SQLInput: React.FC = () => {
  const [sql, setSql] = useState<string>('')
  const [theme, setTheme] = useState<string>('default')
  const [parseResult, setParseResult] = useState<SQLParseResult | null>(null)
  const [mermaidCode, setMermaidCode] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const handleSqlChange = useCallback((value: string | undefined) => {
    setSql(value || '')
  }, [])

  const handleParse = async () => {
    if (!sql.trim()) {
      message.warning('请输入 SQL 语句')
      return
    }

    setLoading(true)
    try {
      const response = await sqlService.parse(sql)
      if (response.success && response.data) {
        setParseResult(response.data)
        message.success('SQL 解析成功')
      } else {
        message.error(response.error || '解析失败')
      }
    } catch (error) {
      console.error('Parse error:', error)
      message.error('解析失败，请检查 SQL 语法')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateDiagram = async () => {
    if (!sql.trim()) {
      message.warning('请输入 SQL 语句')
      return
    }

    setLoading(true)
    try {
      const response = await sqlService.generateDiagram(sql, theme)
      if (response.success && response.data) {
        setMermaidCode(response.data.diagram)
        setParseResult(response.data)
        message.success('ER 图生成成功')
      } else {
        message.error(response.error || '生成失败')
      }
    } catch (error) {
      console.error('Generate error:', error)
      message.error('生成失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleThemeChange = (value: string) => {
    setTheme(value)
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="SQL 输入">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space>
                  <Text>主题：</Text>
                  <Select value={theme} onChange={handleThemeChange} style={{ width: 120 }}>
                    <Option value="default">默认</Option>
                    <Option value="dark">深色</Option>
                    <Option value="forest">森林</Option>
                    <Option value="neutral">中性</Option>
                  </Select>
                </Space>
                <Space>
                  <Button type="primary" icon={<SaveOutlined />} onClick={handleParse}>
                    解析 SQL
                  </Button>
                  <Button type="primary" icon={<FolderOpenOutlined />} onClick={handleGenerateDiagram}>
                    生成 ER 图
                  </Button>
                </Space>
              </Space>
              
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
        </Col>
      </Row>

      {parseResult && (
        <>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={24}>
              <EntityList data={parseResult} />
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={16}>
              <DiagramRenderer code={mermaidCode} theme={theme} />
            </Col>
            <Col span={8}>
              <ExportPanel sql={sql} theme={theme} />
            </Col>
          </Row>
        </>
      )}
    </div>
  )
}

export default SQLInput