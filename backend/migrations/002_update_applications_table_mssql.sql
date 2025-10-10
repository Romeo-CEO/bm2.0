-- Update applications table for external app marketplace architecture
-- SQL Server version - converted from PostgreSQL

-- Add new columns for external app support (one at a time for MSSQL)
ALTER TABLE applications ADD subdomain NVARCHAR(100);
ALTER TABLE applications ADD app_url NVARCHAR(MAX);
ALTER TABLE applications ADD icon_url NVARCHAR(MAX);
ALTER TABLE applications ADD screenshots NVARCHAR(MAX);
ALTER TABLE applications ADD developer NVARCHAR(255);
ALTER TABLE applications ADD version NVARCHAR(50);
ALTER TABLE applications ADD status NVARCHAR(50);