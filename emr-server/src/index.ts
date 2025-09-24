import "dotenv/config";
import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import dotenv from 'dotenv';
import logger from './utils/logger.js';
import { tokenRouter, requireAuth } from './security/auth.js';
import { fhirProxyRouter } from './routes/fhirProxy.js';
import hl7InboundRouter from './routes/hl7Inbound.js';

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.text({ type: "text/plain" }));

app.use(morgan('dev'));
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.text({ type: ['text/*', 'application/hl7-v2'], limit: '1mb' }));

app.use('/auth', tokenRouter);
app.use('/fhir', requireAuth, fhirProxyRouter);
app.use('/hl7', requireAuth, hl7InboundRouter);
app.use('/hl7/inbound', requireAuth, hl7InboundRouter);

app.use((err: any, _req: any, res: any, _next: any) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const port = process.env.PORT || 8081;
app.listen(port, () => logger.info(`EMR server listening on :${port}`));
