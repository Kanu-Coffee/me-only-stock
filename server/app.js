import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import brokerRouter from './routes/brokers.js';
import authRouter from './routes/auth.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/brokers', brokerRouter);

const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

export default app;
