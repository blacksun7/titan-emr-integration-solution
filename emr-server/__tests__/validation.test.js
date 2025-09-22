import fs from 'fs';
import { parseMessage, validateMessage } from '../src/mapping/mapper';
test('validates ADT^A04 against schema', () => {
    const text = fs.readFileSync('sample-a04.hl7', 'utf8');
    const msg = parseMessage(text);
    const { valid, type } = validateMessage(msg);
    expect(type).toBe('ADT^A04');
    expect(valid).toBe(true);
});
