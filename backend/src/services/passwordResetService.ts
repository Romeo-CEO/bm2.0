import crypto from 'crypto';
import { getConnection } from '../config/database';

const RESET_TOKEN_LIFETIME_MINUTES = parseInt(process.env.PASSWORD_RESET_TOKEN_MINUTES || '60', 10);

const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const createPasswordResetToken = async (userId: string): Promise<{ token: string; expiresAt: Date }> => {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_LIFETIME_MINUTES * 60 * 1000);

  const db = await getConnection();

  try {
    // Invalidate existing unused tokens for the user
    await db.query(
      'UPDATE password_resets SET used_at = GETDATE() WHERE user_id = ? AND used_at IS NULL',
      [userId]
    );

    await db.query(
      'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [userId, tokenHash, expiresAt]
    );
  } finally {
    db.release?.();
  }

  return { token, expiresAt };
};

export const verifyPasswordResetToken = async (token: string): Promise<{ id: string; userId: string } | null> => {
  const tokenHash = hashToken(token);
  const db = await getConnection();

  try {
    const result = await db.query(
      `SELECT id, user_id
       FROM password_resets
       WHERE token_hash = ? AND used_at IS NULL AND expires_at > GETDATE()` ,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return { id: result.rows[0].id, userId: result.rows[0].user_id };
  } finally {
    db.release?.();
  }
};

export const markPasswordResetTokenUsed = async (resetId: string): Promise<void> => {
  const db = await getConnection();
  try {
    await db.query(
      'UPDATE password_resets SET used_at = GETDATE() WHERE id = ?',
      [resetId]
    );
  } finally {
    db.release?.();
  }
};
