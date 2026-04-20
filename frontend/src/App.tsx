import React from 'react'
import { Layout, Typography, Space, Menu, Card, Table, Button, Form, Input, message, Popconfirm } from 'antd'
import {
  CodeOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  PictureOutlined,
  UploadOutlined
} from '@ant-design/icons'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import SQLInput from './components/SQLInput'
import MermaidPreviewPage from './components/MermaidPreviewPage'
import { projectService } from './services/api'
import { Project } from './types'

const { Header, Content } = Layout
const { Title, Paragraph } = Typography
const { TextArea } = Input

const GeneratorFeaturePage: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <Space direction="vertical" size="large" style={{ width: '100%' }}>
    <Card>
      <Title level={4} style={{ marginBottom: 8 }}>{title}</Title>
      <Paragraph style={{ marginBottom: 0 }}>{description}</Paragraph>
    </Card>
    <SQLInput />
  </Space>
)

const HomePage: React.FC = () => (
  <Card>
    <Title level={3}>欢迎使用 Mermaid ER Generator</Title>
    <Paragraph>
      这是一个 SQL DDL 到 ER 图的转换工具。已实现功能都提供了独立导航入口：
      SQL 解析、ER 图生成、导出、项目管理。
    </Paragraph>
  </Card>
)

const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = React.useState<Project[]>([])
  const [loading, setLoading] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [form] = Form.useForm()

  const loadProjects = React.useCallback(async () => {
    setLoading(true)
    try {
      const response = await projectService.getAll()
      setProjects(response.data || [])
    } catch (error) {
      message.error('加载项目失败')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  const handleCreate = async (values: { name: string; description?: string; sql: string }) => {
    setSubmitting(true)
    try {
      const response = await projectService.create(values)
      if (response.success) {
        message.success('项目创建成功')
        form.resetFields()
        await loadProjects()
      } else {
        message.error(response.error || '项目创建失败')
      }
    } catch (error) {
      message.error('项目创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await projectService.delete(id)
      if (response.success) {
        message.success('项目删除成功')
        await loadProjects()
      } else {
        message.error(response.error || '项目删除失败')
      }
    } catch (error) {
      message.error('项目删除失败')
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="新建项目">
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="例如：电商数据库模型" />
          </Form.Item>
          <Form.Item name="description" label="项目描述">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item name="sql" label="SQL DDL" rules={[{ required: true, message: '请输入 SQL DDL' }]}>
            <TextArea rows={5} placeholder="CREATE TABLE ..." />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>保存项目</Button>
        </Form>
      </Card>

      <Card
        title="项目列表"
        extra={<Button onClick={() => void loadProjects()} loading={loading}>刷新</Button>}
      >
        <Table<Project>
          rowKey="id"
          loading={loading}
          dataSource={projects}
          pagination={{ pageSize: 6 }}
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '描述', dataIndex: 'description', render: (value) => value || '-' },
            { title: '创建时间', dataIndex: 'createdAt', render: (value) => value ? new Date(value).toLocaleString() : '-' },
            {
              title: '操作',
              key: 'actions',
              render: (_, record) => (
                <Popconfirm title="确认删除该项目？" onConfirm={() => void handleDelete(record.id)}>
                  <Button danger size="small">删除</Button>
                </Popconfirm>
              )
            }
          ]}
        />
      </Card>
    </Space>
  )
}

const AboutPage: React.FC = () => (
  <Card>
    <Title level={3}>关于项目</Title>
    <Paragraph>
      前端基于 React + Ant Design + Vite，后端提供 SQL 解析、ER 图生成与导出 API。
    </Paragraph>
  </Card>
)

const App: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const menuItems = [
    { key: '/home', icon: <HomeOutlined />, label: '首页' },
    { key: '/sql-parser', icon: <FileSearchOutlined />, label: 'SQL 解析' },
    { key: '/diagram', icon: <PictureOutlined />, label: 'ER 图生成' },
    { key: '/mermaid-preview', icon: <CodeOutlined />, label: 'Mermaid预览' },
    { key: '/export', icon: <UploadOutlined />, label: '导出' },
    { key: '/projects', icon: <FolderOpenOutlined />, label: '项目管理' },
    { key: '/about', icon: <InfoCircleOutlined />, label: '关于' }
  ]

  const selectedKey = menuItems.some((item) => item.key === location.pathname)
    ? location.pathname
    : '/sql-parser'

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <DatabaseOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
            Mermaid ER Generator
          </Title>
          <Menu
            mode="horizontal"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ flex: 1, minWidth: 700, marginLeft: 24, borderBottom: 'none' }}
          />
        </Space>
      </Header>
      <Content style={{ padding: '24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/sql-parser" replace />} />
            <Route path="/home" element={<HomePage />} />
            <Route
              path="/sql-parser"
              element={<GeneratorFeaturePage title="SQL 解析" description="输入 SQL DDL 并解析实体、字段和关系。" />}
            />
            <Route
              path="/diagram"
              element={<GeneratorFeaturePage title="ER 图生成" description="将 SQL 解析结果可视化为 Mermaid ER 图。" />}
            />
            <Route
              path="/export"
              element={<GeneratorFeaturePage title="导出" description="把生成结果导出为 SVG/PNG/PDF 文件。" />}
            />
            <Route path="/mermaid-preview" element={<MermaidPreviewPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<Navigate to="/sql-parser" replace />} />
          </Routes>
        </div>
      </Content>
    </Layout>
  )
}

export default App