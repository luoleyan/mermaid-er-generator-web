# Mermaid ER Generator Web

一个基于 Web 的 Mermaid ER 图生成工具，支持 SQL DDL 输入和实时可视化。

## 功能特性

- 📝 **SQL DDL 输入** - 支持粘贴 SQL DDL 语句
- 🔄 **实时解析** - 实时解析 SQL 并显示实体列表
- 📊 **可视化 ER 图** - 使用 Mermaid.js 渲染 ER 图
- 📤 **多格式导出** - 支持 PNG、SVG、PDF 导出
- 💾 **项目管理** - 支持保存和加载项目
- 🧪 **完整测试** - 单元测试、集成测试、E2E 测试

## 技术栈

### 后端
- Node.js + Express + TypeScript
- SQLite 数据库
- Mermaid.js 用于图表生成

### 前端
- React 18 + TypeScript + Vite
- Ant Design UI 组件库
- Mermaid.js 图表渲染

### 测试
- Jest + React Testing Library
- Supertest (API 测试)
- Playwright (E2E 测试)

## 项目结构

```
mermaid-er-generator-web/
├── backend/          # Node.js/Express 后端
├── frontend/         # React 前端
├── shared/           # 共享类型定义
├── tests/            # 测试套件
└── package.json      # 根配置文件
```

## 快速开始

### 安装依赖
```bash
npm run install:all
```

### 开发模式
```bash
npm run dev
```

### 构建项目
```bash
npm run build
```

### 运行测试
```bash
npm test
```

## 使用说明

1. 在 SQL 输入框中粘贴您的 DDL 语句
2. 系统会自动解析并显示实体列表
3. ER 图会实时更新显示
4. 可以导出为不同格式或保存项目

## 开发文档

详细的开发文档请参考各子目录中的 README 文件。

## 许可证

MIT License