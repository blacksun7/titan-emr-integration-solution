# EMR Server (v4)
- `POST /auth/token` — OAuth2 client credentials (demo)
- `GET /fhir/{resourceType}` — read-only proxy
- `POST /hl7/inbound` — parse ADT^A04/A08 (PID, IN1, OBX), validate, map → FHIR, return Bundle/OperationOutcome.
- Logging: Winston, Morgan
- Tests: Jest (`npm test`)
- Audit: `npm run audit` / `npm run audit:fix`
