import logger from "../utils/logger.js";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const schemaA04 = JSON.parse(readFileSync(path.join(__dirname, "../schemas/ADT_A04.json"), "utf-8"));
const schemaA08 = JSON.parse(readFileSync(path.join(__dirname, "../schemas/ADT_A08.json"), "utf-8"));

import * as AjvModule from "ajv";
const Ajv = (AjvModule as any).default || AjvModule;
const ajv = new Ajv({ allErrors: true, strict: false });

const validateA04 = ajv.compile(schemaA04);
const validateA08 = ajv.compile(schemaA08);

function getField(segments: string[][], segName: string, index: number, subIndex?: number): string | undefined {
  const seg = segments.find(s => s[0] === segName);
  if (!seg) return undefined;
  const field = seg[index];
  if (!field) return undefined;
  if (subIndex !== undefined) {
    return field.split("^")[subIndex];
  }
  return field;
}

function normalizeDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  const clean = dateStr.trim();
  if (/^\d{8}$/.test(clean)) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  }
  return clean;
}

function parseIdentifier(raw?: string, defaultSystem = "local") {
  if (!raw) return undefined;
  const parts = raw.split("^");
  return {
    system: parts[3] || defaultSystem,
    value: parts[0],
  };
}

function buildPatient(segments: string[][]) {
  const pid5 = getField(segments, "PID", 5);
  const [family, given] = pid5 ? pid5.split("^") : ["", ""];

  const genderMap: Record<string, string> = { M: "male", F: "female", U: "unknown", O: "other" };
  const genderCode: string = getField(segments, "PID", 8) ?? "";

  const pid3 = getField(segments, "PID", 3);
  const identifier = parseIdentifier(pid3, "MRN");

  return {
    resourceType: "Patient",
    identifier: identifier ? [identifier] : [],
    name: [{ family, given: [given] }],
    birthDate: normalizeDate(getField(segments, "PID", 7)),
    gender: genderMap[genderCode] || "unknown",
  };
}

function buildCoverage(segments: string[][]) {
  const in1_36 = getField(segments, "IN1", 36);
  const identifier = parseIdentifier(in1_36, "http://example.org/insurance");

  return {
    resourceType: "Coverage",
    status: "active",
    payor: [{ display: getField(segments, "IN1", 4) || "Unknown Payor" }],
    identifier: identifier ? [identifier] : [],
    beneficiary: { reference: "urn:uuid:patient-1" },
  };
}

function buildObservations(segments: string[][]) {
  return segments
    .filter(s => s[0] === "OBX" && s[3])
    .map(s => {
      const obxSetId = s[1];
      const obxCode = s[3]?.split("^")[0];
      const obxDisplay = s[3]?.split("^")[1];
      const obxTimestamp = s[14]; // OBX-14
      const compositeIdParts = [obxCode, obxSetId, obxTimestamp].filter(Boolean);
      const compositeId = compositeIdParts.join("-");

      return {
        resourceType: "Observation",
        status: "final",
        subject: { reference: "urn:uuid:patient-1" },
        identifier: compositeId ? [{ system: "OBX", value: compositeId }] : [],
        code: {
          coding: [{
            system: "http://loinc.org",
            code: obxCode,
            display: obxDisplay,
          }]
        },
        valueString: s[2] === "TX" ? s[5] : undefined,
        valueQuantity: s[2] === "NM" ? { value: parseFloat(s[5]) } : undefined,
        effectiveDateTime: obxTimestamp ? normalizeDate(obxTimestamp) : new Date().toISOString(),
      };
    });
}

function buildBundle(patient: any, coverage: any, observations: any[]) {
  return {
    resourceType: "Bundle",
    type: "transaction",
    entry: [
      {
        fullUrl: "urn:uuid:patient-1",
        resource: patient,
        request: {
          method: "POST",
          url: "Patient",
          ifNoneExist: patient.identifier[0]
            ? `identifier=${patient.identifier[0].system}|${patient.identifier[0].value}`
            : undefined,
        },
      },
      {
        resource: coverage,
        request: {
          method: "POST",
          url: "Coverage",
          ifNoneExist: coverage.identifier[0]
            ? `identifier=${coverage.identifier[0].system}|${coverage.identifier[0].value}`
            : undefined,
        },
      },
      ...observations.map(obs => ({
        resource: obs,
        request: {
          method: "POST",
          url: "Observation",
          ifNoneExist: obs.identifier?.[0]?.value
            ? `identifier=${obs.identifier[0].system}|${obs.identifier[0].value}`
            : undefined,
        },
      })),
    ],
  };
}

export function mapToFhir(segments: string[][]) {
  const patient = buildPatient(segments);
  const coverage = buildCoverage(segments);
  const observations = buildObservations(segments);
  return buildBundle(patient, coverage, observations);
}

function toHl7Object(segments: string[][]) {
  const obj: any = {};
  for (const seg of segments) {
    obj[seg[0]] = seg;
  }
  return obj;
}

export function validateMessage(segments: string[][]) {
  const msh9 = getField(segments, "MSH", 8) || "";
  const type = msh9;
  let valid = false;
  let errors: any = [];

  const hl7Object = toHl7Object(segments);

  if (type === "ADT^A04") {
    valid = validateA04(hl7Object);
    errors = validateA04.errors || [];
  } else if (type === "ADT^A08") {
    valid = validateA08(hl7Object);
    errors = validateA08.errors || [];
  } else {
    valid = false;
    errors = [{ message: "Unknown message type" }];
  }

  if (!valid) {
    logger.error(`HL7 validation failed for message type ${type}`, { errors, segments });
  }

  return { valid, type, errors };
}
