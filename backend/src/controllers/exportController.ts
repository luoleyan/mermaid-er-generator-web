import { Request, Response } from 'express';
import { MermaidService } from '../utils/mermaidService';
import { createError } from '../middleware/errorHandler';

export const exportController = {
  async exportSVG(req: Request, res: Response) {
    try {
      const { sql, theme = 'default' } = req.body;
      
      if (!sql) {
        throw createError('SQL is required', 400);
      }

      // Import SQL parser dynamically to avoid circular dependencies
      const { SQLParser } = await import('../utils/sqlParser');
      const result = SQLParser.parseSQL(sql);
      
      const mermaidService = new MermaidService();
      const svg = await mermaidService.generateDiagram(
        result.entities,
        result.relationships,
        { theme, securityLevel: 'loose', fontFamily: 'sans-serif' }
      );

      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', 'attachment; filename="er-diagram.svg"');
      res.send(svg);
    } catch (error) {
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
      const { sql, theme = 'default' } = req.body;
      
      if (!sql) {
        throw createError('SQL is required', 400);
      }

      // Import SQL parser dynamically to avoid circular dependencies
      const { SQLParser } = await import('../utils/sqlParser');
      const result = SQLParser.parseSQL(sql);
      
      const mermaidService = new MermaidService();
      const svg = await mermaidService.renderToPNG(
        result.entities,
        result.relationships,
        { theme, securityLevel: 'loose', fontFamily: 'sans-serif' }
      );

      // For PNG export, you'd typically use a library like puppeteer
      // Here we're returning SVG as a placeholder
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', 'attachment; filename="er-diagram.png"');
      res.send(svg);
    } catch (error) {
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
      const { sql, theme = 'default' } = req.body;
      
      if (!sql) {
        throw createError('SQL is required', 400);
      }

      // Import SQL parser dynamically to avoid circular dependencies
      const { SQLParser } = await import('../utils/sqlParser');
      const result = SQLParser.parseSQL(sql);
      
      const mermaidService = new MermaidService();
      const svg = await mermaidService.generateDiagram(
        result.entities,
        result.relationships,
        { theme, securityLevel: 'loose', fontFamily: 'sans-serif' }
      );

      // For PDF export, you'd typically use a library like puppeteer
      // Here we're returning SVG as a placeholder
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="er-diagram.pdf"');
      res.send('PDF export would be implemented here with a library like puppeteer');
    } catch (error) {
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