# Integration Service

Receives FHIR resources from EMR Server → upserts into Medplum.

---

## 🚀 Responsibilities

- Authenticate with Medplum using client credentials  
- Receive mapped FHIR Bundle or resources  
- Upsert those resources into Medplum  
- Handle retries and error responses  
- Logging and error handling

---

## ⚙ Configuration

- Copy `.env.example` → `.env`  
- Set:
  - `MEDPLUM_BASE_URL`
  - `MEDPLUM_CLIENT_ID`
  - `MEDPLUM_CLIENT_SECRET`
  - `LOG_LEVEL`
  - Any other service-specific settings

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

- Unit tests around Medplum auth + upsert logic  
- Mocking FHIR resource submission  

---

## 🔍 How it fits in

EMR Server → sends FHIR Bundle → Integration Service → Medplum
