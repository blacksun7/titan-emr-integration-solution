# Titan Intake – EMR Integrations Solution

This project implements a full **HL7 v2 → FHIR R4** pipeline with Medplum integration.  
It handles HL7 parsing, validation, mapping, and upserting to Medplum, plus full test coverage, logging, and dev/debug workflows.

---

## 🔍 Features

- Data-driven HL7 → FHIR mapping (PID, IN1, OBX → Patient, Coverage, Observation) via `mapping.json`  
- Schema validation for **ADT^A04** (patient registration) and **ADT^A08** (patient update) using JSON Schema / AJV  
- Real HL7 parsing with `simple-hl7`  
- Structured responses:
  - **FHIR Bundle** on success  
  - **FHIR OperationOutcome** for errors  
- Structured JSON logging with Winston  
- Unit tests with Jest + ts-jest (validation + mapping)  
- Dev, build, test, debug scripts preconfigured  
- Medplum upsert integration (client credentials flow)  
- Docker + Docker Compose support (optional)  
- Security audit scripts: `npm run audit`, `npm run audit:fix`

---

## ⚡ Quickstart

```bash
# Clone the repo
git clone https://github.com/blacksun7/titan-emr-integration-solution.git
cd titan-emr-integration-solution

# EMR Server setup
cd emr-server
cp .env.example .env
npm install
LOG_LEVEL=debug npm run dev

# Integration Service setup
cd ../integration-service
cp .env.example .env
npm install
LOG_LEVEL=debug npm run dev
```

---

## ✅ Scripts & Workflows

| Service | Command | Description |
|---|---|---|
| All services | `npm run build` | Compile TypeScript to `dist` |
| EMR / Integration | `npm start` | Run production / built version |
| EMR / Integration | `npm run dev` | Run with auto-reload (nodemon or ts-node) |
| EMR / Integration | `npm run debug` | Run with debugger attached |
| EMR / Integration | `npm test` | Run tests (Jest + ts-jest) |
| All services | `npm run audit` / `npm run audit:fix` | Security/vulnerability audit |

---

## 📂 Supported HL7 Messages

- **ADT^A04** – Patient Registration  
- **ADT^A08** – Patient Update  
- **OBX** segments → FHIR `Observation`

FHIR resources produced:

- `Patient`  
- `Coverage`  
- `Observation[]`

Unsupported message types will return a FHIR `OperationOutcome`.

---

## 🛠 Extending the Mapping

1. If you need a new HL7 message type (e.g. `ORU^R01`), add schema under `schemas/`  
2. Add transformation rules in `mapping.json` for that message type  
3. Update `mapper.ts` to recognize new message type during validation + mapping  
4. Add unit tests covering new mapping + schema validation

---

## 🔧 Medplum Integration

- Configure Medplum credentials in your `.env` (`CLIENT_ID`, `CLIENT_SECRET`, etc.)  
- The mapped FHIR bundles are upserted into Medplum  
- Follow Medplum OAuth2 client credential flow

---

## 📁 Repository Structure

titan-emr-integration-solution/
├── emr-server/
│   ├── src/
│   │   ├── routes/
│   │   ├── mapping/
│   │   ├── schemas/
│   │   └── utils/
│   ├── __tests__/
│   └── .env.example, package.json, tsconfig.json, etc.
├── integration-service/
│   ├── src/
│   ├── __tests__/
│   └── .env.example, package.json, etc.
├── docker-compose.yml
├── .gitignore
└── README.md  (this file)

---

## 📌 Why this Challenge Is Met

- All required message types (ADT^A04, ADT^A08) + OBX mapping implemented  
- Data-driven mapping allows adding new types with minimal code changes  
- Tests cover validation + mapping  
- Logging & error-handling consistent  
- Dev / debug workflows in place  

---

## ⚠️ Notes & Known Issues

- Some HL7 fields are handled in a basic way (e.g. date parsing, gender) — more nuance may be needed in production  
- Mapping for nested or complex types is not yet implemented  
- Medplum scopes / policies assume system.* read/write — may require tuning for production environments

---

## 📄 License

MIT  
