import axios from 'axios';
import logger from '../utils/logger.js';

const BASE = process.env.MEDPLUM_BASE_URL || 'https://api.medplum.com';
const CLIENT_ID = process.env.MEDPLUM_CLIENT_ID || '';
const CLIENT_SECRET = process.env.MEDPLUM_CLIENT_SECRET || '';
const SCOPES = process.env.MEDPLUM_SCOPES || 'system/*.read system/*.write';

let cached: { token: string; exp: number } | null = null;
async function token() {
  const now = Math.floor(Date.now()/1000);
  if (cached && cached.exp - 30 > now) return cached.token;
  const resp = await axios.post(`${BASE}/oauth2/token`, new URLSearchParams({
    grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, scope: SCOPES
  }), { headers: { 'Content-Type':'application/x-www-form-urlencoded' } });
  cached = { token: resp.data.access_token, exp: now + (resp.data.expires_in || 300) };
  logger.debug('Medplum token refreshed');
  return cached.token;
}

export async function medplumGet(path: string, params?: any) {
  const t = await token();
  return axios.get(`${BASE}${path}`, { params, headers: { Authorization: `Bearer ${t}` } });
}

export async function medplumSearch(resourceType: string, params: any) {
  return medplumGet(`/fhir/R4/${resourceType}`, params);
}

export async function medplumCreate(resourceType: string, body: any) {
  const t = await token();
  logger.info('Medplum create', { resourceType });
  return axios.post(`${BASE}/fhir/R4/${resourceType}`, body, { headers: { Authorization: `Bearer ${t}` } });
}

export async function medplumUpdate(resourceType: string, id: string, body: any) {
  const t = await token();
  logger.info('Medplum update', { resourceType, id });
  return axios.put(`${BASE}/fhir/R4/${resourceType}/${id}`, body, { headers: { Authorization: `Bearer ${t}` } });
}
