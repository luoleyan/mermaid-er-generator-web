import React from 'react'
import { Layout, Typography, Space } from 'antd'
import { DatabaseOutlined, BarChartOutlined } from '@ant-design/icons'

const { Header, Content } = Layout
const { Title } = Typography

const App: React.FC = () => {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <Space>
          <DatabaseOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
            Mermaid ER Generator
          </Title>
        </Space>
      </Header>
      <Content style={{ padding: '24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Main content will go here */}
          <h1>Welcome to Mermaid ER Generator</h1>
          <p>This is a placeholder for the main application content.</p>
        </div>
      </Content>
    </Layout>
  )
}

export default App