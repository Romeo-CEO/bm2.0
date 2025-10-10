import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import { personalizeTemplate } from './templatePersonalizationService';

const sampleCompany = {
  name: 'Contoso',
  email: 'info@contoso.com',
  phone: '+1-555-0100',
  address: '1 Contoso Way'
};

const sampleTheme = {
  primaryColor: '#123456',
  secondaryColor: '#abcdef'
};

const sampleLogo = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/lkCJ9QAAAABJRU5ErkJggg==',
  'base64'
);

describe('templatePersonalizationService', () => {
  it('replaces placeholders inside DOCX output', async () => {
    const result = await personalizeTemplate({
      format: 'docx',
      templateContent: 'Hello {{company.name}} at {{company.email}}',
      company: sampleCompany,
      theme: sampleTheme,
      logoBuffer: sampleLogo,
      fileName: 'sample.docx'
    });

    expect(result.contentType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(result.fileName).toBe('sample.docx');

    const zip = await JSZip.loadAsync(result.buffer);
    const docXml = await zip.file('word/document.xml')!.async('string');
    expect(docXml).toContain('Hello Contoso at info@contoso.com');
    expect(docXml).toContain('Brand Colours: #123456 / #ABCDEF');
    const rels = await zip.file('word/_rels/document.xml.rels')!.async('string');
    expect(rels).toContain('logo.png');
  });

  it('produces PDF with personalized content', async () => {
    const result = await personalizeTemplate({
      format: 'pdf',
      templateContent: 'Welcome {{company.name}}',
      company: sampleCompany,
      theme: sampleTheme,
      logoBuffer: null,
      fileName: 'sample.pdf'
    });

    expect(result.contentType).toBe('application/pdf');
    const pdf = await PDFDocument.load(result.buffer);
    expect(pdf.getPageCount()).toBeGreaterThan(0);
  });

  it('creates XLSX workbook with replaced text', async () => {
    const result = await personalizeTemplate({
      format: 'xlsx',
      templateContent: 'Primary Contact: {{company.email}}',
      company: sampleCompany,
      theme: sampleTheme,
      logoBuffer: null,
      fileName: 'sample.xlsx'
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer);
    const cell = workbook.getWorksheet('Template')?.getCell('B2');
    expect(cell?.value).toBe('Primary Contact: info@contoso.com');
  });
});
