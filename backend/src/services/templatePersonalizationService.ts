import JSZip from 'jszip';
import sharp from 'sharp';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import ExcelJS from 'exceljs';

export type TemplateFormat = 'docx' | 'pdf' | 'xlsx';

export interface CompanyBranding {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface ThemeConfig {
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

export interface PersonalizationOptions {
  format: TemplateFormat;
  templateContent: string;
  company: CompanyBranding;
  theme: ThemeConfig;
  logoBuffer?: Buffer | null;
  fileName?: string;
}

export interface PersonalizationResult {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}

const COLOR_FALLBACK_PRIMARY = '#1f2937';
const COLOR_FALLBACK_SECONDARY = '#3b82f6';

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const normalizeColor = (value?: string | null, fallback = COLOR_FALLBACK_PRIMARY): string => {
  if (!value || typeof value !== 'string') {
    return fallback.replace(/^#/, '');
  }
  const hex = value.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return hex.toUpperCase();
  }
  return fallback.replace(/^#/, '');
};

const applyPlaceholders = (template: string, replacements: Record<string, string>): string => {
  return Object.entries(replacements).reduce((acc, [key, value]) => acc.split(key).join(value), template);
};

const hexToRgb = (hex: string) => {
  const normalized = normalizeColor(hex);
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
};

const buildDocx = async (content: string, primaryColor: string, secondaryColor: string, logoBuffer?: Buffer | null): Promise<Buffer> => {
  const zip = new JSZip();

  const contentTypes: string[] = [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`,
    `  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`,
    `  <Default Extension="xml" ContentType="application/xml"/>`,
    `  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>`
  ];
  if (logoBuffer) {
    contentTypes.push(`  <Default Extension="png" ContentType="image/png"/>`);
  }
  contentTypes.push(`</Types>`);

  zip.file('[Content_Types].xml', contentTypes.join('\n'));
  zip.folder('_rels')?.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>\n</Relationships>`);

  const wordFolder = zip.folder('word');
  if (!wordFolder) {
    throw new Error('Failed to initialise DOCX structure');
  }

  const paragraphs = content.split(/\r?\n/).map(line => {
    const escaped = escapeXml(line || '');
    return `<w:p><w:r><w:rPr><w:color w:val="${primaryColor}"/></w:rPr><w:t>${escaped}</w:t></w:r></w:p>`;
  }).join('');

  let logoParagraph = '';
  if (logoBuffer) {
    const processedLogo = await sharp(logoBuffer).resize({ width: 320, withoutEnlargement: true }).png().toBuffer();
    wordFolder.folder('media')?.file('logo.png', processedLogo);
    wordFolder.folder('_rels')?.file('document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n  <Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>\n</Relationships>`);

    logoParagraph = `
      <w:p>
        <w:r>
          <w:drawing>
            <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
              <wp:extent cx="4572000" cy="1371600"/>
              <wp:docPr id="1" name="CompanyLogo"/>
              <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                    <pic:nvPicPr>
                      <pic:cNvPr id="0" name="logo.png"/>
                      <pic:cNvPicPr/>
                    </pic:nvPicPr>
                    <pic:blipFill>
                      <a:blip r:embed="rIdLogo" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                      <a:stretch>
                        <a:fillRect/>
                      </a:stretch>
                    </pic:blipFill>
                    <pic:spPr>
                      <a:xfrm>
                        <a:off x="0" y="0"/>
                        <a:ext cx="4572000" cy="1371600"/>
                      </a:xfrm>
                      <a:prstGeom prst="rect">
                        <a:avLst/>
                      </a:prstGeom>
                    </pic:spPr>
                  </pic:pic>
                </a:graphicData>
              </a:graphic>
            </wp:inline>
          </w:drawing>
        </w:r>
      </w:p>
    `;
  }

  const themeParagraph = `<w:p><w:r><w:rPr><w:color w:val="${secondaryColor}"/></w:rPr><w:t>Brand Colours: #${primaryColor} / #${secondaryColor}</w:t></w:r></w:p>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${paragraphs}
    ${logoParagraph}
    ${themeParagraph}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  wordFolder.file('document.xml', documentXml);

  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
};

const buildPdf = async (content: string, primaryColor: string, logoBuffer?: Buffer | null): Promise<Buffer> => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage();
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const textColor = hexToRgb(primaryColor);

  let cursorY = height - 72;
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    page.drawText(line, {
      x: 72,
      y: cursorY,
      font,
      size: 14,
      color: textColor
    });
    cursorY -= 24;
    if (cursorY < 72) {
      cursorY = height - 72;
    }
  }

  if (logoBuffer) {
    const logoPng = await sharp(logoBuffer).resize({ width: 200, withoutEnlargement: true }).png().toBuffer();
    const image = await pdf.embedPng(logoPng);
    const pngDims = image.scale(0.5);
    page.drawImage(image, {
      x: width - pngDims.width - 72,
      y: height - pngDims.height - 72,
      width: pngDims.width,
      height: pngDims.height
    });
  }

  const pdfBytes = await pdf.save();
  return Buffer.from(pdfBytes);
};

const buildXlsx = async (content: string, primaryColor: string, secondaryColor: string, logoBuffer?: Buffer | null): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Template');

  worksheet.columns = [
    { header: 'Field', key: 'field', width: 40 },
    { header: 'Value', key: 'value', width: 60 }
  ];

  const lines = content.split(/\r?\n/).filter(Boolean);
  lines.forEach((line, index) => {
    worksheet.addRow({ field: `Line ${index + 1}`, value: line });
  });

  worksheet.getRow(1).font = { bold: true, color: { argb: `FF${primaryColor}` } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${secondaryColor}` }
  };

  if (logoBuffer) {
    const logoPng = await sharp(logoBuffer).resize({ width: 320, withoutEnlargement: true }).png().toBuffer();
    const imageId = workbook.addImage({ buffer: logoPng as any, extension: 'png' } as any);
    worksheet.addImage(imageId, {
      tl: { col: 2, row: 1 },
      ext: { width: 320, height: 120 }
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

export const personalizeTemplate = async (options: PersonalizationOptions): Promise<PersonalizationResult> => {
  const { company, theme, templateContent, format, logoBuffer, fileName } = options;
  const primaryColor = normalizeColor(theme.primaryColor, COLOR_FALLBACK_PRIMARY);
  const secondaryColor = normalizeColor(theme.secondaryColor, COLOR_FALLBACK_SECONDARY);

  const replacements: Record<string, string> = {
    '{{company.name}}': company.name ?? '',
    '{{company.email}}': company.email ?? '',
    '{{company.phone}}': company.phone ?? '',
    '{{company.address}}': company.address ?? '',
    '{{theme.primary}}': `#${primaryColor}`,
    '{{theme.secondary}}': `#${secondaryColor}`
  };

  const finalContent = applyPlaceholders(templateContent, replacements);

  switch (format) {
    case 'docx': {
      const buffer = await buildDocx(finalContent, primaryColor, secondaryColor, logoBuffer);
      return { buffer, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileName: fileName?.endsWith?.('.docx') ? fileName : 'personalized.docx' };
    }
    case 'pdf': {
      const buffer = await buildPdf(finalContent, primaryColor, logoBuffer);
      return { buffer, contentType: 'application/pdf', fileName: fileName?.endsWith?.('.pdf') ? fileName : 'personalized.pdf' };
    }
    case 'xlsx': {
      const buffer = await buildXlsx(finalContent, primaryColor, secondaryColor, logoBuffer);
      return { buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileName: fileName?.endsWith?.('.xlsx') ? fileName : 'personalized.xlsx' };
    }
    default:
      throw new Error(`Unsupported template format: ${format}`);
  }
};

export const resolveTemplateFormat = (fileType?: string | null, fileName?: string | null): TemplateFormat | null => {
  const type = (fileType || '').toLowerCase();
  if (type.includes('wordprocessingml.document') || type.endsWith('msword')) {
    return 'docx';
  }
  if (type.includes('pdf')) {
    return 'pdf';
  }
  if (type.includes('spreadsheetml.sheet') || type.includes('excel')) {
    return 'xlsx';
  }

  const name = (fileName || '').toLowerCase();
  if (name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.xlsx')) return 'xlsx';
  return null;
};
