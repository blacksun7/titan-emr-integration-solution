import fs from 'fs';
import { parseMessage, mapToFhir } from '../src/mapping/mapper';

test('maps ADT^A04 sample with OBX into FHIR', () => {
  const text = fs.readFileSync('sample-a04.hl7','utf8');
  const msg = parseMessage(text);
  const { patient, coverage, observations } = mapToFhir(msg);
  expect(patient.resourceType).toBe('Patient');
  expect(patient.identifier[0].value).toBe('12345');
  expect(coverage.resourceType).toBe('Coverage');
  expect(observations.length).toBeGreaterThan(0);
});
