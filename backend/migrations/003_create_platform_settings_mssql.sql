-- Create platform_settings table for admin configuration
-- SQL Server version

CREATE TABLE platform_settings (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    setting_key NVARCHAR(255) NOT NULL UNIQUE,
    setting_value NVARCHAR(MAX),
    description NVARCHAR(MAX),
    created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
    updated_at DATETIMEOFFSET DEFAULT GETUTCDATE()
);

-- Create index for faster lookups
CREATE INDEX IX_platform_settings_key ON platform_settings(setting_key);

-- Insert default platform settings (using MERGE to handle conflicts)
MERGE platform_settings AS target
USING (VALUES
    ('platform_name', '"Business Manager"', 'The name of the platform'),
    ('platform_description', '"SaaS platform for business management tools"', 'Platform description'),
    ('max_users_per_company', '50', 'Maximum users allowed per company'),
    ('max_file_size_mb', '10', 'Maximum file upload size in MB'),
    ('allowed_file_types', '["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "jpg", "jpeg", "png", "gif"]', 'Allowed file types for upload'),
    ('maintenance_mode', 'false', 'Enable maintenance mode'),
    ('registration_enabled', 'true', 'Allow new user registrations'),
    ('email_verification_required', 'true', 'Require email verification for new users'),
    ('default_subscription_tier', '"free"', 'Default subscription tier for new companies'),
    ('support_email', '"support@businessmanager.com"', 'Support email address'),
    ('terms_of_service_url', '""', 'URL to terms of service'),
    ('privacy_policy_url', '""', 'URL to privacy policy')
) AS source (setting_key, setting_value, description)
ON (target.setting_key = source.setting_key)
WHEN NOT MATCHED THEN
    INSERT (setting_key, setting_value, description)
    VALUES (source.setting_key, source.setting_value, source.description);

-- Create user_applications table for tracking application usage
CREATE TABLE user_applications (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL,
    application_id UNIQUEIDENTIFIER NOT NULL,
    last_accessed_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
    access_count INT DEFAULT 1,
    created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
    UNIQUE(user_id, application_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

-- Create user_templates table for tracking template usage
CREATE TABLE user_templates (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL,
    template_id NVARCHAR(64) NOT NULL,
    last_accessed_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
    access_count INT DEFAULT 1,
    created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
    UNIQUE(user_id, template_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IX_user_applications_user_id ON user_applications(user_id);
CREATE INDEX IX_user_applications_app_id ON user_applications(application_id);
CREATE INDEX IX_user_applications_last_accessed ON user_applications(last_accessed_at);

CREATE INDEX IX_user_templates_user_id ON user_templates(user_id);
CREATE INDEX IX_user_templates_template_id ON user_templates(template_id);
CREATE INDEX IX_user_templates_last_accessed ON user_templates(last_accessed_at);