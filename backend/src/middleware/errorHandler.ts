import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';
  
  console.error(err);

  if (process.env.NODE_ENV === 'development') {
    return res.status(statusCode).json({
      status,
      error: err,
      message: err.message,
      stack: err.stack
    });
  }

  // Operational, trusted error: send message to client
  if (err.isOperational) {
    return res.status(statusCode).json({
      status,
      message: err.message
    });
  }

  // Programming or unknown error: don't leak error details
  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong!'
  });
};

export const createError = (message: string, statusCode: number): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
  error.isOperational = true;
  return error;
};