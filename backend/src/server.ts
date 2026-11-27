import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import api from './routes/api.js';
import { errors } from './middleware/error.js';

const app = express();
export default app;

const allowedOrigins = (
  process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:4173'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      const isVercelPreview =
        Boolean(origin) &&
        /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin || '');
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        (isVercelPreview && process.env.ALLOW_VERCEL_PREVIEW_ORIGINS === 'true')
      ) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
  })
);
app.use(express.json({ limit: '2mb' }));
app.use('/api', api);
app.use(errors);

const port = Number(process.env.PORT || 4000);
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`EduPath API on http://localhost:${port}`);
  });
}
