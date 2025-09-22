import { mapToFhir } from '../src/mapping/mapper';

function parseHL7(raw: string): string[][] {
  return raw
    .trim()
    .split(/\r?\n/)
    .map(line => line.split('|'));
}

describe('mapToFhir', () => {
  it('maps ADT^A04 sample with OBX into structured FHIR', () => {
    const raw = `
MSH|^~\\&|SendingApp|SendingFac|ReceivingApp|ReceivingFac|202509221200||ADT^A04|123456|P|2.5
PID|1||12345^^^Hospital^MR||Doe^John||19800101|M
IN1|1|A357|123456789|Best Insurance
OBX|1|ST|1234-5^Test^LN||Positive||||||F
    `.trim();

    const segments = parseHL7(raw);
    const { patient, coverage, observations } = mapToFhir(segments);

    expect(patient.identifier[0].value).toBe('12345^^^Hospital^MR');
    expect(patient.name[0].family).toBe('Doe');
    expect(patient.gender).toBe('male');
    expect(patient.birthDate).toBe('1980-01-01');

    expect(coverage.identifier[0].value).toBe('A357');

    expect(observations.length).toBeGreaterThan(0);
    expect(observations[0].valueString).toBe('Positive');
  });
});
