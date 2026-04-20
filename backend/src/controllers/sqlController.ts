import { Request, Response } from 'express';
import { SQLParser } from '../utils/sqlParser';
import { MermaidERParser } from '../utils/mermaidERParser';
import { MermaidService } from '../utils/mermaidService';
import { validateSQL } from '../middleware/validateSQL';

export const sqlController = {
  parse: [
    validateSQL,
    (req: Request, res: Response) => {
      try {
        const { sql } = req.body;
        const result = SQLParser.parseSQL(sql);
        
        res.json({
          success: true,
          data: result
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  ],

  generateDiagram: [
    validateSQL,
    async (req: Request, res: Response) => {
      try {
        const { sql, theme = 'default', viewMode = 'classic', chenPinnedEntities = [] } = req.body;
        const result = SQLParser.parseSQL(sql);
        
        const mermaidService = new MermaidService();
        const diagram = await mermaidService.generateDiagram(
          result.entities, 
          result.relationships,
          { theme, securityLevel: 'loose', fontFamily: 'sans-serif', viewMode, chenPinnedEntities }
        );
        
        res.json({
          success: true,
          data: {
            diagram,
            entities: result.entities,
            relationships: result.relationships,
            errors: result.errors
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  ],

  transformPreview: [
    async (req: Request, res: Response) => {
      try {
        const body = (req.body || {}) as {
          code?: string;
          viewMode?: 'classic' | 'physical' | 'chen';
          theme?: string;
          chenPinnedEntities?: string[];
        };
        const code = typeof body.code === 'string' ? body.code : '';
        const viewMode = body.viewMode || 'classic';
        const theme = body.theme || 'default';
        const chenPinnedEntities = Array.isArray(body.chenPinnedEntities) ? body.chenPinnedEntities : [];

        if (!code || typeof code !== 'string' || code.trim().length === 0) {
          return res.status(400).json({ success: false, error: 'code is required' });
        }

        const source = code.trim();
        const mermaidService = new MermaidService();
        let entities;
        let relationships;

        if (/^erDiagram\b/m.test(source)) {
          const parsed = MermaidERParser.parse(source);
          entities = parsed.entities;
          relationships = parsed.relationships;
        } else if (/CREATE\s+TABLE/i.test(source)) {
          const parsed = SQLParser.parseSQL(source);
          entities = parsed.entities;
          relationships = parsed.relationships;
        } else if (/^flowchart\b/m.test(source) && viewMode === 'chen') {
          return res.json({
            success: true,
            data: { diagramCode: source }
          });
        } else {
          return res.status(400).json({
            success: false,
            error: 'Unsupported input format. Use erDiagram, SQL DDL, or flowchart for Chen mode.'
          });
        }

        const diagramCode = mermaidService.generateDiagramCode(entities, relationships, {
          theme,
          securityLevel: 'loose',
          fontFamily: 'sans-serif',
          viewMode,
          chenPinnedEntities
        });

        return res.json({
          success: true,
          data: { diagramCode }
        });
      } catch (error) {
        const fallbackCode =
          req.body && typeof req.body.code === 'string' ? req.body.code : '';
        return res.json({
          success: true,
          data: {
            diagramCode: fallbackCode,
            warning: error instanceof Error ? error.message : 'Transform failed, fallback to original code'
          }
        });
      }
    }
  ]
};