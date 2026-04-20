import { Request, Response, NextFunction } from 'express';
import { createError } from './errorHandler';

export const validateSQL = (req: Request, res: Response, next: NextFunction) => {
  const { sql } = req.body;
  
  if (!sql || typeof sql !== 'string') {
    return next(createError('SQL is required and must be a string', 400));
  }
  
  if (sql.trim().length === 0) {
    return next(createError('SQL cannot be empty', 400));
  }
  
  // Basic SQL injection protection
  const dangerousPatterns = [
    /;\s*DROP\s+/i,
    /;\s*DELETE\s+/i,
    /;\s*UPDATE\s+/i,
    /;\s*INSERT\s+/i,
    /;\s*ALTER\s+/i,
    /;\s*CREATE\s+/i,
    /;\s*TRUNCATE\s+/i,
    /xp_/i,
    /sp_/i,
    /@@/i,
    /--/i,
    /\/\*/i,
    /\*\//i
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(sql)) {
      return next(createError('SQL contains potentially dangerous content', 400));
    }
  }
  
  next();
};