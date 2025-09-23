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

function getField(segments: string[][], segName: string, index: number, subIndex?: number) {
  const seg = segments.find(s => s[0] === segName);
  if (!seg) return undefined;
  const field = seg[index];
  if (!field) return undefined;
  if (subIndex !== undefined) {
    return field.split("^")[subIndex];
  }
  return field;
}

function buildPatient(segments: string[][]) {
  return {
    resourceType: "Patient",
    identifier: [{ system: "MRN", value: getField(segments, "PID", 3) }],
    name: [{ family: getField(segments, "PID", 5), given: [getField(segments, "PID", 5)] }],
    birthDate: getField(segments, "PID", 7),
    gender: getField(segments, "PID", 8) === "M" ? "male" : "female",
  };
}

function buildCoverage(segments: string[][]) {
  return {
    resourceType: "Coverage",
    identifier: [{ system: "INSURANCE", value: getField(segments, "IN1", 3) }],
  };
}

function buildObservations(segments: string[][]) {
  return segments
    .filter(s => s[0] === "OBX")
    .map(s => ({
      resourceType: "Observation",
      code: { text: s[3] },
      valueString: s[5],
      effectiveDateTime: new Date().toISOString(),
    }));
}

function buildBundle(patient: any, coverage: any, observations: any[]) {
  return {
    resourceType: "Bundle",
    type: "transaction",
    entry: [
      {
        resource: patient,
        request: { method: "PUT", url: "Patient?identifier=" + patient.identifier[0].value },
      },
      {
        resource: coverage,
        request: { method: "PUT", url: "Coverage?identifier=" + coverage.identifier[0].value },
      },
      ...observations.map(obs => ({
        resource: obs,
        request: { method: "POST", url: "Observation" },
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

export function validateMessage(segments: string[][]) {
  const msh9 = getField(segments, "MSH", 9) || "";
  const parts = msh9.split("^");
  const type = `${parts[0] || ""}^${parts[1] || ""}`;

  let valid = false;
  let errors: any = [];

  if (type === "ADT^A04") {
    valid = validateA04(segments);
    errors = validateA04.errors || [];
  } else if (type === "ADT^A08") {
    valid = validateA08(segments);
    errors = validateA08.errors || [];
  } else {
    // Instead of failing, just warn
    valid = true;
    errors = [{ message: "Unknown message type, processed without schema" }];
  }

  if (!valid) {
    logger.error("HL7 validation failed", { type, errors });
  }

  return { valid, type, errors };
}
