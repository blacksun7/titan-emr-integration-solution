import { Router, Request, Response } from "express";
import { mapToFhir, validateMessage } from "../mapping/mapper.js";
import logger from "../utils/logger.js";
import { sendToMedplum } from "../utils/medplumClient.js";

const hl7InboundRouter = Router();

hl7InboundRouter.post("/", async (req: Request, res: Response) => {
  try {
    // Support both JSON { hl7: "..." } and raw text/plain HL7 payloads
    const raw = typeof req.body === "string" ? req.body : req.body?.hl7;
    if (!raw || typeof raw !== "string") {
      return res.status(400).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "invalid",
            details: { text: "Missing HL7 message" },
          },
        ],
      });
    }

    // Parse HL7 into segments
    const segments: string[][] = raw
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line: string) => line.split("|"));

    // Validate HL7
    const result = validateMessage(segments);
    if (!result.valid) {
      logger.error("Invalid HL7 message", result);
      return res.status(400).json({
        resourceType: "OperationOutcome",
        issue: result.errors.map((e: any) => ({
          severity: "error",
          code: "invalid",
          details: { text: e.message || "Validation error" },
        })),
      });
    }

    // Map to FHIR
    const bundle = mapToFhir(segments);
    logger.info("HL7 message mapped to FHIR", { bundle });

    // Send to Medplum
    if (process.env.UPSERT_TO_MEDPLUM === "true") {
      try {
        const medplumResponse = await sendToMedplum(bundle);
        logger.info("Medplum response", medplumResponse);
        return res.status(200).json(medplumResponse);
      } catch (err: any) {
        logger.error("Failed to send to Medplum", { error: err.message });
        return res.status(502).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "exception",
              details: { text: err.message },
            },
          ],
        });
      }
    }
  } catch (err: any) {
    logger.error("Unhandled error", { error: err.message, stack: err.stack });
    return res.status(500).json({
      resourceType: "OperationOutcome",
      issue: [
        {
          severity: "error",
          code: "exception",
          details: { text: err.message },
        },
      ],
    });
  }
});

export default hl7InboundRouter;
