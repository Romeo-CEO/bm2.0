-- SQL Server Migration: Add company branding/contact fields and deployment metadata
BEGIN TRANSACTION;

IF COL_LENGTH('dbo.companies', 'description') IS NULL
  ALTER TABLE dbo.companies ADD description NVARCHAR(MAX) NULL;

IF COL_LENGTH('dbo.companies', 'industry') IS NULL
  ALTER TABLE dbo.companies ADD industry NVARCHAR(100) NULL;

IF COL_LENGTH('dbo.companies', 'size') IS NULL
  ALTER TABLE dbo.companies ADD size NVARCHAR(50) NULL;

IF COL_LENGTH('dbo.companies', 'website') IS NULL
  ALTER TABLE dbo.companies ADD website NVARCHAR(255) NULL;

IF COL_LENGTH('dbo.companies', 'address') IS NULL
  ALTER TABLE dbo.companies ADD address NVARCHAR(MAX) NULL;

IF COL_LENGTH('dbo.companies', 'phone') IS NULL
  ALTER TABLE dbo.companies ADD phone NVARCHAR(50) NULL;

IF COL_LENGTH('dbo.companies', 'email') IS NULL
  ALTER TABLE dbo.companies ADD email NVARCHAR(255) NULL;

IF COL_LENGTH('dbo.companies', 'logo_url') IS NULL
  ALTER TABLE dbo.companies ADD logo_url NVARCHAR(MAX) NULL;

IF COL_LENGTH('dbo.companies', 'tagline') IS NULL
  ALTER TABLE dbo.companies ADD tagline NVARCHAR(255) NULL;

IF COL_LENGTH('dbo.companies', 'primary_color') IS NULL
BEGIN
  ALTER TABLE dbo.companies ADD primary_color NVARCHAR(20) NULL;
END;

IF COL_LENGTH('dbo.companies', 'primary_color') IS NOT NULL
BEGIN
  IF OBJECT_ID('DF_companies_primary_color', 'D') IS NULL
    EXEC('ALTER TABLE dbo.companies ADD CONSTRAINT DF_companies_primary_color DEFAULT ''#3B82F6'' FOR primary_color');

  EXEC('UPDATE dbo.companies SET primary_color = ''#3B82F6'' WHERE primary_color IS NULL');
END;

IF COL_LENGTH('dbo.companies', 'secondary_color') IS NULL
BEGIN
  ALTER TABLE dbo.companies ADD secondary_color NVARCHAR(20) NULL;
END;

IF COL_LENGTH('dbo.companies', 'secondary_color') IS NOT NULL
BEGIN
  IF OBJECT_ID('DF_companies_secondary_color', 'D') IS NULL
    EXEC('ALTER TABLE dbo.companies ADD CONSTRAINT DF_companies_secondary_color DEFAULT ''#1E40AF'' FOR secondary_color');

  EXEC('UPDATE dbo.companies SET secondary_color = ''#1E40AF'' WHERE secondary_color IS NULL');
END;

IF COL_LENGTH('dbo.applications', 'deployed_at') IS NULL
  ALTER TABLE dbo.applications ADD deployed_at DATETIMEOFFSET NULL;

COMMIT TRANSACTION;
