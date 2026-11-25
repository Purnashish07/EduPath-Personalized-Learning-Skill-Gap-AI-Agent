import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import api from './routes/api.js';
import { errors } from './middleware/error.js';

const app = express();

const allowedOrigins = (
  process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:4173'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
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
app.listen(port, () => {
  console.log(`EduPath API on http://localhost:${port}`);
});
