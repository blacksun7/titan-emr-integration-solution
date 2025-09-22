import Ajv from 'ajv';
import logger from '../utils/logger';

import schemaA04 from '../schemas/ADT_A04.json';
import schemaA08 from '../schemas/ADT_A08.json';

const MRN_SYSTEM = process.env.MRN_SYSTEM || 'urn:mrn:titan-intake';

const ajv = new Ajv();
const validateA04 = ajv.compile(schemaA04);
const validateA08 = ajv.compile(schemaA08);

/**
 * Helper: Extract HL7 field value by segment + index
 */
function getField(segments: string[][], segType: string, index: number): string | undefined {
  const seg = segments.find(s => s[0] === segType);
  return seg ? seg[index] : undefined;
}

/**
 * Convert message into a "segment presence object" for schema validation
 */
function toSegmentPresenceObject(segments: string[][]) {
  const result: Record<string, boolean> = {};
  segments.forEach(seg => {
    result[seg[0]] = true;
  });
  return result;
}

/**
 * Validate HL7 message against schema (A04 or A08)
 */
export function validateMessage(segments: string[][]) {
  const msh9 = getField(segments, 'MSH', 8);
  let type = '';

  if (msh9) {
    const parts = msh9.split('^');
    type = `${parts[0] || ''}^${parts[1] || ''}`;
  }

  const json = toSegmentPresenceObject(segments);
  const valid =
    type === 'ADT^A04'
      ? validateA04(json)
      : type === 'ADT^A08'
      ? validateA08(json)
      : false;

  const errors =
    type === 'ADT^A04'
      ? validateA04.errors
      : type === 'ADT^A08'
      ? validateA08.errors
      : [{ message: 'Unsupported message type' }];

  if (!valid) {
    logger.error('HL7 validation failed', { type, errors });
  }

  return { type, valid, errors };
}

/**
 * Map HL7 message into structured FHIR objects
 */
export function mapToFhir(segments: string[][]) {
  const patient: any = {
    resourceType: 'Patient',
    identifier: [
      {
        system: MRN_SYSTEM,
        value: getField(segments, 'PID', 3),
      },
    ],
    name: [
      {
        family: getField(segments, 'PID', 5)?.split('^')[0],
        given: [getField(segments, 'PID', 5)?.split('^')[1]],
      },
    ],
    gender: hl7GenderToFhirGender(getField(segments, 'PID', 8)),
    birthDate: hl7DateToFhirDate(getField(segments, 'PID', 7)),
  };

  const coverage: any = {
    resourceType: 'Coverage',
    identifier: [
      {
        system: 'INSURANCE',
        value: getField(segments, 'IN1', 2),
      },
    ],
  };

  const obxSegs = segments.filter(s => s[0] === 'OBX');
  const observations = obxSegs.map(seg => ({
    resourceType: 'Observation',
    code: { text: seg[3] },
    valueString: seg[5],
    effectiveDateTime: seg[14] || new Date().toISOString(),
  }));

  return { patient, coverage, observations };
}

/**
 * HL7 → FHIR date transform
 */
function hl7DateToFhirDate(value?: string): string | undefined {
  if (!value) return undefined;
  return `${value.substring(0, 4)}-${value.substring(4, 6)}-${value.substring(6, 8)}`;
}

/**
 * HL7 → FHIR gender transform
 */
function hl7GenderToFhirGender(value?: string): string | undefined {
  if (!value) return undefined;
  switch (value.toUpperCase()) {
    case 'M':
      return 'male';
    case 'F':
      return 'female';
    default:
      return 'unknown';
  }
}
