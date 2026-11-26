import type { Request, Response, NextFunction } from 'express';

export function securityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
  res.setHeader('X-XSS-Protection', '0');
  next();
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip || 'local'}:${req.baseUrl}`;
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    if (entry.count >= options.maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error:
          options.message ||
          'Too many requests. Please wait a moment and try again.',
      });
    }

    entry.count += 1;
    return next();
  };
}

const USER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export function isValidUserId(value: string): boolean {
  return USER_ID_PATTERN.test(value);
}

export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() || 'document';
  return base.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'document';
}
