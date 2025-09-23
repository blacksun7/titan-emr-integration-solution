# EMR Server

Part of the Titan EMR Integration pipeline. Handles inbound HL7, validation, mapping to FHIR.

---

## 🚀 Responsibilities

- HTTP endpoint to accept HL7 v2 messages  
- Parsing HL7 messages (ADT^A04, ADT^A08, OBX segments)  
- Validating HL7 message structure against JSON schemas  
- Mapping PID, IN1, OBX → FHIR `Patient`, `Coverage`, `Observation`  
- Producing structured HTTP response: FHIR `Bundle` on success, `OperationOutcome` on error  
- Logging + debug mode support

---

## ⚙ Configuration

- Copy `.env.example` → `.env`  
- Set variables:
  - `PORT`
  - `MEDPLUM_BASE_URL`
  - `MEDPLUM_CLIENT_ID`
  - `MEDPLUM_CLIENT_SECRET`
  - `MEDPLUM_SCOPES`
  - `LOG_LEVEL` (e.g. `debug`, `info`)

---

## 🛠 Scripts

npm install
npm run build
npm start
npm run dev
npm run debug
npm test

---

## 🧪 Testing

- Uses Jest + ts-jest  
- Tests cover mapping and schema validation  

---

## 🔄 Extensibility

To support new HL7 message types:

1. Add schema `.json` under `schemas/`  
2. Add mapping rules in `mapping.json`  
3. Update message type detection logic if needed  
4. Add unit tests for new mapping + validation
