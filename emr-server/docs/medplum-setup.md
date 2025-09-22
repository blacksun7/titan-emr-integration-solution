# Medplum Setup Guide

This project supports **upserting Patients, Coverages, and Observations into Medplum**.  
To enable this, you need to create a **Project Client** on Medplum and configure the credentials.

---

## 1. Log in

- Go to [https://app.medplum.com](https://app.medplum.com) and sign in.

---

## 2. Choose or create a Project

- In the sidebar, pick the project where this integration should run.
- If you don’t have one, click **+ New Project**.

---

## 3. Create a Client

- Navigate to **Project Admin → Clients**.
- Click **+ Add Client**.
- Fill out:
  - **Name**: `titan-emr-integration`
  - **Auth Method**: `client_secret_basic`
  - **Grants**: Enable **Client Credentials**
  - **Scopes**:
    system/*.read system/*.write
  - Leave Redirect URIs empty (not needed for client_credentials).

- Save.

---

## 4. Copy Credentials

- After saving, you’ll see:
  - **Client ID**
  - **Client Secret** (shown once — copy immediately!)

- Store them in your `.env` file:

  ```env
  MEDPLUM_BASE_URL=https://api.medplum.com
  MEDPLUM_CLIENT_ID=your-client-id
  MEDPLUM_CLIENT_SECRET=your-client-secret
  MEDPLUM_SCOPES=system/*.read system/*.write
  UPSERT_TO_MEDPLUM=true
