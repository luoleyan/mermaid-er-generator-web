import { Request, Response } from 'express';
import { SQLParser } from '../utils/sqlParser';
import { MermaidService } from '../utils/mermaidService';
import { validateSQL } from '../middleware/validateSQL';
import { createError } from '../middleware/errorHandler';

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
        const { sql, theme = 'default' } = req.body;
        const result = SQLParser.parseSQL(sql);
        
        const mermaidService = new MermaidService();
        const diagram = await mermaidService.generateDiagram(
          result.entities, 
          result.relationships,
          { theme, securityLevel: 'loose', fontFamily: 'sans-serif' }
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
  ]
};