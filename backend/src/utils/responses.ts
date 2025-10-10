import { Response } from 'express';

type ErrorDetails = Record<string, unknown> | string | null | undefined;

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const sendSuccess = <T extends Record<string, unknown> | void>(res: Response, payload?: T): Response => {
  return res.json({ success: true, ...(payload ?? {}) });
};

export const sendPaginated = <T>(res: Response, payload: PaginatedResponse<T>): Response => {
  return res.json({ success: true, ...payload });
};

export const sendError = (
  res: Response,
  status: number,
  code: string,
  error: string,
  details?: ErrorDetails
): Response => {
  const response: Record<string, unknown> = {
    success: false,
    code,
    error,
  };

  if (details !== undefined) {
    response.details = details;
  }

  return res.status(status).json(response);
};
