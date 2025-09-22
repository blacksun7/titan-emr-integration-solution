import express from 'express';
import jwt from 'jsonwebtoken';
import { expressjwt } from 'express-jwt';
import bodyParser from 'body-parser';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-supersecret';
const JWT_ISSUER = process.env.JWT_ISSUER || 'emr-server';
const JWT_AUD = process.env.JWT_AUDIENCE || 'emr-clients';

export const tokenRouter = express.Router();
tokenRouter.use(bodyParser.urlencoded({ extended: false }));

tokenRouter.post('/token', (req, res) => {
  const { grant_type, client_id, client_secret } = req.body || {};
  if (grant_type !== 'client_credentials') {
    logger.warn('Unsupported grant_type', { grant_type });
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }
  if (!client_id || !client_secret) {
    logger.warn('Invalid client credentials');
    return res.status(401).json({ error: 'invalid_client' });
  }
  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    { iss: JWT_ISSUER, aud: JWT_AUD, sub: client_id, iat: now, exp: now + 3600, scope: 'emr.read emr.write' },
    JWT_SECRET,
    { algorithm: 'HS256' }
  );
  logger.info('Issued token for client', { client_id });
  res.json({ access_token: token, token_type: 'Bearer', expires_in: 3600 });
});

export const requireAuth = expressjwt({
  secret: JWT_SECRET,
  algorithms: ['HS256'],
  audience: JWT_AUD,
  issuer: JWT_ISSUER
});
