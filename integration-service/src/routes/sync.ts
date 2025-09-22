import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();
const router = express.Router();
const EMR_BASE_URL = process.env.EMR_BASE_URL || 'http://localhost:8081';
const CLIENT_ID = process.env.EMR_CLIENT_ID || 'demo';
const CLIENT_SECRET = process.env.EMR_CLIENT_SECRET || 'demo';

async function token() {
  const resp = await axios.post(`${EMR_BASE_URL}/auth/token`, new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET
  }), { headers: { 'Content-Type':'application/x-www-form-urlencoded' } });
  return resp.data.access_token;
}

router.post('/patient', async (req, res) => {
  try {
    const t = await token();
    const body = req.body || {};
    const hasMrn = !!body.mrn;
    const event = hasMrn ? 'ADT^A08' : 'ADT^A04';
    const ts = new Date().toISOString().replace(/[-:T.Z]/g,'').slice(0,14);
    const dob = (body.dob || '').replace(/[^0-9]/g,'');
    const sex = (body.gender || '').toUpperCase().startsWith('M') ? 'M' : (body.gender || '').toUpperCase().startsWith('F') ? 'F' : 'U';
    const MSH = `MSH|^~\&|INTEGRATION|TITAN|EMR|MEDPLUM|${ts}||${event}|MSG${ts}|P|2.5`;
    const PID = `PID|||${body.mrn || ''}^^^MRN||${(body.lastName||'')}^${(body.firstName||'')}||${dob}|${sex}`;
    const INS = body.insurance || {};
    const IN1 = `IN1|1|${INS.name || ''}|||||||${INS.groupNumber || ''}||||||||||${INS.plan || ''}|||||||||||||||||${INS.memberID || ''}`;
    const msg = [MSH, PID, IN1].join('\r');
    logger.info('Posting HL7 to EMR', { event, bytes: msg.length });

    const resp = await axios.post(`${EMR_BASE_URL}/hl7/inbound`, msg, {
      headers: { Authorization: `Bearer ${t}`, 'Content-Type':'text/plain' }
    });
    res.status(200).json(resp.data);
  } catch (e: any) {
    const status = e?.response?.status || 500;
    logger.error('Sync failed', { status, error: e?.message });
    res.status(status).json(e?.response?.data || { error: e.message });
  }
});

export const syncRouter = router;
