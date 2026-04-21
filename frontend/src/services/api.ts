import axios from 'axios'
import { APIResponse, SQLParseResult, Project, ViewMode } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export const sqlService = {
  parse: async (sql: string): Promise<APIResponse<SQLParseResult>> => {
    const response = await api.post('/sql/parse', { sql })
    return response.data
  },

  generateDiagram: async (
    sql: string,
    theme: string = 'default',
    viewMode: ViewMode = 'classic',
    chenPinnedEntities: string[] = []
  ): Promise<APIResponse<any>> => {
    const response = await api.post('/sql/generate', { sql, theme, viewMode, chenPinnedEntities })
    return response.data
  },

  transformPreview: async (
    code: string,
    viewMode: ViewMode = 'classic',
    theme: string = 'default',
    chenPinnedEntities: string[] = []
  ): Promise<APIResponse<{ diagramCode: string }>> => {
    const response = await api.post('/sql/transform-preview', {
      code,
      viewMode,
      theme,
      chenPinnedEntities
    })
    return response.data
  }
}

export const projectService = {
  getAll: async (): Promise<APIResponse<Project[]>> => {
    const response = await api.get('/projects')
    return response.data
  },

  getById: async (id: string): Promise<APIResponse<Project>> => {
    const response = await api.get(`/projects/${id}`)
    return response.data
  },

  create: async (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<APIResponse<Project>> => {
    const response = await api.post('/projects', project)
    return response.data
  },

  update: async (id: string, project: Partial<Project>): Promise<APIResponse<Project>> => {
    const response = await api.put(`/projects/${id}`, project)
    return response.data
  },

  delete: async (id: string): Promise<APIResponse<void>> => {
    const response = await api.delete(`/projects/${id}`)
    return response.data
  },
}

type ExportRequestOptions = {
  schemaName?: string
  imageScale?: 1 | 2 | 3
  projectName?: string
  version?: string
  includeProjectMeta?: boolean
  pdfPageStrategy?: 'original' | 'a4-landscape'
  titleTemplateLocale?: 'zh' | 'en'
  titleFieldOrder?: Array<'mode' | 'schema' | 'exported' | 'project' | 'version'>
  showUTC?: boolean
}

async function postExportBlob(
  path: string,
  body: Record<string, unknown>
): Promise<Blob> {
  const response = await api.post(path, body, {
    responseType: 'blob',
    timeout: 120000,
    validateStatus: () => true
  })
  if (response.status >= 200 && response.status < 300) {
    return response.data as Blob
  }
  let detail = `导出失败（HTTP ${response.status}）`
  try {
    const text = await (response.data as Blob).text()
    const parsed = JSON.parse(text) as { error?: string; message?: string }
    if (typeof parsed.error === 'string' && parsed.error.trim()) {
      detail = parsed.error.trim()
    } else if (typeof parsed.message === 'string' && parsed.message.trim()) {
      detail = parsed.message.trim()
    }
  } catch {
    // keep generic detail
  }
  throw new Error(detail)
}

export const exportService = {
  exportSVG: async (
    sourceCode: string,
    theme: string = 'default',
    viewMode: ViewMode = 'classic',
    chenPinnedEntities: string[] = [],
    options: ExportRequestOptions = {}
  ): Promise<Blob> => {
    return postExportBlob('/export/svg', {
      sql: sourceCode,
      code: sourceCode,
      theme,
      viewMode,
      chenPinnedEntities,
      ...options
    })
  },

  exportPNG: async (
    sourceCode: string,
    theme: string = 'default',
    viewMode: ViewMode = 'classic',
    chenPinnedEntities: string[] = [],
    options: ExportRequestOptions = {}
  ): Promise<Blob> => {
    return postExportBlob('/export/png', {
      sql: sourceCode,
      code: sourceCode,
      theme,
      viewMode,
      chenPinnedEntities,
      ...options
    })
  },

  exportPDF: async (
    sourceCode: string,
    theme: string = 'default',
    viewMode: ViewMode = 'classic',
    chenPinnedEntities: string[] = [],
    options: ExportRequestOptions = {}
  ): Promise<Blob> => {
    return postExportBlob('/export/pdf', {
      sql: sourceCode,
      code: sourceCode,
      theme,
      viewMode,
      chenPinnedEntities,
      ...options
    })
  },
}

export default api