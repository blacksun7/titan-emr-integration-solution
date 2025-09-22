import express from 'express';
import logger from '../utils/logger.js';
import { parseMessage, validateMessage, mapToFhir, buildBundle, toOperationOutcome } from '../mapping/mapper.js';
import { medplumSearch, medplumCreate, medplumUpdate } from '../services/medplum.js';

const UPSERT = (process.env.UPSERT_TO_MEDPLUM || 'false').toLowerCase() === 'true';
const MRN_SYSTEM = process.env.MRN_SYSTEM || 'urn:mrn:titan-intake';

export const hl7InboundRouter = express.Router();

hl7InboundRouter.post('/inbound', async (req, res) => {
  try {
    const text = typeof req.body === 'string' ? req.body : (req.body?.toString?.() || '');
    logger.info('Inbound HL7 received', { length: text.length });
    logger.debug('HL7 raw', { hl7: text });

    if (!text || !/^MSH\|/m.test(text)) {
      return res.status(400).json(toOperationOutcome([{ message: 'Expected HL7 v2 payload with MSH' }]));
    }
    const msg = parseMessage(text);
    const validation = validateMessage(msg);
    if (!validation.valid) {
      logger.warn('HL7 schema validation failed', { errors: validation.errors });
      return res.status(400).json(toOperationOutcome(validation.errors || [{ message: 'Invalid message' }]));
    }

    const { patient, coverage, observations } = mapToFhir(msg);

    // Optional upsert
    let patientRef: string | undefined = undefined;
    if (UPSERT && patient?.identifier?.[0]?.value) {
      const idVal = patient.identifier[0].value as string;
      let found: any = null;
      const r = await medplumSearch('Patient', { identifier: `${MRN_SYSTEM}|${idVal}` });
      if (r.data.entry?.[0]?.resource) found = r.data.entry[0].resource;
      if (found) {
        const u = await medplumUpdate('Patient', found.id, { ...found, ...patient });
        patientRef = `Patient/${u.data.id}`;
      } else {
        const c = await medplumCreate('Patient', patient);
        patientRef = `Patient/${c.data.id}`;
      }
      if (coverage && (coverage.subscriberId || coverage.payor)) {
        if (patientRef) coverage.beneficiary = { reference: patientRef };
        await medplumCreate('Coverage', coverage).catch(() => null);
      }
    }

    const bundle = buildBundle(patient, coverage, observations, patientRef);
    logger.info('Returning FHIR Bundle', { entries: bundle.entry?.length || 0 });
    return res.status(200).json(bundle);
  } catch (e: any) {
    const status = e?.response?.status || 500;
    logger.error('Inbound processing failed', { status, error: e?.message });
    return res.status(status).json(toOperationOutcome([{ message: e?.response?.data || e?.message || 'Server error' }]));
  }
});
