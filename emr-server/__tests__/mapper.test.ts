import { mapToFhir } from "../src/mapping/mapper";

describe("mapToFhir", () => {
  it("maps ADT^A04 sample with OBX into structured FHIR", () => {
    const msh = ["MSH", "|^~\\&", "SendingApp", "SendingFac", "ReceivingApp", "ReceivingFac", "202501011230", "", "", "ADT^A04"];
    const pid = ["PID", "1", "", "12345^^^Hospital^MR", "", "Doe^John", "", "19800101", "M"];

    const in1 = new Array(37).fill("");
    in1[0] = "IN1";
    in1[3] = "Best Insurance"; // IN1-4 Payor
    in1[36] = "INS123^^^Insurance"; // IN1-36 Policy number

    const obx = ["OBX", "1", "NM", "HR^Heart Rate", "", "72", "bpm"];

    const segments = [msh, pid, in1, obx];

    const bundle = mapToFhir(segments);
    const patient = bundle.entry[0].resource;
    const coverage = bundle.entry[1].resource;
    const observations = bundle.entry.slice(2).map(e => e.resource);

    expect(patient.identifier[0].system).toBe("Hospital");
    expect(patient.identifier[0].value).toBe("12345");
    expect(patient.name[0].family).toBe("Doe");
    expect(patient.gender).toBe("male");
    expect(patient.birthDate).toBe("1980-01-01");

    expect(coverage.identifier[0].system).toBe("Insurance");
    expect(coverage.identifier[0].value).toBe("INS123");

    expect(observations[0].code.coding[0].code).toBe("HR");
    expect(observations[0].valueQuantity.value).toBe(72);
  });
});