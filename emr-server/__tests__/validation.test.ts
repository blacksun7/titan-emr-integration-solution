import { validateMessage } from '../src/mapping/mapper';

function parseHL7(raw: string): string[][] {
  return raw
    .trim()
    .split(/\r?\n/)
    .map(line => line.split('|'));
}

describe('HL7 schema validation', () => {
  it('validates ADT^A04 against schema', () => {
    const raw = `
MSH|^~\\&|SendingApp|SendingFac|ReceivingApp|ReceivingFac|202509221200||ADT^A04|123456|P|2.5
PID|1||12345^^^Hospital^MR||Doe^John||19800101|M
IN1|1|A357|123456789|Best Insurance
OBX|1|ST|1234-5^Test^LN||Positive||||||F
    `.trim();

    const segments = parseHL7(raw);
    const result = validateMessage(segments);

    expect(result.valid).toBe(true);
    expect(result.type).toBe('ADT^A04');
  });

  it('rejects unsupported message type', () => {
    const raw = `
MSH|^~\\&|SendingApp|SendingFac|ReceivingApp|ReceivingFac|202509221200||ORM^O01|123456|P|2.5
PID|1||12345^^^Hospital^MR||Doe^John||19800101|M
    `.trim();

    const segments = parseHL7(raw);
    const result = validateMessage(segments);

    expect(result.valid).toBe(false);
    expect(result.type).toBe('ORM^O01');
  });
});
