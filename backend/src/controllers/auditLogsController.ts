import { Request, Response } from 'express';
import { getConnection } from '../config/database';
import { logAuditEvent } from '../services/auditService';

const parseDate = (value: unknown): Date | null => {
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildRelatedLinks = (metadata: Record<string, unknown> | null): Record<string, string> => {
  if (!metadata) return {};
  const links: Record<string, string> = {};
  if (metadata.templateId) {
    links.template = `/admin/templates/${metadata.templateId}`;
  }
  if (metadata.companyId) {
    links.company = `/admin/companies/${metadata.companyId}`;
  }
  if (metadata.userId) {
    links.user = `/admin/users/${metadata.userId}`;
  }
  if (metadata.applicationId) {
    links.application = `/admin/applications/${metadata.applicationId}`;
  }
  return links;
};

export class AuditLogsController {
  async list(req: Request, res: Response): Promise<void> {
    const { page = 1, pageSize = 50, eventType, actor, outcome, start, end, includeEmail = 'false' } = req.query as Record<string, string>;

    const parsedPage = Math.max(1, Number(page) || 1);
    const parsedPageSize = Math.min(200, Math.max(1, Number(pageSize) || 50));

    const startDate = parseDate(start);
    const endDate = parseDate(end);

    const includeEmailFlag = String(includeEmail).toLowerCase() === 'true';

    const connection = await getConnection();

    try {
      const where: string[] = ['1=1'];
      const params: any[] = [];

      if (eventType) {
        where.push('event_type = ?');
        params.push(eventType);
      }

      if (actor) {
        where.push('(user_id = ? OR LOWER(email) = LOWER(?))');
        params.push(actor, actor);
      }

      if (outcome) {
        if (['success', 'true', '1'].includes(outcome.toLowerCase())) {
          where.push('success = 1');
        } else if (['failure', 'false', '0'].includes(outcome.toLowerCase())) {
          where.push('success = 0');
        }
      }

      if (startDate) {
        where.push('created_at >= ?');
        params.push(startDate.toISOString());
      }

      if (endDate) {
        where.push('created_at <= ?');
        params.push(endDate.toISOString());
      }

      const whereClause = where.join(' AND ');

      const countResult = await connection.query(
        `SELECT COUNT(*) as total FROM audit_logs WHERE ${whereClause}`,
        params
      );
      const total = Number(countResult.rows?.[0]?.total ?? countResult.rows?.[0]?.TOTAL ?? 0);

      const offset = (parsedPage - 1) * parsedPageSize;

      const result = await connection.query(
        `SELECT id, user_id, event_type, success, ip_address, user_agent, metadata, created_at, email
         FROM audit_logs
         WHERE ${whereClause}
         ORDER BY created_at DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`,
        [...params, offset, parsedPageSize]
      );

      const items = (result.rows || []).map((row: any) => {
        let metadata: Record<string, unknown> | null = null;
        if (row.metadata) {
          try {
            metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
          } catch {
            metadata = null;
          }
        }

        return {
          id: row.id,
          userId: row.user_id ?? row.USER_ID ?? null,
          eventType: row.event_type ?? row.EVENT_TYPE,
          success: Boolean(row.success ?? row.SUCCESS ?? false),
          ipAddress: row.ip_address ?? row.IP_ADDRESS ?? null,
          userAgent: row.user_agent ?? row.USER_AGENT ?? null,
          metadata,
          links: buildRelatedLinks(metadata),
          email: includeEmailFlag ? row.email ?? row.EMAIL ?? null : null,
          createdAt: row.created_at ?? row.CREATED_AT,
        };
      });

      res.json({
        success: true,
        page: parsedPage,
        pageSize: parsedPageSize,
        total,
        totalPages: Math.ceil(total / parsedPageSize),
        items,
      });

      await logAuditEvent({
        eventType: 'ADMIN_AUDIT_LOG_VIEWED',
        success: true,
        userId: req.user?.id,
        metadata: {
          filters: {
            eventType: eventType ?? null,
            actor: actor ?? null,
            outcome: outcome ?? null,
            start: startDate?.toISOString() ?? null,
            end: endDate?.toISOString() ?? null,
          },
          totalReturned: items.length,
        },
      });
    } catch (error) {
      console.error('Failed to query audit logs', error);
      res.status(500).json({ success: false, error: 'Failed to query audit logs' });
    } finally {
      connection.release?.();
    }
  }
}

export const auditLogsController = new AuditLogsController();
