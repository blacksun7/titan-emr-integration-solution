import { MedplumClient } from '@medplum/core';

export const medplum = new MedplumClient({
  baseUrl: process.env.MEDPLUM_BASE_URL,
  clientId: process.env.MEDPLUM_CLIENT_ID as string,
  clientSecret: process.env.MEDPLUM_CLIENT_SECRET as string,
  fetch: fetch, // node 18+ has fetch built-in
});
