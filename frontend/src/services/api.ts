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

export const exportService = {
  exportSVG: async (
    sql: string,
    theme: string = 'default',
    viewMode: ViewMode = 'classic',
    chenPinnedEntities: string[] = []
  ): Promise<Blob> => {
    const response = await api.post('/export/svg', { sql, theme, viewMode, chenPinnedEntities }, {
      responseType: 'blob'
    })
    return response.data
  },

  exportPNG: async (
    sql: string,
    theme: string = 'default',
    viewMode: ViewMode = 'classic',
    chenPinnedEntities: string[] = []
  ): Promise<Blob> => {
    const response = await api.post('/export/png', { sql, theme, viewMode, chenPinnedEntities }, {
      responseType: 'blob'
    })
    return response.data
  },

  exportPDF: async (
    sql: string,
    theme: string = 'default',
    viewMode: ViewMode = 'classic',
    chenPinnedEntities: string[] = []
  ): Promise<Blob> => {
    const response = await api.post('/export/pdf', { sql, theme, viewMode, chenPinnedEntities }, {
      responseType: 'blob'
    })
    return response.data
  },
}

export default api