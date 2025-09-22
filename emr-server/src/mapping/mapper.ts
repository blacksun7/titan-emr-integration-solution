import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import hl7 from 'simple-hl7';
import logger from '../utils/logger.js';

const MRN_SYSTEM = process.env.MRN_SYSTEM || 'urn:mrn:titan-intake';

type MappingSpec = any;

function loadJson(rel: string) {
  const p = path.join(process.cwd(), 'mapping', rel);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function loadSchema(rel: string) {
  const p = path.join(process.cwd(), 'schemas', rel);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const mapping: MappingSpec = loadJson('mapping.json');
const ajv = new Ajv({ allErrors: true });

const schemaA04 = loadSchema('adt-a04.json');
const schemaA08 = loadSchema('adt-a08.json');
const validateA04 = ajv.compile(schemaA04);
const validateA08 = ajv.compile(schemaA08);

export function parseMessage(text: string) {
  logger.debug('Parsing HL7 text');
  return new (hl7 as any).Message(text);
}

export function validateMessage(msg: any) {
  const type = (msg.get('MSH.9.1') || '') + '^' + (msg.get('MSH.9.2') || '');
  const json = toSegmentPresenceObject(msg);
  const valid = (type === 'ADT^A04') ? validateA04(json) : (type === 'ADT^A08') ? validateA08(json) : false;
  const errors = (type === 'ADT^A04') ? validateA04.errors : (type === 'ADT^A08') ? validateA08.errors : [{ message: 'Unsupported message type' }];
  logger.info('HL7 validation result', { type, valid, errors });
  return { type, valid: !!valid, errors };
}

function toSegmentPresenceObject(msg: any) {
  const segs: Record<string, any[]> = {};
  ['MSH','PID','IN1','OBX'].forEach(s => {
    const exists = !!msg.get(`${s}.1`) || !!msg.get(`${s}.1.1`);
    if (exists) segs[s] = [{}];
  });
  return segs;
}

// ---- helpers ----
function setDeep(obj: any, pathStr: string, val: any) {
  const parts = pathStr.replace(/\]/g,'').split(/[.\[]/);
  let cur = obj;
  for (let i=0; i<parts.length-1; i++) {
    const key = parts[i];
    if (!cur[key]) cur[key] = (parts[i+1] && parts[i+1].match(/^\d+$/)) ? [] : {};
    cur = cur[key];
  }
  const last = parts[parts.length-1];
  cur[last] = val;
}

function hl7DateToFhirDate(s?: string): string | undefined {
  if (!s) return undefined;
  const only = s.replace(/[^0-9]/g, '');
  if (only.length >= 8) return `${only.slice(0,4)}-${only.slice(4,6)}-${only.slice(6,8)}`;
  return undefined;
}
function dateTime(s?: string): string | undefined {
  if (!s) return undefined;
  const only = s.replace(/[^0-9]/g, '');
  if (only.length >= 8) {
    const y = only.slice(0,4), m = only.slice(4,6), d = only.slice(6,8);
    const hh = only.slice(8,10) || '00', mm = only.slice(10,12) || '00', ss = only.slice(12,14) || '00';
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`;
  }
  return undefined;
}
function hl7GenderToFhirGender(s?: string): 'male'|'female'|'unknown'|undefined {
  if (!s) return undefined;
  const up = s.toUpperCase();
  if (up === 'M') return 'male';
  if (up === 'F') return 'female';
  return 'unknown';
}
function valueByType(value: string | undefined, typeCode: string | undefined) {
  if (!value) return {};
  switch ((typeCode || '').toUpperCase()) {
    case 'NM':
      return { valueQuantity: { value: Number(value) } };
    case 'CE':
    case 'CWE':
      return { valueCodeableConcept: { text: value } };
    default:
      return { valueString: value };
  }
}

export function mapToFhir(msg: any) {
  const patient: any = { resourceType: 'Patient' };
  const coverage: any = { resourceType: 'Coverage' };
  const observations: any[] = [];

  logger.debug('Mapping PID/IN1 to FHIR');
  Object.entries(mapping.Patient).forEach(([fhirPath, rule]: any) => {
    let val: any;
    if (rule.const) {
      val = rule.const.replace('${MRN_SYSTEM}', MRN_SYSTEM);
    } else if (rule.hl7) {
      const parsed = msg.get(rule.hl7 as string);
      val = (rule.transform === 'date') ? hl7DateToFhirDate(parsed)
          : (rule.transform === 'gender') ? hl7GenderToFhirGender(parsed)
          : parsed;
    }
    if (val !== undefined && val !== '') setDeep(patient, fhirPath, val);
  });

  Object.entries(mapping.Coverage).forEach(([fhirPath, rule]: any) => {
    let val: any;
    if (rule.const) val = rule.const;
    else if (rule.hl7) val = msg.get(rule.hl7 as string);
    if (val !== undefined && val !== '') setDeep(coverage, fhirPath, val);
  });

  // OBX → Observations
  logger.debug('Mapping OBX to Observations');
  let i = 1;
  while (true) {
    const exists = msg.get(`OBX.${i}.1`) || msg.get(`OBX.${i}`);
    if (!exists) break;
    const typeCode = msg.get(`OBX.${i}.2`) as string | undefined;
    const rawVal = msg.get(`OBX.${i}.5`) as string | undefined;
    const obx: any = { resourceType: 'Observation', status: 'final' };

    const codeText = msg.get(`OBX.${i}.3.1`);
    if (codeText) {
      setDeep(obx, 'code.text', codeText);
      setDeep(obx, 'code.coding[0].code', codeText);
      setDeep(obx, 'code.coding[0].system', 'urn:hl7:obx3');
    }
    Object.assign(obx, valueByType(rawVal, typeCode));
    const unit = msg.get(`OBX.${i}.6.1`);
    if (obx.valueQuantity && unit) {
      setDeep(obx, 'valueQuantity.unit', unit);
      setDeep(obx, 'valueQuantity.code', unit);
      setDeep(obx, 'valueQuantity.system', 'http://unitsofmeasure.org');
    }
    const ts = msg.get(`OBX.${i}.14`);
    const dt = dateTime(ts);
    if (dt) setDeep(obx, 'effectiveDateTime', dt);

    observations.push(obx);
    i++;
  }

  logger.debug('Mapped resources', { patient, coverage, observationCount: observations.length });
  return { patient, coverage, observations };
}

export function buildBundle(patient: any, coverage: any | null, observations: any[], patientRef?: string) {
  const bundle: any = {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: []
  };
  if (patient) bundle.entry.push({ resource: patient });
  if (coverage && (coverage.subscriberId || coverage.payor)) {
    if (patientRef) coverage.beneficiary = { reference: patientRef };
    bundle.entry.push({ resource: coverage });
  }
  for (const o of observations) {
    if (patientRef) o.subject = { reference: patientRef };
    bundle.entry.push({ resource: o });
  }
  return bundle;
}

export function toOperationOutcome(errors: any[]) {
  return {
    resourceType: 'OperationOutcome',
    issue: (errors || []).map(e => ({
      severity: 'error',
      code: 'invalid',
      details: { text: e.message || String(e) }
    }))
  };
}
