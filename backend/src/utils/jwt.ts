import jwt, { SignOptions } from 'jsonwebtoken';
import { JWTPayload, SSOJWTPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-here';
const DEFAULT_JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const resolveExpiresIn = (value?: string): string => {
  if (!value) return DEFAULT_JWT_EXPIRES_IN;
  return value;
};

const DEFAULT_EXPIRY_MS = 60 * 60 * 1000;

const parseDurationToMs = (input: string): number => {
  const trimmed = input.trim().toLowerCase();
  const unitMatch = trimmed.match(/^([0-9]+)\s*(ms|s|m|h|d)$/);
  if (unitMatch) {
    const value = parseInt(unitMatch[1], 10);
    const unit = unitMatch[2];
    switch (unit) {
      case 'ms':
        return value;
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return DEFAULT_EXPIRY_MS;
    }
  }

  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric) && numeric > 0) {
    // Treat large values as milliseconds, otherwise assume seconds
    return numeric >= 100000 ? Math.floor(numeric) : Math.floor(numeric * 1000);
  }

  return DEFAULT_EXPIRY_MS;
};

export const getJwtExpiryDurationMs = (value?: string): number => {
  const resolved = resolveExpiresIn(value);
  return parseDurationToMs(resolved);
};

export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>, expiresIn?: string): string => {
  const resolved = resolveExpiresIn(expiresIn);
  return jwt.sign(payload, JWT_SECRET, { expiresIn: resolved } as SignOptions);
};

export const generateSSOToken = (payload: Omit<SSOJWTPayload, 'iat' | 'exp'>, expiresIn: string = DEFAULT_JWT_EXPIRES_IN): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as SignOptions);
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
