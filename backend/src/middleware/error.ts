import type { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';

interface AppError extends Error {
  status?: number;
  type?: string;
  code?: string;
}

export function errors(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const status = err.status || 500;

  if (status >= 500) {
    console.error('[EduPath Server Error]', err);
  }

  if (err instanceof ZodError) {
    const details = err.issues
      .map((issue) => `${issue.path.join('.') || 'field'}: ${issue.message}`)
      .join('; ');
    return res.status(400).json({ error: `Validation error: ${details}` });
  }

  if (err instanceof MulterError) {
    const code = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(code).json({ error: err.message });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON request body' });
  }

  const safeMessage =
    status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error';

  return res.status(status).json({ error: safeMessage });
}
