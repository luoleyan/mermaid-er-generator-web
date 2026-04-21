import { Request, Response } from 'express';
import { MermaidService } from '../utils/mermaidService';
import { MermaidERParser } from '../utils/mermaidERParser';
import { createError } from '../middleware/errorHandler';

export const exportController = {
  normalizeImageScale(scale: unknown): 1 | 2 | 3 {
    return scale === 2 || scale === 3 ? scale : 1;
  },

  async resolveSource(req: Request): Promise<{
    source: string;
    kind: 'sql' | 'erDiagram' | 'chenFlowchart';
    viewMode: 'classic' | 'physical' | 'chen';
  }> {
    const body = (req.body || {}) as { sql?: string; code?: string; viewMode?: 'classic' | 'physical' | 'chen' };
    const source = typeof body.code === 'string' && body.code.trim().length > 0
      ? body.code.trim()
      : (typeof body.sql === 'string' ? body.sql.trim() : '');
    const viewMode = body.viewMode || 'classic';

    if (!source) {
      throw createError('SQL or Mermaid code is required', 400);
    }
    if (/^erDiagram\b/m.test(source)) {
      return { source, kind: 'erDiagram', viewMode };
    }
    if (/^flowchart\b/m.test(source) && viewMode === 'chen') {
      return { source, kind: 'chenFlowchart', viewMode };
    }
    if (/CREATE\s+TABLE/i.test(source)) {
      return { source, kind: 'sql', viewMode };
    }
    throw createError('Unsupported input format for export', 400);
  },

  buildExportOptions(input: {
    schemaName?: unknown;
    imageScale?: unknown;
    projectName?: unknown;
    version?: unknown;
    includeProjectMeta?: unknown;
    pdfPageStrategy?: unknown;
    titleTemplateLocale?: unknown;
    titleFieldOrder?: unknown;
    showUTC?: unknown;
  }): {
    schemaName?: string;
    includeTitleBar: true;
    imageScale: 1 | 2 | 3;
    projectName?: string;
    version?: string;
    includeProjectMeta: boolean;
    pdfPageStrategy?: 'original' | 'a4-landscape';
    titleTemplateLocale?: 'zh' | 'en';
    titleFieldOrder?: Array<'mode' | 'schema' | 'exported' | 'project' | 'version'>;
    showUTC?: boolean;
  } {
    const schemaName = typeof input.schemaName === 'string' ? input.schemaName.trim() : '';
    const projectName = typeof input.projectName === 'string' ? input.projectName.trim() : '';
    const version = typeof input.version === 'string' ? input.version.trim() : '';

    const titleTemplateLocale = input.titleTemplateLocale === 'zh' ? 'zh' : (input.titleTemplateLocale === 'en' ? 'en' : undefined);
    const titleFieldOrder = Array.isArray(input.titleFieldOrder)
      ? input.titleFieldOrder.filter(
          (item): item is 'mode' | 'schema' | 'exported' | 'project' | 'version' =>
            item === 'mode' || item === 'schema' || item === 'exported' || item === 'project' || item === 'version'
        )
      : undefined;

    return {
      includeTitleBar: true,
      imageScale: exportController.normalizeImageScale(input.imageScale),
      includeProjectMeta: input.includeProjectMeta === true,
      ...(schemaName ? { schemaName } : {}),
      ...(projectName ? { projectName } : {}),
      ...(version ? { version } : {}),
      ...(input.pdfPageStrategy === 'a4-landscape'
        ? { pdfPageStrategy: 'a4-landscape' as const }
        : {}),
      ...(titleTemplateLocale ? { titleTemplateLocale } : {}),
      ...(titleFieldOrder && titleFieldOrder.length > 0 ? { titleFieldOrder } : {}),
      ...(typeof input.showUTC === 'boolean' ? { showUTC: input.showUTC } : {})
    };
  },

  async exportSVG(req: Request, res: Response) {
    try {
      const {
        theme = 'default',
        viewMode = 'classic',
        chenPinnedEntities = [],
        schemaName,
        imageScale = 1,
        projectName,
        version,
        includeProjectMeta = false
        ,
        titleTemplateLocale,
        titleFieldOrder,
        showUTC
      } = req.body;
      const resolved = await exportController.resolveSource(req);
      
      const mermaidService = new MermaidService();
      const config = {
        theme,
        securityLevel: 'loose' as const,
        fontFamily: 'sans-serif',
        viewMode,
        chenPinnedEntities,
        exportOptions: exportController.buildExportOptions({
          schemaName,
          imageScale,
          projectName,
          version,
          includeProjectMeta,
          titleTemplateLocale,
          titleFieldOrder,
          showUTC
        })
      };
      let svg: string;
      if (resolved.kind === 'sql') {
        const { SQLParser } = await import('../utils/sqlParser');
        const result = SQLParser.parseSQL(resolved.source);
        svg = await mermaidService.generateDiagram(result.entities, result.relationships, config);
      } else if (resolved.kind === 'erDiagram') {
        const parsed = MermaidERParser.parse(resolved.source);
        svg = await mermaidService.generateDiagram(parsed.entities, parsed.relationships, config);
      } else {
        svg = await mermaidService.renderCodeToSVG(resolved.source, config);
      }

      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', 'attachment; filename="er-diagram.svg"');
      res.send(svg);
    } catch (error) {
      console.error('[export/svg]', error);
      if (error instanceof Error && error.message.includes('required')) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },

  async exportPNG(req: Request, res: Response) {
    try {
      const {
        theme = 'default',
        viewMode = 'classic',
        chenPinnedEntities = [],
        schemaName,
        imageScale = 1,
        projectName,
        version,
        includeProjectMeta = false
        ,
        titleTemplateLocale,
        titleFieldOrder,
        showUTC
      } = req.body;
      const resolved = await exportController.resolveSource(req);
      
      const mermaidService = new MermaidService();
      const config = {
        theme,
        securityLevel: 'loose' as const,
        fontFamily: 'sans-serif',
        viewMode,
        chenPinnedEntities,
        exportOptions: exportController.buildExportOptions({
          schemaName,
          imageScale,
          projectName,
          version,
          includeProjectMeta,
          titleTemplateLocale,
          titleFieldOrder,
          showUTC
        })
      };
      let png: Buffer;
      if (resolved.kind === 'sql') {
        const { SQLParser } = await import('../utils/sqlParser');
        const result = SQLParser.parseSQL(resolved.source);
        png = await mermaidService.renderToPNG(result.entities, result.relationships, config);
      } else if (resolved.kind === 'erDiagram') {
        const parsed = MermaidERParser.parse(resolved.source);
        png = await mermaidService.renderToPNG(parsed.entities, parsed.relationships, config);
      } else {
        png = await mermaidService.renderCodeToPNG(resolved.source, config);
      }

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', 'attachment; filename="er-diagram.png"');
      res.send(png);
    } catch (error) {
      console.error('[export/png]', error);
      if (error instanceof Error && error.message.includes('required')) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },

  async exportPDF(req: Request, res: Response) {
    try {
      const {
        theme = 'default',
        viewMode = 'classic',
        chenPinnedEntities = [],
        schemaName,
        imageScale = 1,
        projectName,
        version,
        includeProjectMeta = false,
        pdfPageStrategy = 'original',
        titleTemplateLocale,
        titleFieldOrder,
        showUTC
      } = req.body;
      const resolved = await exportController.resolveSource(req);
      
      const mermaidService = new MermaidService();
      const config = {
        theme,
        securityLevel: 'loose' as const,
        fontFamily: 'sans-serif',
        viewMode,
        chenPinnedEntities,
        exportOptions: exportController.buildExportOptions({
          schemaName,
          imageScale,
          projectName,
          version,
          includeProjectMeta,
          pdfPageStrategy,
          titleTemplateLocale,
          titleFieldOrder,
          showUTC
        })
      };
      let pdf: Buffer;
      if (resolved.kind === 'sql') {
        const { SQLParser } = await import('../utils/sqlParser');
        const result = SQLParser.parseSQL(resolved.source);
        pdf = await mermaidService.renderToPDF(result.entities, result.relationships, config);
      } else if (resolved.kind === 'erDiagram') {
        const parsed = MermaidERParser.parse(resolved.source);
        pdf = await mermaidService.renderToPDF(parsed.entities, parsed.relationships, config);
      } else {
        pdf = await mermaidService.renderCodeToPDF(resolved.source, config);
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="er-diagram.pdf"');
      res.send(pdf);
    } catch (error) {
      console.error('[export/pdf]', error);
      if (error instanceof Error && error.message.includes('required')) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }
};