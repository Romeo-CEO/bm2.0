import bcrypt from 'bcryptjs';

const DEFAULT_BCRYPT_ROUNDS = 12;
const configuredRounds = parseInt(process.env.BCRYPT_ROUNDS || `${DEFAULT_BCRYPT_ROUNDS}`, 10);
const BCRYPT_ROUNDS = Number.isFinite(configuredRounds) && configuredRounds > 0 ? configuredRounds : DEFAULT_BCRYPT_ROUNDS;

export const passwordMeetsPolicy = (password: string): boolean => {
  if (typeof password !== 'string') return false;
  if (password.length < 8) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
};

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
};
