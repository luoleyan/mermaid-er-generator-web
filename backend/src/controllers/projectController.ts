import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Project } from '../../../shared/types';
import { createError } from '../middleware/errorHandler';

// In-memory storage for demo purposes
// In production, you'd use a database
let projects: Project[] = [];

export const projectController = {
  getAll: (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        data: projects
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  },

  getById: (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const project = projects.find(p => p.id === id);
      
      if (!project) {
        throw createError('Project not found', 404);
      }
      
      res.json({
        success: true,
        data: project
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
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

  create: (req: Request, res: Response) => {
    try {
      const { name, description, sql } = req.body;
      
      if (!name || !sql) {
        throw createError('Name and SQL are required', 400);
      }

      const project: Project = {
        id: uuidv4(),
        name,
        description,
        sql,
        entities: [], // These would be populated by parsing the SQL
        relationships: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      projects.push(project);
      
      res.status(201).json({
        success: true,
        data: project
      });
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

  update: (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, sql } = req.body;
      
      const projectIndex = projects.findIndex(p => p.id === id);
      
      if (projectIndex === -1) {
        throw createError('Project not found', 404);
      }

      const updatedProject = {
        ...projects[projectIndex],
        name: name || projects[projectIndex].name,
        description: description !== undefined ? description : projects[projectIndex].description,
        sql: sql || projects[projectIndex].sql,
        updatedAt: new Date()
      };

      projects[projectIndex] = updatedProject;
      
      res.json({
        success: true,
        data: updatedProject
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
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

  delete: (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const projectIndex = projects.findIndex(p => p.id === id);
      
      if (projectIndex === -1) {
        throw createError('Project not found', 404);
      }

      projects.splice(projectIndex, 1);
      
      res.json({
        success: true,
        message: 'Project deleted successfully'
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
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