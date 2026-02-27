import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';

const execPromise = promisify(exec);

const MAX_CONVERSION_MS = Number(process.env.CONVERSION_TIMEOUT_MS || '45000');
const CONVERSION_DENSITY = Number(process.env.CONVERSION_DENSITY || '150');
const CONVERSION_WIDTH = Number(process.env.CONVERSION_WIDTH || '1920');
const CONVERSION_HEIGHT = Number(process.env.CONVERSION_HEIGHT || '1080');

// Polyfill for DOMMatrix if needed
if (typeof global.DOMMatrix === 'undefined') {
  global.DOMMatrix = class DOMMatrix {
    constructor() {}
  };
}

const GM_BINARY_ERROR_RE =
  /Could not execute GraphicsMagick\/ImageMagick|gm\/convert binaries can't be found|spawn gm ENOENT|spawn convert ENOENT/i;

const shQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

const isGmMissingError = (error) => GM_BINARY_ERROR_RE.test(String(error?.message || error || ""));

const getPdfPageCount = async (pdfPath) => {
  try {
    const { stdout } = await execPromise(`pdfinfo ${shQuote(pdfPath)}`);
    const match = stdout.match(/Pages:\s*(\d+)/i);
    return match ? Number(match[1]) : 0;
  } catch {
    return 0;
  }
};

const convertPdfWithPdftoppm = async (pdfPath, imagesDir, folderName) => {
  try {
    await execPromise('which pdftoppm');
  } catch {
    throw new Error('pdftoppm is not installed. Install poppler-utils to enable PDF conversion fallback.');
  }

  const detectedPages = await getPdfPageCount(pdfPath);
  const imageUrls = [];
  let page = 1;

  console.log('Falling back to pdftoppm for conversion...');

  while (true) {
    if (detectedPages > 0 && page > detectedPages) {
      break;
    }

    const outputBase = join(imagesDir, `page.${page}`);
    const outputImage = `${outputBase}.png`;
    const command = [
      'pdftoppm',
      '-png',
      '-f',
      String(page),
      '-l',
      String(page),
      '-singlefile',
      '-r',
      String(CONVERSION_DENSITY),
      '-scale-to-x',
      String(CONVERSION_WIDTH),
      '-scale-to-y',
      String(CONVERSION_HEIGHT),
      shQuote(pdfPath),
      shQuote(outputBase),
    ].join(' ');

    await execPromise(command, { timeout: MAX_CONVERSION_MS });
    if (existsSync(outputImage)) {
      imageUrls.push(`/uploads/converted/${folderName}/images/page.${page}.png`);
      page++;
      continue;
    }
    if (page === 1) {
      throw new Error('pdftoppm fallback did not produce page 1 image.');
    }
    break;
  }

  return imageUrls;
};

const convertPdfPathToImages = async (pdfPath, imagesDir, folderName, noPagesErrorMessage) => {
  try {
    const { fromPath } = await import('pdf2pic');
    const options = {
      density: CONVERSION_DENSITY,
      saveFilename: `page`,
      savePath: imagesDir,
      format: 'png',
      width: CONVERSION_WIDTH,
      height: CONVERSION_HEIGHT
    };

    console.log('Conversion options:', options);
    const convert = fromPath(pdfPath, options);

    const imageUrls = [];
    let page = 1;
    let hasMorePages = true;
    const startTime = Date.now();

    while (hasMorePages) {
      try {
        if (Date.now() - startTime > MAX_CONVERSION_MS) {
          console.warn(`Reached conversion timeout (${MAX_CONVERSION_MS}ms). Stopping conversion.`);
          break;
        }
        console.log(`Attempting to convert page ${page}...`);
        await convert(page, { responseType: 'image' });

        const imageFilename = `page.${page}.png`;
        const imagePath = join(imagesDir, imageFilename);

        await new Promise(resolve => setTimeout(resolve, 100));

        if (existsSync(imagePath)) {
          console.log(`✓ Image created: ${imageFilename}`);
          imageUrls.push(`/uploads/converted/${folderName}/images/${imageFilename}`);
          page++;
        } else {
          console.log(`✗ Image not found at ${imagePath}`);
          hasMorePages = false;
        }
      } catch (error) {
        console.error(`Error on page ${page}:`, error.message);
        if (page === 1) throw error;
        hasMorePages = false;
      }
    }

    if (!imageUrls.length) {
      throw new Error(noPagesErrorMessage);
    }

    return imageUrls;
  } catch (error) {
    if (!isGmMissingError(error)) {
      throw error;
    }

    console.warn('pdf2pic requires gm/convert but binary is unavailable. Using pdftoppm fallback.');
    const fallbackImages = await convertPdfWithPdftoppm(pdfPath, imagesDir, folderName);
    if (!fallbackImages.length) {
      throw new Error(noPagesErrorMessage);
    }
    return fallbackImages;
  }
};

/**
 * Convert PDF to images
 * @param {Buffer} fileBuffer - The PDF file buffer
 * @param {string} originalFilename - Original filename
 * @returns {Promise<{images: string[], totalPages: number, folderName: string}>}
 */
export async function convertPdfToImages(fileBuffer, originalFilename, targetFolderName = "") {
  const timestamp = Date.now();
  const originalName = originalFilename.replace(/\.pdf$/i, '');
  const folderName = targetFolderName || `${timestamp}-${originalName}`;
  const conversionDir = join(process.cwd(), 'public', 'uploads', 'converted', folderName);
  const imagesDir = join(conversionDir, 'images');
  
  // Create directories
  await mkdir(imagesDir, { recursive: true });

  // Save the original PDF in the converted directory
  const filename = originalFilename; // Keep original filename
  const filepath = join(conversionDir, filename);
  await writeFile(filepath, fileBuffer);
  console.log('PDF saved to:', filepath);
  console.log('File size:', fileBuffer.length, 'bytes');
  console.log('File exists after write:', existsSync(filepath));

  try {
    console.log('Starting PDF conversion...');
    console.log('Converting from:', filepath);
    const imageUrls = await convertPdfPathToImages(
      filepath,
      imagesDir,
      folderName,
      'Failed to convert any pages. The PDF might be corrupted or protected.'
    );
    const totalPages = imageUrls.length;

    return {
      images: imageUrls,
      totalPages,
      folderName
    };
  } catch (error) {
    // Don't clean up - keep original file in converted directory for troubleshooting
    console.error('PDF conversion failed, original file kept at:', filepath);
    throw error;
  }
}

/**
 * Convert PPT/PPTX to images
 * @param {Buffer} fileBuffer - The PPT/PPTX file buffer
 * @param {string} originalFilename - Original filename
 * @returns {Promise<{images: string[], totalPages: number, folderName: string}>}
 */
export async function convertPptToImages(fileBuffer, originalFilename, targetFolderName = "") {
  const timestamp = Date.now();
  const originalName = originalFilename.replace(/\.(ppt|pptx)$/i, '');
  const folderName = targetFolderName || `${timestamp}-${originalName}`;
  const conversionDir = join(process.cwd(), 'public', 'uploads', 'converted', folderName);
  const imagesDir = join(conversionDir, 'images');
  
  // Create directories
  await mkdir(imagesDir, { recursive: true });

  // Save the original PPT/PPTX in the converted directory
  const filename = originalFilename; // Keep original filename
  const filepath = join(conversionDir, filename);
  const baseName = filename.replace(/\.(ppt|pptx)$/i, '');
  const pdfPath = join(conversionDir, `${baseName}.pdf`);

  await writeFile(filepath, fileBuffer);
  console.log('PPT saved to:', filepath);

  try {
    // Check if LibreOffice is available
    let libreOfficePath = 'libreoffice';
    try {
      await execPromise('which libreoffice');
      console.log('LibreOffice found');
    } catch (error) {
      try {
        await execPromise('which soffice');
        libreOfficePath = 'soffice';
        console.log('soffice found');
      } catch (e) {
        throw new Error('LibreOffice is not installed. Please install LibreOffice to convert PPT/PPTX files.');
      }
    }

    // Convert PPT/PPTX to PDF using LibreOffice
    const command = `${libreOfficePath} --headless --convert-to pdf --outdir "${conversionDir}" "${filepath}"`;
    console.log('Running command:', command);
    const { stdout, stderr } = await execPromise(command, { timeout: 60000 });
    console.log('LibreOffice stdout:', stdout);
    if (stderr) console.log('LibreOffice stderr:', stderr);

    // Check if PDF was created
    console.log('Checking for PDF at:', pdfPath);
    if (!existsSync(pdfPath)) {
      throw new Error('PDF conversion failed - output file not found');
    }
    console.log('✓ PDF created successfully');

    const imageUrls = await convertPdfPathToImages(
      pdfPath,
      imagesDir,
      folderName,
      'Failed to convert any pages. The file might be corrupted or unsupported.'
    );
    const totalPages = imageUrls.length;

    return {
      images: imageUrls,
      totalPages,
      folderName
    };
  } catch (error) {
    // Don't clean up - keep original file in converted directory for troubleshooting
    console.error('PPT/PPTX conversion failed, original file kept at:', filepath);
    throw error;
  }
}

/**
 * Check if a file is a PDF
 * @param {string} filename - The filename
 * @param {string} mimeType - The MIME type
 * @returns {boolean}
 */
export function isPdf(filename, mimeType) {
  return mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf');
}

/**
 * Check if a file is a PPT/PPTX
 * @param {string} filename - The filename
 * @param {string} mimeType - The MIME type
 * @returns {boolean}
 */
export function isPpt(filename, mimeType) {
  const validTypes = [
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];
  return validTypes.includes(mimeType) || filename.match(/\.(ppt|pptx)$/i);
}

/**
 * Convert file to images if it's a PDF or PPT/PPTX
 * @param {Buffer} fileBuffer - The file buffer
 * @param {string} filename - The filename
 * @param {string} mimeType - The MIME type
 * @returns {Promise<{converted: boolean, images?: string[], totalPages?: number, folderName?: string}>}
 */
export async function convertFileToImages(fileBuffer, filename, mimeType, targetFolderName = "") {
  if (isPdf(filename, mimeType)) {
    const result = await convertPdfToImages(fileBuffer, filename, targetFolderName);
    return { converted: true, ...result };
  } else if (isPpt(filename, mimeType)) {
    const result = await convertPptToImages(fileBuffer, filename, targetFolderName);
    return { converted: true, ...result };
  }
  return { converted: false };
}
