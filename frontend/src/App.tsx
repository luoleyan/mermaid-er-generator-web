import React from 'react'
import {
  Layout,
  Typography,
  Space,
  Menu,
  Card,
  Table,
  Button,
  Form,
  Input,
  message,
  Popconfirm,
  ConfigProvider,
  Segmented,
  Switch,
  theme as antdTheme,
  Modal,
  List,
  Drawer
} from 'antd'
import {
  CodeOutlined,
  DatabaseOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  AppstoreOutlined,
  MoonOutlined,
  SunOutlined,
  SearchOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import SQLInput from './components/SQLInput'
import MermaidPreviewPage from './components/MermaidPreviewPage'
import MermaidWorkspace from './components/MermaidWorkspace'
import { projectService } from './services/api'
import { Project } from './types'

const { Header, Content } = Layout
const { Title, Paragraph } = Typography
const { TextArea } = Input

const HEADER_COMPACT_STEPS = {
  hideAboutAtLevel: 1,
  hideDrawerAtLevel: 2,
  hideShortcutAtLevel: 3,
  maxLevel: 3,
  relaxThresholdByLevel: {
    1: 88,
    2: 136,
    3: 102
  } as Record<number, number>
} as const

const WorkspacePage: React.FC = () => (
  <Space direction="vertical" size="large" style={{ width: '100%' }}>
    <Card className="page-hero-card">
      <Title level={4} style={{ marginBottom: 8 }}>ER 工作台</Title>
      <Paragraph style={{ marginBottom: 0 }}>
        统一处理 SQL 解析、ER 图生成和导出。在同一页面完成输入、检查实体关系、预览和导出，避免在多个重复页面来回切换。
      </Paragraph>
    </Card>
    <SQLInput />
  </Space>
)

const HomePage: React.FC = () => (
  <Card className="page-hero-card">
    <Title level={3}>欢迎使用 Mermaid ER Generator</Title>
    <Paragraph>
      这是一个 SQL DDL 到 ER 图的转换工具。导航已整合为清晰工作流：
      ER 工作台（解析/生成/导出一体）、Mermaid 预览、项目管理。
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
      <Card title="新建项目" className="soft-card">
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
        className="soft-card"
      >
        <Table<Project>
          rowKey="id"
          loading={loading}
          dataSource={projects}
          size="middle"
          pagination={{ pageSize: 6, showSizeChanger: false }}
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
  <Card className="page-hero-card">
    <Title level={3}>关于项目</Title>
    <Paragraph>
      前端基于 React + Ant Design + Vite，后端提供 SQL 解析、ER 图生成与导出 API。
    </Paragraph>
  </Card>
)

const App: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [isDark, setIsDark] = React.useState<boolean>(() => localStorage.getItem('ui-dark') === '1')
  const [density, setDensity] = React.useState<'comfort' | 'compact'>(() => {
    const stored = localStorage.getItem('ui-density')
    return stored === 'compact' ? 'compact' : 'comfort'
  })
  const [commandOpen, setCommandOpen] = React.useState(false)
  const [commandDrawerOpen, setCommandDrawerOpen] = React.useState(false)
  const [shortcutOpen, setShortcutOpen] = React.useState(false)
  const [commandKeyword, setCommandKeyword] = React.useState('')
  const [activeCommandIndex, setActiveCommandIndex] = React.useState(0)
  const [drawerGroupFocus, setDrawerGroupFocus] = React.useState<'导航' | '动作'>('导航')
  const [titleCentered, setTitleCentered] = React.useState<boolean>(() => localStorage.getItem('ui-title-centered') === '1')
  const [headerScrollY, setHeaderScrollY] = React.useState(0)
  const [smoothedTitleOpacity, setSmoothedTitleOpacity] = React.useState(1)
  const [adaptiveCompactLevel, setAdaptiveCompactLevel] = React.useState(0)
  const headerRowRef = React.useRef<HTMLDivElement | null>(null)
  const [mruCommandIds, setMruCommandIds] = React.useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('command-mru')
      return raw ? (JSON.parse(raw) as string[]) : []
    } catch {
      return []
    }
  })

  React.useEffect(() => {
    localStorage.setItem('ui-dark', isDark ? '1' : '0')
  }, [isDark])

  React.useEffect(() => {
    localStorage.setItem('ui-density', density)
  }, [density])

  React.useEffect(() => {
    localStorage.setItem('ui-title-centered', titleCentered ? '1' : '0')
  }, [titleCentered])

  React.useEffect(() => {
    const onScroll = () => setHeaderScrollY(window.scrollY || 0)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const commandItems = React.useMemo(
    () => [
      { id: 'goto-home', group: '导航', label: '首页', hint: '跳转到首页', shortcut: '↵', run: () => navigate('/home') },
      { id: 'goto-workspace', group: '导航', label: 'ER 工作台', hint: '跳转到 ER 工作台', shortcut: '↵', run: () => navigate('/workspace') },
      { id: 'goto-mermaid-workspace', group: '导航', label: 'Mermaid 工作台', hint: '跳转到 Mermaid 工作台', shortcut: '↵', run: () => navigate('/mermaid-workspace') },
      { id: 'goto-mermaid-preview', group: '导航', label: 'Mermaid 预览', hint: '跳转到 Mermaid 预览', shortcut: '↵', run: () => navigate('/mermaid-preview') },
      { id: 'goto-projects', group: '导航', label: '项目管理', hint: '跳转到项目管理', shortcut: '↵', run: () => navigate('/projects') },
      { id: 'action-generate-sql', group: '动作', label: 'ER 工作台生成 ER 图', hint: '触发 SQL 工作台生成动作', shortcut: '⌘↵', run: () => window.dispatchEvent(new CustomEvent('app:generate-sql-diagram')) },
      { id: 'action-transform-mermaid', group: '动作', label: 'Mermaid 工作台解析并生成', hint: '触发 Mermaid 工作台转换动作', shortcut: '⌘↵', run: () => window.dispatchEvent(new CustomEvent('app:transform-mermaid-workspace')) },
      { id: 'action-render-preview', group: '动作', label: 'Mermaid 预览渲染', hint: '触发 Mermaid 预览渲染动作', shortcut: '⌘↵', run: () => window.dispatchEvent(new CustomEvent('app:render-mermaid-preview')) }
    ],
    [navigate]
  )

  const fuzzyMatch = (text: string, keyword: string): boolean => {
    const normalizedText = text.toLowerCase()
    const normalizedKeyword = keyword.toLowerCase().trim()
    if (!normalizedKeyword) return true
    if (normalizedText.includes(normalizedKeyword)) return true
    // subsequence fuzzy match
    let i = 0
    for (const ch of normalizedText) {
      if (ch === normalizedKeyword[i]) i += 1
      if (i >= normalizedKeyword.length) return true
    }
    return false
  }

  const getMatchedIndexes = (text: string, keyword: string): number[] => {
    const lowerText = text.toLowerCase()
    const lowerKeyword = keyword.toLowerCase().trim()
    if (!lowerKeyword) return []

    const includeIndex = lowerText.indexOf(lowerKeyword)
    if (includeIndex >= 0) {
      return Array.from({ length: lowerKeyword.length }, (_, idx) => includeIndex + idx)
    }

    const indexes: number[] = []
    let k = 0
    for (let i = 0; i < lowerText.length && k < lowerKeyword.length; i += 1) {
      if (lowerText[i] === lowerKeyword[k]) {
        indexes.push(i)
        k += 1
      }
    }
    return k === lowerKeyword.length ? indexes : []
  }

  const highlightText = (text: string, keyword: string): React.ReactNode => {
    const matched = new Set(getMatchedIndexes(text, keyword))
    if (matched.size === 0) return text
    return (
      <>
        {text.split('').map((char, idx) => (
          <span
            key={`${char}-${idx}`}
            style={matched.has(idx) ? { background: 'rgba(250, 219, 20, 0.35)', borderRadius: 2 } : undefined}
          >
            {char}
          </span>
        ))}
      </>
    )
  }

  const filteredCommands = React.useMemo(() => {
    const keyword = commandKeyword.trim().toLowerCase()
    const base = commandItems.filter((item) =>
      fuzzyMatch(`${item.group} ${item.label} ${item.hint}`, keyword)
    )
    if (!keyword) {
      const mruSet = new Set(mruCommandIds)
      return [...base].sort((a, b) => {
        const aMru = mruSet.has(a.id) ? mruCommandIds.indexOf(a.id) : Number.MAX_SAFE_INTEGER
        const bMru = mruSet.has(b.id) ? mruCommandIds.indexOf(b.id) : Number.MAX_SAFE_INTEGER
        return aMru - bMru
      })
    }
    return base
  }, [commandItems, commandKeyword, mruCommandIds])

  const groupedCommands = React.useMemo(() => {
    return {
      导航: filteredCommands.filter((item) => item.group === '导航'),
      动作: filteredCommands.filter((item) => item.group === '动作')
    }
  }, [filteredCommands])

  React.useEffect(() => {
    setActiveCommandIndex(0)
  }, [commandKeyword, commandOpen])

  const executeCommand = (item: (typeof commandItems)[number] | undefined) => {
    if (!item) return
    item.run()
    setMruCommandIds((prev) => {
      const next = [item.id, ...prev.filter((id) => id !== item.id)].slice(0, 8)
      localStorage.setItem('command-mru', JSON.stringify(next))
      return next
    })
    setCommandOpen(false)
    setCommandKeyword('')
    setActiveCommandIndex(0)
  }

  const closeCommandPanel = () => {
    setCommandOpen(false)
    setCommandKeyword('')
    setActiveCommandIndex(0)
  }

  const closeCommandDrawer = () => {
    setCommandDrawerOpen(false)
    setCommandKeyword('')
    setActiveCommandIndex(0)
  }

  const flatCommands = React.useMemo(() => [...groupedCommands.导航, ...groupedCommands.动作], [groupedCommands])
  const drawerCommands = React.useMemo(
    () => groupedCommands[drawerGroupFocus],
    [groupedCommands, drawerGroupFocus]
  )

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTypingField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.getAttribute('contenteditable') === 'true'

      const meta = event.ctrlKey || event.metaKey
      if (meta && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(true)
        return
      }

      if (!isTypingField && event.key === '?') {
        event.preventDefault()
        setShortcutOpen(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const menuItems = [
    { key: '/home', icon: <HomeOutlined />, label: '首页' },
    { key: '/workspace', icon: <AppstoreOutlined />, label: 'ER 工作台' },
    { key: '/mermaid-workspace', icon: <CodeOutlined />, label: 'Mermaid工作台' },
    { key: '/mermaid-preview', icon: <CodeOutlined />, label: 'Mermaid预览' },
    { key: '/projects', icon: <FolderOpenOutlined />, label: '项目管理' },
    { key: '/about', icon: <InfoCircleOutlined />, label: '关于' }
  ]

  const isAboutHidden = titleCentered && adaptiveCompactLevel >= HEADER_COMPACT_STEPS.hideAboutAtLevel
  const isDrawerHidden = titleCentered && adaptiveCompactLevel >= HEADER_COMPACT_STEPS.hideDrawerAtLevel
  const isShortcutHidden = titleCentered && adaptiveCompactLevel >= HEADER_COMPACT_STEPS.hideShortcutAtLevel
  const responsiveMenuItems = isAboutHidden
    ? menuItems.filter((item) => item.key !== '/about')
    : menuItems

  const selectedKey = responsiveMenuItems.some((item) => item.key === location.pathname)
    ? location.pathname
    : '/workspace'
  const centerSplit = Math.ceil(responsiveMenuItems.length / 2)
  const leftMenuItems = responsiveMenuItems.slice(0, centerSplit)
  const rightMenuItems = responsiveMenuItems.slice(centerSplit)
  const centeredTitleOpacity = Math.max(0.88, 1 - Math.min(headerScrollY, 120) / 120 * 0.12)

  React.useEffect(() => {
    let rafId = 0
    const animate = () => {
      setSmoothedTitleOpacity((prev) => {
        const next = prev + (centeredTitleOpacity - prev) * 0.16
        if (Math.abs(centeredTitleOpacity - next) < 0.0015) return centeredTitleOpacity
        rafId = window.requestAnimationFrame(animate)
        return next
      })
    }
    rafId = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(rafId)
  }, [centeredTitleOpacity])

  React.useEffect(() => {
    if (!titleCentered) {
      if (adaptiveCompactLevel !== 0) setAdaptiveCompactLevel(0)
      return
    }

    let rafId = 0
    const evaluate = () => {
      const row = headerRowRef.current
      if (!row) return

      const overflow = row.scrollWidth - row.clientWidth > 2
      const spare = row.clientWidth - row.scrollWidth

      if (overflow && adaptiveCompactLevel < HEADER_COMPACT_STEPS.maxLevel) {
        setAdaptiveCompactLevel((prev) => Math.min(prev + 1, HEADER_COMPACT_STEPS.maxLevel))
        return
      }

      if (!overflow && adaptiveCompactLevel > 0) {
        // Hysteresis to avoid jitter when width is near boundary.
        const relaxThreshold = HEADER_COMPACT_STEPS.relaxThresholdByLevel[adaptiveCompactLevel] ?? 102
        if (spare > relaxThreshold) {
          setAdaptiveCompactLevel((prev) => Math.max(prev - 1, 0))
        }
      }
    }

    rafId = window.requestAnimationFrame(evaluate)
    window.addEventListener('resize', evaluate, { passive: true })
    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', evaluate)
    }
  }, [titleCentered, adaptiveCompactLevel, location.pathname])

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          borderRadius: 10
        }
      }}
    >
    <div className={`app-root ${isDark ? 'theme-dark' : ''} density-${density}`}>
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        className="app-header"
        style={{
          background: isDark ? 'rgba(16, 24, 38, 0.72)' : 'rgba(255, 255, 255, 0.88)',
          padding: '0 24px',
          boxShadow: isDark
            ? '0 4px 14px rgba(0,0,0,0.32)'
            : '0 2px 10px rgba(24,48,87,0.08)'
        }}
      >
        <div ref={headerRowRef} className={`app-header-row ${titleCentered ? 'title-centered' : ''}`}>
          <Space align="center" className="app-header-left">
            <div className="mac-traffic-lights" aria-hidden>
              <span className="mac-dot red" />
              <span className="mac-dot yellow" />
              <span className="mac-dot green" />
            </div>
            <DatabaseOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            <Title level={3} className="app-title" style={{ margin: 0, color: isDark ? '#8fb8ff' : '#1890ff' }}>
              Mermaid ER Generator
            </Title>
          </Space>
          <div className={`app-header-center ${titleCentered ? 'title-balanced' : ''}`}>
          {titleCentered ? (
            <>
              <Menu
                className="app-center-menu app-center-menu-left"
                mode="horizontal"
                selectedKeys={[selectedKey]}
                items={leftMenuItems}
                onClick={({ key }) => navigate(key)}
                style={{ minWidth: 0, width: '100%', borderBottom: 'none' }}
              />
              <Title
                level={4}
                className="app-title-centered"
                style={{ margin: 0, color: isDark ? '#8fb8ff' : '#2453a6', opacity: smoothedTitleOpacity }}
              >
                Mermaid ER Generator
              </Title>
              <Menu
                className="app-center-menu app-center-menu-right"
                mode="horizontal"
                selectedKeys={[selectedKey]}
                items={rightMenuItems}
                onClick={({ key }) => navigate(key)}
                style={{ minWidth: 0, width: '100%', borderBottom: 'none' }}
              />
            </>
          ) : (
            <Menu
              mode="horizontal"
              selectedKeys={[selectedKey]}
              items={menuItems}
              onClick={({ key }) => navigate(key)}
              style={{
                minWidth: 580,
                width: '100%',
                borderBottom: 'none'
              }}
            />
          )}
          </div>
          <Space size={10} className="app-header-right">
            <Button icon={<SearchOutlined />} onClick={() => setCommandOpen(true)} className="with-kbd">
              命令面板 <span className="kbd-inline">⌘K</span>
            </Button>
            {!isDrawerHidden && (
              <Button icon={<SearchOutlined />} onClick={() => setCommandDrawerOpen(true)}>
                侧边命令抽屉
              </Button>
            )}
            {!isShortcutHidden && (
              <Button icon={<QuestionCircleOutlined />} onClick={() => setShortcutOpen(true)} className="with-kbd">
                快捷键 <span className="kbd-inline">?</span>
              </Button>
            )}
            <Segmented
              size="small"
              value={density}
              onChange={(value) => setDensity(value as 'comfort' | 'compact')}
              options={[
                { label: '舒适', value: 'comfort' },
                { label: '紧凑', value: 'compact' }
              ]}
            />
            <Switch
              checked={isDark}
              onChange={setIsDark}
              checkedChildren={<MoonOutlined />}
              unCheckedChildren={<SunOutlined />}
            />
            <Switch
              checked={titleCentered}
              onChange={setTitleCentered}
              checkedChildren="居中"
              unCheckedChildren="左对齐"
            />
          </Space>
        </div>
      </Header>
      <Content style={{ padding: '24px' }}>
        <div className="app-shell">
          <Routes>
            <Route path="/" element={<Navigate to="/workspace" replace />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/workspace" element={<WorkspacePage />} />
            <Route path="/mermaid-workspace" element={<MermaidWorkspace />} />
            <Route path="/sql-parser" element={<Navigate to="/workspace" replace />} />
            <Route path="/diagram" element={<Navigate to="/workspace" replace />} />
            <Route path="/export" element={<Navigate to="/workspace" replace />} />
            <Route path="/mermaid-preview" element={<MermaidPreviewPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<Navigate to="/workspace" replace />} />
          </Routes>
        </div>
      </Content>
    </Layout>
    <Modal
      title="命令面板"
      open={commandOpen}
      onCancel={closeCommandPanel}
      footer={null}
      width={720}
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Input
          autoFocus
          placeholder="搜索命令，例如：Mermaid 工作台 / 生成 ER 图"
          value={commandKeyword}
          onChange={(event) => setCommandKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              closeCommandPanel()
              return
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              if (flatCommands.length === 0) return
              setActiveCommandIndex((prev) => (prev + 1) % flatCommands.length)
              return
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              if (flatCommands.length === 0) return
              setActiveCommandIndex((prev) => (prev - 1 + flatCommands.length) % flatCommands.length)
              return
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              executeCommand(flatCommands[activeCommandIndex] || flatCommands[0])
            }
          }}
        />
        {mruCommandIds.length > 0 && commandKeyword.trim().length === 0 && (
          <Typography.Text className="hotkey-hint">
            最近使用：{mruCommandIds
              .map((id) => commandItems.find((item) => item.id === id)?.label)
              .filter(Boolean)
              .slice(0, 5)
              .join(' / ')}
          </Typography.Text>
        )}
        {flatCommands.length === 0 ? (
          <Card size="small">没有匹配命令</Card>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            {(['导航', '动作'] as const).map((groupName) => {
              const items = groupedCommands[groupName]
              if (items.length === 0) return null
              return (
                <Card key={groupName} size="small" title={groupName}>
                  <List
                    size="small"
                    dataSource={items}
                    renderItem={(item) => {
                      const index = flatCommands.findIndex((command) => command.id === item.id)
                      const active = index === activeCommandIndex
                      return (
                        <List.Item
                          style={{
                            cursor: 'pointer',
                            borderRadius: 6,
                            padding: '8px 10px',
                            background: active ? 'rgba(22,119,255,0.12)' : 'transparent'
                          }}
                          onMouseEnter={() => setActiveCommandIndex(index)}
                          onClick={() => executeCommand(item)}
                        >
                          <Space direction="vertical" size={0}>
                            <Typography.Text strong>{highlightText(item.label, commandKeyword)}</Typography.Text>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {highlightText(item.hint, commandKeyword)}
                            </Typography.Text>
                          </Space>
                        </List.Item>
                      )
                    }}
                  />
                </Card>
              )
            })}
          </Space>
        )}
        <Typography.Text className="hotkey-hint">
          提示：Ctrl/Cmd + K 打开，↑/↓选择，Enter 执行
        </Typography.Text>
      </Space>
    </Modal>
    <Drawer
      title="命令抽屉"
      placement="right"
      open={commandDrawerOpen}
      onClose={closeCommandDrawer}
      width="52vw"
      destroyOnClose
      className="mac-command-drawer"
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Segmented
          value={drawerGroupFocus}
          onChange={(value) => {
            setDrawerGroupFocus(value as '导航' | '动作')
            setActiveCommandIndex(0)
          }}
          options={[
            { label: '导航', value: '导航' },
            { label: '动作', value: '动作' }
          ]}
        />
        <Input
          autoFocus
          placeholder="搜索命令..."
          value={commandKeyword}
          onChange={(event) => setCommandKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              closeCommandDrawer()
              return
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              if (drawerCommands.length === 0) return
              setActiveCommandIndex((prev) => (prev + 1) % drawerCommands.length)
              return
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              if (drawerCommands.length === 0) return
              setActiveCommandIndex((prev) => (prev - 1 + drawerCommands.length) % drawerCommands.length)
              return
            }
            if (event.key === 'Tab') {
              event.preventDefault()
              setDrawerGroupFocus((prev) => (prev === '导航' ? '动作' : '导航'))
              setActiveCommandIndex(0)
              return
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              executeCommand(drawerCommands[activeCommandIndex] || drawerCommands[0])
              closeCommandDrawer()
            }
          }}
        />
        {drawerCommands.length === 0 ? (
          <Card size="small">没有匹配命令</Card>
        ) : (
          <List
            size="small"
            bordered
            dataSource={drawerCommands}
            renderItem={(item) => {
              const index = drawerCommands.findIndex((command) => command.id === item.id)
              const active = index === activeCommandIndex
              return (
                <List.Item
                  style={{
                    cursor: 'pointer',
                    borderRadius: 8,
                    padding: '9px 12px',
                    background: active ? 'rgba(22,119,255,0.12)' : 'transparent'
                  }}
                  onMouseEnter={() => setActiveCommandIndex(index)}
                  onClick={() => {
                    executeCommand(item)
                    closeCommandDrawer()
                  }}
                >
                  <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
                    <Space direction="vertical" size={0}>
                      <Typography.Text strong>{highlightText(item.label, commandKeyword)}</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {item.group} · {highlightText(item.hint, commandKeyword)}
                      </Typography.Text>
                    </Space>
                    <Typography.Text className="kbd-hint">
                      {item.shortcut || '↵'}
                    </Typography.Text>
                  </Space>
                </List.Item>
              )
            }}
          />
        )}
        <Typography.Text className="hotkey-hint">提示：Tab 切换分组焦点（导航/动作）</Typography.Text>
      </Space>
    </Drawer>
    <Modal
      title="快捷键帮助"
      open={shortcutOpen}
      onCancel={() => setShortcutOpen(false)}
      footer={null}
      width={680}
      destroyOnClose
    >
      <List
        size="small"
        bordered
        dataSource={[
          'Ctrl/Cmd + K：打开命令面板',
          '？：打开快捷键帮助（非输入状态）',
          'Ctrl/Cmd + Enter：执行当前页面主操作（生成/转换/渲染）',
          'Ctrl/Cmd + Shift + C：复制转换后代码（Mermaid 工作台 / 预览页）'
        ]}
        renderItem={(item) => <List.Item>{item}</List.Item>}
      />
    </Modal>
    </div>
    </ConfigProvider>
  )
}

export default App