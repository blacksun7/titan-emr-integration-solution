# Titan Intake – EMR Integrations (v4, from scratch)

This version is built fresh with all enhancements discussed:

- **Data-driven HL7→FHIR mapping** (PID, IN1, OBX → Patient, Coverage, Observation) via `mapping.json`
- **Schema validation** for **ADT^A04 / ADT^A08** (AJV, JSON Schema)
- **Real HL7 parsing** using `simple-hl7`
- **FHIR-native responses**: `Bundle` on success; `OperationOutcome` on errors
- **Structured logging** with Winston (+ morgan for HTTP)
- **Unit tests** with Jest + ts-jest (parsing, validation, mapping)
- **Security audit scripts**: `npm run audit` and `npm run audit:fix`
- **Dockerfiles + docker-compose** and **requests.http** for quick manual testing

## Quickstart
```bash
# EMR server
cd emr-server
cp .env.example .env
npm install
LOG_LEVEL=debug npm run dev

# Integration service
cd ../integration-service
cp .env.example .env
npm install
LOG_LEVEL=debug npm run dev
```

## Tests & Audit
```bash
# In each service dir
npm test
npm run audit
npm run audit:fix
```

## Docker (optional)
```bash
cp emr-server/.env.example emr-server/.env
cp integration-service/.env.example integration-service/.env
docker compose up --build
```
