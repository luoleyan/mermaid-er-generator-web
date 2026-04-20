import React from 'react'
import { Button, Card, Col, Input, Row, Select, Space, Typography, message } from 'antd'
import DiagramRenderer from './DiagramRenderer'
import { ViewMode } from '../types'
import { sqlService } from '../services/api'

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

  const handleCopySample = async () => {
    try {
      await navigator.clipboard.writeText(sampleByMode[viewMode])
      message.success('示例代码已复制')
    } catch (error) {
      message.error('复制失败，请手动复制')
    }
  }

  const handleClear = () => {
    setDraftCode('')
    setRenderCode('')
    setConvertedCode('')
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="Mermaid 代码预览">
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
            <Space>
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
              <Button
                type="primary"
                onClick={async () => {
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
                        message.warning(`转换降级: ${warning}`)
                      }
                    } else {
                      message.error(response.error || '转换失败，请检查代码格式')
                    }
                  } catch (error) {
                    const axiosError = error as { response?: { data?: { error?: string } } }
                    setRenderCode(draftCode)
                    setConvertedCode(draftCode)
                    message.error(axiosError.response?.data?.error || '转换失败，请检查代码格式')
                  }
                }}
              >
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
            </Space>
          </Col>
        </Row>
      </Card>

      <DiagramRenderer code={renderCode} theme={theme} />

      <Card title="转换后代码">
        <TextArea
          rows={14}
          value={convertedCode}
          readOnly
          placeholder="点击“渲染预览”后，这里会显示后端转换后的 Mermaid 代码"
        />
      </Card>
    </Space>
  )
}

export default MermaidPreviewPage
