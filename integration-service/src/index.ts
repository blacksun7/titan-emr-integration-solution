import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import dotenv from 'dotenv';
import logger from './utils/logger.js';
import { syncRouter } from './routes/sync.js';

dotenv.config();
const app = express();

app.use(morgan('dev'));
app.use(bodyParser.json({ limit: '1mb' }));

app.use('/sync', syncRouter);

app.use((err: any, _req: any, res: any, _next: any) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const port = process.env.PORT || 8082;
app.listen(port, () => logger.info(`Integration service v4 listening on :${port}`));
