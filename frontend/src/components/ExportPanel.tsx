import React, { useState } from 'react'
import { Card, Space, Button, Typography, message } from 'antd'
import { DownloadOutlined, FileImageOutlined, FilePdfOutlined } from '@ant-design/icons'
import { ExportOptions } from '../types'
import { exportService } from '../services/api'

const { Title } = Typography

interface ExportPanelProps {
  sql: string
  theme?: string
}

const ExportPanel: React.FC<ExportPanelProps> = ({ sql, theme = 'default' }) => {
  const [loading, setLoading] = useState(false)

  const handleExport = async (format: 'png' | 'svg' | 'pdf') => {
    if (!sql.trim()) {
      message.error('请先输入 SQL 语句')
      return
    }

    setLoading(true)
    try {
      let blob: Blob
      let filename: string
      let mimeType: string

      switch (format) {
        case 'svg':
          blob = await exportService.exportSVG(sql, theme)
          filename = 'er-diagram.svg'
          mimeType = 'image/svg+xml'
          break
        case 'png':
          blob = await exportService.exportPNG(sql, theme)
          filename = 'er-diagram.png'
          mimeType = 'image/png'
          break
        case 'pdf':
          blob = await exportService.exportPDF(sql, theme)
          filename = 'er-diagram.pdf'
          mimeType = 'application/pdf'
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

      message.success(`成功导出 ${format.toUpperCase()} 文件`)
    } catch (error) {
      console.error('Export error:', error)
      message.error('导出失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="导出选项">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
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