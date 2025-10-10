IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[payments]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[payments] (
        [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        [gateway] NVARCHAR(50) NOT NULL,
        [payment_reference] NVARCHAR(255) NOT NULL,
        [invoice_number] NVARCHAR(255) NULL,
        [status] NVARCHAR(50) NOT NULL,
        [status_history] NVARCHAR(MAX) NULL,
        [amount] DECIMAL(18,2) NULL,
        [fee] DECIMAL(18,2) NULL,
        [currency] NVARCHAR(10) NULL,
        [user_id] UNIQUEIDENTIFIER NULL,
        [company_id] UNIQUEIDENTIFIER NULL,
        [raw_payload] NVARCHAR(MAX) NULL,
        [processed_at] DATETIME2 NULL,
        [created_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [updated_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_payments] PRIMARY KEY ([id])
    );

    CREATE UNIQUE INDEX [IX_payments_payment_reference]
        ON [dbo].[payments]([payment_reference]);
END
ELSE
BEGIN
    PRINT('payments table already exists');
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[trg_payments_updated_at]') AND type = 'TR')
BEGIN
    EXEC('CREATE TRIGGER [dbo].[trg_payments_updated_at] ON [dbo].[payments]
    AFTER UPDATE AS
    BEGIN
        SET NOCOUNT ON;
        UPDATE p
        SET updated_at = SYSUTCDATETIME()
        FROM [dbo].[payments] p
        INNER JOIN inserted i ON p.id = i.id;
    END');
END
GO
