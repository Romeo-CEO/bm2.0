import dotenv from 'dotenv';

dotenv.config();

export interface OnlyOfficeConfig {
  docServerUrl: string;
  jwtSecret: string;
  publicBaseUrl: string;
}

export const getOnlyOfficeConfig = (): OnlyOfficeConfig => {
  const docServerUrl = process.env.ONLYOFFICE_DOCSERVER_URL || '';
  const jwtSecret = process.env.ONLYOFFICE_JWT_SECRET || '';
  const publicBaseUrl = process.env.APP_PUBLIC_BASE_URL || '';

  if (!docServerUrl || !jwtSecret || !publicBaseUrl) {
    throw new Error('Missing OnlyOffice configuration. Set ONLYOFFICE_DOCSERVER_URL, ONLYOFFICE_JWT_SECRET, APP_PUBLIC_BASE_URL');
  }

  return { docServerUrl, jwtSecret, publicBaseUrl };
};


