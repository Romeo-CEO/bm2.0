import { getConnection, type DatabaseConnection } from '../config/database';

export type AuditEventType =
  | 'AUTH_LOGIN'
  | 'AUTH_LOGIN_LOCKOUT'
  | 'AUTH_LOGOUT'
  | 'AUTH_REGISTER'
  | 'AUTH_PASSWORD_FORGOT'
  | 'AUTH_PASSWORD_RESET'
  | 'SECURITY_SCOPE_DENIED'
  | 'AUTHZ_DENIED'
  | 'PAYMENT_ITN_RECEIVED'
  | 'PAYMENT_ITN_REJECTED'
  | 'PAYMENT_STATUS_UPDATE'
  | 'PAYMENT_STATUS_UPDATE_SKIPPED'
  | 'COMPANY_USER_INVITE_SENT'
  | 'COMPANY_INVITE_ACCEPTED'
  | 'COMPANY_INVITE_ACCEPT_FAILED'
  | 'COMPANY_INVITE_RESENT'
  | 'COMPANY_INVITE_CANCELLED'
  | 'COMPANY_USER_REMOVED'
  | 'USER_TEMP_PASSWORD_CREATED'
  | 'SSO_APPLICATION_UPDATED'
  | 'APPLICATION_DEPLOYED'
  | 'TEMPLATE_DOWNLOADED';

export interface AuditLogOptions {
  eventType: AuditEventType;
  success: boolean;
  userId?: string | null;
  email?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

export const logAuditEvent = async (options: AuditLogOptions): Promise<void> => {
  const { eventType, success, userId, email, ipAddress, userAgent, metadata } = options;
  let db: DatabaseConnection | null = null;

  try {
    db = await getConnection();
    const metaString = metadata ? JSON.stringify(metadata) : null;
    await db.query(
      `INSERT INTO audit_logs (user_id, email, event_type, success, ip_address, user_agent, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)` ,
      [userId || null, email || null, eventType, success ? 1 : 0, ipAddress || null, userAgent || null, metaString]
    );
  } catch (error) {
    console.error('Failed to write audit log', error);
  } finally {
    db?.release?.();
  }
};
