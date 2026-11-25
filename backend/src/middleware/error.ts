import type { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';

interface AppError extends Error {
  status?: number;
  type?: string;
}

export function errors(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error(err);

  if (err instanceof ZodError) {
    const details = err.issues
      .map((issue) => `${issue.path.join('.') || 'field'}: ${issue.message}`)
      .join('; ');
    return res.status(400).json({ error: `Validation error: ${details}` });
  }

  if (err instanceof MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: err.message });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON request body' });
  }

  return res
    .status(err.status || 500)
    .json({ error: err.message || 'Internal server error' });
}
