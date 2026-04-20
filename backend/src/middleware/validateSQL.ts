import { Request, Response, NextFunction } from 'express';
import { createError } from './errorHandler';

export const validateSQL = (req: Request, res: Response, next: NextFunction) => {
  const { sql } = req.body;
  
  if (!sql || typeof sql !== 'string') {
    return next(createError('SQL is required and must be a string', 400));
  }
  
  const trimmed = sql.trim();
  if (trimmed.length === 0) {
    return next(createError('SQL cannot be empty', 400));
  }

  // The SQL text is parsed only and never executed. Keep validation permissive.
  // Guard against abuse by limiting payload size.
  if (trimmed.length > 1_000_000) {
    return next(createError('SQL is too large (max 1,000,000 characters)', 413));
  }
  
  next();
};