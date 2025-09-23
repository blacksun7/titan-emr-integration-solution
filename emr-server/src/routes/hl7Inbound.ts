import { Router, Request, Response } from 'express';
import axios from 'axios';
import logger from '../utils/logger.js';

const router = Router();

// Load from .env
const MEDPLUM_BASE_URL = process.env.MEDPLUM_BASE_URL || 'https://api.medplum.com';
const MEDPLUM_CLIENT_ID = process.env.MEDPLUM_CLIENT_ID || '';
const MEDPLUM_CLIENT_SECRET = process.env.MEDPLUM_CLIENT_SECRET || '';
const MEDPLUM_SCOPES = process.env.MEDPLUM_SCOPES || 'system/*.read system/*.write';
const UPSERT_TO_MEDPLUM = process.env.UPSERT_TO_MEDPLUM === 'true';

/**
 * Parse HL7 string into array of segments
 */
/**
 * Parse HL7 string into array of segments
 */
function parseHL7(raw: string): string[][] {
  return raw
    .trim()
    .split(/\r?\n/)
    .map(line => line.split('|'));
}

/**
 * Helper to extract a field value from a segment
 */
function getField(segments: string[][], segType: string, index: number): string | undefined {
  const seg = segments.find(s => s[0] === segType);
  return seg ? seg[index] : undefined;
}

/**
 * Map HL7 segments → FHIR Bundle
 */
function mapToFhir(segments: string[][]): any {
  const patient: any = {
    resourceType: 'Patient',
    identifier: [{ system: 'MRN', value: getField(segments, 'PID', 3) }],
    name: [
      {
        family: getField(segments, 'PID', 5)?.split('^')[0],
        given: [getField(segments, 'PID', 5)?.split('^')[1]],
      },
    ],
    gender: getField(segments, 'PID', 8) === 'M' ? 'male' : 'female',
    birthDate: getField(segments, 'PID', 7),
  };

  const coverage: any = {
    resourceType: 'Coverage',
    identifier: [{ system: 'INSURANCE', value: getField(segments, 'IN1', 2) }],
  };

  const obxSegs = segments.filter(s => s[0] === 'OBX');
  const observations = obxSegs.map(seg => ({
    resourceType: 'Observation',
    code: { text: seg[3] },
    valueString: seg[5],
    effectiveDateTime: seg[14] || new Date().toISOString(),
  }));

  return {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: [{ resource: patient }, { resource: coverage }, ...observations.map(obs => ({ resource: obs }))],
  };
}

/**
 * Get OAuth2 token from Medplum
 */
async function getMedplumToken(): Promise<string> {
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', MEDPLUM_CLIENT_ID);
  params.append('client_secret', MEDPLUM_CLIENT_SECRET);
  params.append('scope', MEDPLUM_SCOPES);

  const resp = await axios.post(`${MEDPLUM_BASE_URL}/oauth2/token`, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 5000,
  });

  return resp.data.access_token;
}

/**
 * Upsert FHIR Bundle into Medplum with retries
 */
async function upsertToMedplum(bundle: any, retries = 3, delayMs = 2000): Promise<any> {
  let lastError: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const token = await getMedplumToken();
      const resp = await axios.post(`${MEDPLUM_BASE_URL}/fhir/R4`, bundle, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/fhir+json',
        },
        timeout: 8000,
      });
      return resp.data;
    } catch (err: any) {
      lastError = err;
      logger.warn(`Medplum upsert attempt ${attempt} failed`, { error: err.message });
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs * attempt)); // exponential backoff
      }
    }
  }
  logger.error('Medplum upsert failed after retries', { error: lastError });
  throw lastError;
}

/**
 * POST /hl7/inbound
 */
router.post('/inbound', async (req: Request, res: Response) => {
  try {
    const raw = req.body as string;
    const segments = parseHL7(raw);

    if (!segments || !segments.length) {
      return res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'error', code: 'invalid', details: { text: 'Invalid HL7 message' } }],
      });
    }

    const fhirBundle = mapToFhir(segments);
    logger.info('HL7 message mapped to FHIR', { bundle: fhirBundle });

    let result: any = fhirBundle;
    if (UPSERT_TO_MEDPLUM) {
      try {
        logger.info('Upserting Bundle to Medplum...');
        result = await upsertToMedplum(fhirBundle);
        logger.info('Medplum response', { response: result });
      } catch (err: any) {
        return res.status(502).json({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'error',
              code: 'exception',
              details: { text: `Medplum upsert failed: ${err.message}` },
            },
          ],
        });
      }
    }

    return res.json(result);
  } catch (err: any) {
    logger.error('HL7 inbound error', { error: err });
    return res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'exception', details: { text: err.message } }],
    });
  }
});

export default router;
