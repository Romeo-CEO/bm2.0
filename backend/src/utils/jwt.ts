import jwt from 'jsonwebtoken';
import { JWTPayload, SSOJWTPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-here';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};

export const generateSSOToken = (payload: Omit<SSOJWTPayload, 'iat' | 'exp'>, expiresIn: string = '24h'): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
};

export const verifyToken = (token: string): JWTPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
};

export const verifySSOToken = (token: string): SSOJWTPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as SSOJWTPayload;
  } catch (error) {
    return null;
  }
};

export const decodeToken = (token: string): JWTPayload | null => {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch (error) {
    return null;
  }
};

export const decodeSSOToken = (token: string): SSOJWTPayload | null => {
  try {
    return jwt.decode(token) as SSOJWTPayload;
  } catch (error) {
    return null;
  }
};
