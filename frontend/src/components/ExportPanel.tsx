import React, { useState } from 'react'
import { Card, Space, Button, Typography, message, Select, Input, Switch, Tag } from 'antd'
import { FileImageOutlined, FilePdfOutlined } from '@ant-design/icons'
import { ViewMode } from '../types'
import { exportService } from '../services/api'

const { Title } = Typography

interface ExportPanelProps {
  /** SQL or Mermaid source to export (should match what the diagram preview is built from). */
  sql: string
  theme?: string
  viewMode?: ViewMode
  chenPinnedEntities?: string[]
}

const ExportPanel: React.FC<ExportPanelProps> = ({
  sql,
  theme = 'default',
  viewMode = 'classic',
  chenPinnedEntities = []
}) => {
  const [messageApi, contextHolder] = message.useMessage()
  const [loading, setLoading] = useState(false)
  const [schemaName, setSchemaName] = useState('default')
  const [imageScale, setImageScale] = useState<1 | 2 | 3>(2)
  const [includeProjectMeta, setIncludeProjectMeta] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [version, setVersion] = useState('')
  const [pdfPageStrategy, setPdfPageStrategy] = useState<'original' | 'a4-landscape'>('original')
  const [titleTemplateLocale, setTitleTemplateLocale] = useState<'zh' | 'en'>('zh')
  const [showUTC, setShowUTC] = useState(true)
  const [titleFieldOrder, setTitleFieldOrder] = useState<Array<'mode' | 'schema' | 'exported' | 'project' | 'version'>>([
    'mode',
    'schema',
    'exported',
    'project',
    'version'
  ])

  const detectInputType = (): 'SQL' | 'erDiagram' | 'Chen flowchart' | 'Unknown' => {
    const source = sql.trim()
    if (!source) return 'Unknown'
    if (/^erDiagram\b/m.test(source)) return 'erDiagram'
    if (/^flowchart\b/m.test(source) && viewMode === 'chen') return 'Chen flowchart'
    if (/CREATE\s+TABLE/i.test(source)) return 'SQL'
    return 'Unknown'
  }
  const inputType = detectInputType()

  const getTitlePreview = (): string => {
    const locale = titleTemplateLocale
    const labels = locale === 'zh'
      ? { mode: '模式', schema: 'Schema', exported: '导出时间', project: '项目', version: '版本' }
      : { mode: 'mode', schema: 'schema', exported: 'exported', project: 'project', version: 'version' }
    const modeLabel = viewMode === 'classic'
      ? (locale === 'zh' ? '经典 ER' : 'Classic ER')
      : viewMode === 'physical'
        ? (locale === 'zh' ? '物理 ER' : 'Physical ER')
        : 'Chen ER'
    const now = new Date()
    const exported = showUTC
      ? `${now.toISOString().replace('T', ' ').slice(0, 19)} UTC`
      : now.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', { hour12: false })
    const fieldValues: Record<'mode' | 'schema' | 'exported' | 'project' | 'version', string | null> = {
      mode: modeLabel,
      schema: schemaName.trim() || 'default',
      exported,
      project: includeProjectMeta && projectName.trim() ? projectName.trim() : null,
      version: includeProjectMeta && version.trim() ? version.trim() : null
    }
    const parts = titleFieldOrder
      .map((field) => {
        const value = fieldValues[field]
        if (!value) return null
        return `${labels[field]}: ${value}`
      })
      .filter((item): item is string => !!item)
    return parts.join(' | ')
  }

  const handleExport = async (format: 'png' | 'svg' | 'pdf') => {
    if (!sql.trim()) {
      messageApi.error('请先输入 Mermaid 或 SQL 代码')
      return
    }

    setLoading(true)
    try {
      let blob: Blob
      let filename: string

      switch (format) {
        case 'svg':
          blob = await exportService.exportSVG(sql, theme, viewMode, chenPinnedEntities, {
            schemaName,
            imageScale,
            includeProjectMeta,
            projectName,
            version,
            titleTemplateLocale,
            titleFieldOrder,
            showUTC
          })
          filename = 'er-diagram.svg'
          break
        case 'png':
          blob = await exportService.exportPNG(sql, theme, viewMode, chenPinnedEntities, {
            schemaName,
            imageScale,
            includeProjectMeta,
            projectName,
            version,
            titleTemplateLocale,
            titleFieldOrder,
            showUTC
          })
          filename = 'er-diagram.png'
          break
        case 'pdf':
          blob = await exportService.exportPDF(sql, theme, viewMode, chenPinnedEntities, {
            schemaName,
            imageScale,
            includeProjectMeta,
            projectName,
            version,
            pdfPageStrategy,
            titleTemplateLocale,
            titleFieldOrder,
            showUTC
          })
          filename = 'er-diagram.pdf'
          break
      }

      // Create download link
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      messageApi.success(`成功导出 ${format.toUpperCase()} 文件`)
    } catch (error) {
      console.error('Export error:', error)
      const errObj = error as { code?: string; message?: string }
      const maybeTimeout = errObj.code === 'ECONNABORTED'
        || /timeout/i.test(errObj.message || '')
      if (maybeTimeout) {
        messageApi.error('导出超时，请降低清晰度档位或稍后重试')
      } else {
        const msg = errObj.message && errObj.message.trim().length > 0
          ? errObj.message
          : '导出失败，请重试'
        messageApi.error(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="导出选项">
      {contextHolder}
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space direction="vertical" size={6} style={{ width: '100%' }}>
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Typography.Text>当前识别输入类型</Typography.Text>
            <Tag color={inputType === 'Unknown' ? 'default' : 'blue'}>{inputType}</Tag>
          </Space>
        </Space>
        <Space direction="vertical" size={6} style={{ width: '100%' }}>
          <Typography.Text>Schema 名（用于标题栏）</Typography.Text>
          <Input
            value={schemaName}
            placeholder="default"
            onChange={(event) => setSchemaName(event.target.value)}
          />
        </Space>
        <Space direction="vertical" size={6} style={{ width: '100%' }}>
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Typography.Text>标题栏附加项目名/版本号</Typography.Text>
            <Switch checked={includeProjectMeta} onChange={setIncludeProjectMeta} />
          </Space>
          {includeProjectMeta && (
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              <Input
                value={projectName}
                placeholder="项目名（可选）"
                onChange={(event) => setProjectName(event.target.value)}
              />
              <Input
                value={version}
                placeholder="版本号（可选，例如 v1.4.2）"
                onChange={(event) => setVersion(event.target.value)}
              />
            </Space>
          )}
        </Space>
        <Space direction="vertical" size={6} style={{ width: '100%' }}>
          <Typography.Text>标题栏模板</Typography.Text>
          <Space>
            <Select<'zh' | 'en'>
              value={titleTemplateLocale}
              onChange={(value) => setTitleTemplateLocale(value)}
              style={{ width: 140 }}
              options={[
                { label: '中文', value: 'zh' },
                { label: 'English', value: 'en' }
              ]}
            />
            <Space style={{ alignItems: 'center' }}>
              <Typography.Text>显示 UTC</Typography.Text>
              <Switch checked={showUTC} onChange={setShowUTC} />
            </Space>
          </Space>
          <Select<Array<'mode' | 'schema' | 'exported' | 'project' | 'version'>>
            mode="multiple"
            value={titleFieldOrder}
            onChange={(values) => setTitleFieldOrder(values)}
            style={{ width: '100%' }}
            placeholder="字段顺序"
            options={[
              { label: '模式 / mode', value: 'mode' },
              { label: 'Schema', value: 'schema' },
              { label: '导出时间 / exported', value: 'exported' },
              { label: '项目 / project', value: 'project' },
              { label: '版本 / version', value: 'version' }
            ]}
          />
        </Space>
        <Space direction="vertical" size={6} style={{ width: '100%' }}>
          <Typography.Text>标题栏样例预览</Typography.Text>
          <Card size="small" style={{ background: 'rgba(245, 248, 255, 0.85)', borderColor: 'rgba(145, 172, 220, 0.35)' }}>
            <Typography.Text code>{getTitlePreview() || '-'}</Typography.Text>
          </Card>
        </Space>
        <Space direction="vertical" size={6} style={{ width: '100%' }}>
          <Typography.Text>导出清晰度（PNG/PDF）</Typography.Text>
          <Select<1 | 2 | 3>
            value={imageScale}
            onChange={(value) => setImageScale(value)}
            style={{ width: 180 }}
            options={[
              { label: '1x 标准', value: 1 },
              { label: '2x 文档', value: 2 },
              { label: '3x 评审', value: 3 }
            ]}
          />
        </Space>
        <Space direction="vertical" size={6} style={{ width: '100%' }}>
          <Typography.Text>PDF 页面策略</Typography.Text>
          <Select<'original' | 'a4-landscape'>
            value={pdfPageStrategy}
            onChange={(value) => setPdfPageStrategy(value)}
            style={{ width: 220 }}
            options={[
              { label: '原图尺寸', value: 'original' },
              { label: 'A4 横向（适配）', value: 'a4-landscape' }
            ]}
          />
        </Space>
        <Title level={5}>选择导出格式</Title>
        <Space>
          <Button
            type="primary"
            icon={<FileImageOutlined />}
            onClick={() => handleExport('svg')}
            loading={loading}
          >
            导出 SVG
          </Button>
          <Button
            icon={<FileImageOutlined />}
            onClick={() => handleExport('png')}
            loading={loading}
          >
            导出 PNG
          </Button>
          <Button
            icon={<FilePdfOutlined />}
            onClick={() => handleExport('pdf')}
            loading={loading}
          >
            导出 PDF
          </Button>
        </Space>
      </Space>
    </Card>
  )
}

export default ExportPanel