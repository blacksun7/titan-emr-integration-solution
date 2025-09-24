import { Router, Request, Response } from "express";
import { mapToFhir, validateMessage, getField } from "../mapping/mapper.js";
import logger, { auditLogger, errorLogger } from "../utils/logger.js";
import { sendToMedplum } from "../utils/medplumClient.js";

const hl7InboundRouter = Router();

hl7InboundRouter.post("/", async (req: Request, res: Response) => {
  try {
    // Support both JSON { hl7: "..." } and raw text/plain HL7 payloads
    const raw = typeof req.body === "string" ? req.body : req.body?.hl7;
    if (!raw || typeof raw !== "string") {
      errorLogger.error(
        JSON.stringify({
          error: "Missing HL7 message",
        })
      );
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
      errorLogger.error(
        JSON.stringify({
          error: "Validation failed",
          issues: result.errors,
        })
      );
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

    // Send to Medplum if enabled
    if (process.env.UPSERT_TO_MEDPLUM === "true") {
      try {
        const medplumResponse = await sendToMedplum(bundle);

        // Audit log for success
        const msgType = getField(segments, "MSH", 8) || "UNKNOWN";
        const controlId = getField(segments, "MSH", 9) || "UNKNOWN";
        auditLogger.info(
          JSON.stringify({
            controlId,
            type: msgType,
            fhir: bundle,
          })
        );

        return res.status(200).json(medplumResponse);
      } catch (err: any) {
        const msgType = getField(segments, "MSH", 8) || "UNKNOWN";
        const controlId = getField(segments, "MSH", 9) || "UNKNOWN";
        errorLogger.error(
          JSON.stringify({
            error: `Failed to send to Medplum: ${err.message}`,
            controlId,
            type: msgType,
          })
        );
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

    // If not configured to send upstream, just return the bundle
    return res.status(200).json(bundle);
  } catch (err: any) {
    errorLogger.error(
      JSON.stringify({
        error: `Unhandled error: ${err.message}`,
      })
    );
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
