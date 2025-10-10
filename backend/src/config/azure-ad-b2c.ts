import { ConfidentialClientApplication, Configuration } from '@azure/msal-node';
import dotenv from 'dotenv';

dotenv.config();

// Azure AD B2C Configuration
export interface AzureADB2CConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  authority: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scopes: string[];
}

// Get Azure AD B2C configuration from environment
export const getAzureADB2CConfig = (): AzureADB2CConfig => {
  const tenantShort = process.env.AZURE_AD_B2C_TENANT_ID || '';
  const tenantGuid = process.env.AZURE_AD_B2C_TENANT_GUID || process.env.AZURE_AD_B2C_TENANT_OBJECT_ID || '';
  const clientId = process.env.AZURE_AD_B2C_CLIENT_ID || '';
  const clientSecret = process.env.AZURE_AD_B2C_CLIENT_SECRET || '';
  const policyName = process.env.AZURE_AD_B2C_POLICY_NAME || 'B2C_1_signupsignin';

  // Determine domain and authority: CIAM (ciamlogin.com) when tenant GUID is provided; else classic B2C (b2clogin.com + policy)
  const domainHost = tenantGuid ? `${tenantShort}.ciamlogin.com` : `${tenantShort}.b2clogin.com`;
  const authority = tenantGuid
    ? `https://${domainHost}/${tenantGuid}`
    : `https://${tenantShort}.b2clogin.com/${tenantShort}.onmicrosoft.com/${policyName}`;

  return {
    clientId,
    clientSecret,
    tenantId: tenantGuid || tenantShort,
    authority,
    redirectUri: process.env.AZURE_AD_B2C_REDIRECT_URI || 'http://localhost:3001/api/auth/callback',
    postLogoutRedirectUri: process.env.AZURE_AD_B2C_POST_LOGOUT_REDIRECT_URI || 'http://localhost:5173',
    scopes: process.env.AZURE_AD_B2C_SCOPES?.split(',') || ['openid', 'profile', 'email', 'offline_access']
  };
};

// MSAL Configuration
export const getMSALConfig = (): Configuration => {
  const config = getAzureADB2CConfig();
  
  // Determine known authorities and optional authority metadata for CIAM
  const knownHost = config.authority.includes('.ciamlogin.com')
    ? config.authority.split('/')[2]
    : `${(process.env.AZURE_AD_B2C_TENANT_ID || '').trim()}.b2clogin.com`;
  const authorityMetadata = process.env.AZURE_AD_B2C_AUTHORITY_METADATA; // optional JSON string

  return {
    auth: {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      authority: config.authority,
      knownAuthorities: [knownHost],
      ...(authorityMetadata ? { authorityMetadata } : {}),
    },
    system: {
      loggerOptions: {
        loggerCallback: (level, message, containsPii) => {
          if (containsPii) return;
          console.log(`[MSAL] ${level}: ${message}`);
        },
        piiLoggingEnabled: false,
        logLevel: process.env.NODE_ENV === 'production' ? 'Error' as any : 'Info' as any,
      },
    },
  };
};

// Create MSAL instance
let msalInstance: ConfidentialClientApplication | null = null;

export const getMSALInstance = (): ConfidentialClientApplication => {
  if (!msalInstance) {
    const config = getMSALConfig();
    
    // Only create MSAL instance if Azure AD B2C is properly configured
    if (!config.auth.clientId || !config.auth.clientSecret) {
      throw new Error('Azure AD B2C is not properly configured. Please set AUTH_TYPE=custom or configure Azure AD B2C credentials.');
    }
    
    msalInstance = new ConfidentialClientApplication(config);
  }
  return msalInstance;
};

// Authentication type enum
export enum AuthType {
  CUSTOM = 'custom',
  AZURE_AD_B2C = 'azure_ad_b2c'
}

// Get authentication type from environment
export const AUTH_TYPE = (process.env.AUTH_TYPE || 'custom') as AuthType;

// Test Azure AD B2C configuration
export const testAzureADB2CConfig = (): boolean => {
  const config = getAzureADB2CConfig();
  
  const requiredFields = ['clientId', 'clientSecret', 'tenantId'];
  const missingFields = requiredFields.filter(field => !config[field as keyof AzureADB2CConfig]);
  
  if (missingFields.length > 0) {
    console.error('❌ Azure AD B2C configuration missing:', missingFields);
    return false;
  }
  
  console.log('✅ Azure AD B2C configuration valid');
  return true;
};
