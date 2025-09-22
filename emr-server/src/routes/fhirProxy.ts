import express from 'express';
import { medplumSearch } from '../services/medplum.js';
import logger from '../utils/logger.js';

export const fhirProxyRouter = express.Router();

fhirProxyRouter.get('/:resourceType', async (req, res) => {
  try {
    logger.info('FHIR proxy GET', { resourceType: req.params.resourceType, query: req.query });
    const data = await medplumSearch(req.params.resourceType, req.query);
    res.status(200).json(data.data);
  } catch (e: any) {
    logger.error('FHIR proxy error', { status: e?.response?.status, data: e?.response?.data });
    res.status(e?.response?.status || 500).json({ error: e?.response?.data || e.message });
  }
});

['post','put','patch','delete'].forEach((m) => {
  // @ts-ignore
  fhirProxyRouter[m]('/:resourceType', (_req, res) => res.status(405).json({ error: 'Read-only proxy' }));
});
