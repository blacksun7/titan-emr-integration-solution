import { validateMessage } from "../src/mapping/mapper";

describe("HL7 schema validation", () => {
  it("validates ADT^A04 against schema", () => {
    const segments: string[][] = [
      ["MSH","|^~\\&","SendingApp","SendingFac","ReceivingApp","ReceivingFac","202501011230","","ADT^A04","MSG00001","P","2.5",],
      ["PID", "1", "", "12345^^^Hospital^MR", "", "Doe^John", "", "19800101", "M"],
    ];

    const result = validateMessage(segments);
    expect(result.valid).toBe(true);
    expect(result.type).toBe("ADT^A04");
  });

  it("rejects unsupported message type", () => {
    const segments: string[][] = [
      ["MSH","|^~\\&","SendingApp","SendingFac","ReceivingApp","ReceivingFac","202501011230","","ORM^O01","MSG00001","P","2.5",],
      ["PID", "1", "", "12345^^^Hospital^MR", "", "Doe^John", "", "19800101", "M"],
    ];

    const result = validateMessage(segments);
    expect(result.valid).toBe(false);
    expect(result.type).toBe("ORM^O01");
  });
});
