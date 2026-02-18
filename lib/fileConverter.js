import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';

const execPromise = promisify(exec);

const MAX_CONVERSION_PAGES = Number(process.env.CONVERSION_MAX_PAGES || '6');
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
    // Convert PDF to images - dynamic import to avoid SSR issues
    const { fromPath } = await import('pdf2pic');
    
    const options = {
      density: CONVERSION_DENSITY,
      saveFilename: `page`,
      savePath: imagesDir,
      format: 'png',
      width: CONVERSION_WIDTH,
      height: CONVERSION_HEIGHT
    };

    console.log('Starting PDF conversion...');
    console.log('Conversion options:', options);
    console.log('Converting from:', filepath);
    const convert = fromPath(filepath, options);
    
    // Convert pages
    const imageUrls = [];
    let page = 1;
    let hasMorePages = true;
    const startTime = Date.now();

    while (hasMorePages) {
      try {
        if (page > MAX_CONVERSION_PAGES) {
          console.warn(`Reached max page limit (${MAX_CONVERSION_PAGES}). Stopping conversion.`);
          break;
        }
        if (Date.now() - startTime > MAX_CONVERSION_MS) {
          console.warn(`Reached conversion timeout (${MAX_CONVERSION_MS}ms). Stopping conversion.`);
          break;
        }
        console.log(`Attempting to convert page ${page}...`);
        await convert(page, { responseType: 'image' });
        
        const imageFilename = `page.${page}.png`;
        const imagePath = join(imagesDir, imageFilename);
        
        // Small delay to ensure file system sync
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verify the image was created
        if (existsSync(imagePath)) {
          console.log(`✓ Image created: ${imageFilename}`);
          imageUrls.push(`/uploads/converted/${folderName}/images/${imageFilename}`);
          page++;
        } else {
          console.log(`✗ Image not found at ${imagePath}`);
          hasMorePages = false;
        }
      } catch (error) {
        // No more pages or conversion error
        console.error(`Error on page ${page}:`, error.message);
        if (page === 1) {
          throw error; // Re-throw first page errors
        }
        hasMorePages = false;
      }
    }

    const totalPages = imageUrls.length;

    if (totalPages === 0) {
      throw new Error('Failed to convert any pages. The PDF might be corrupted or protected.');
    }

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

    // Convert PDF to images
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
    
    // Convert pages
    const imageUrls = [];
    let page = 1;
    let hasMorePages = true;
    const startTime = Date.now();

    while (hasMorePages) {
      try {
        if (page > MAX_CONVERSION_PAGES) {
          console.warn(`Reached max page limit (${MAX_CONVERSION_PAGES}). Stopping conversion.`);
          break;
        }
        if (Date.now() - startTime > MAX_CONVERSION_MS) {
          console.warn(`Reached conversion timeout (${MAX_CONVERSION_MS}ms). Stopping conversion.`);
          break;
        }
        console.log(`Attempting to convert page ${page}...`);
        await convert(page, { responseType: 'image' });
        
        const imageFilename = `page.${page}.png`;
        const imagePath = join(imagesDir, imageFilename);
        
        // Small delay to ensure file system sync
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verify the image was created
        if (existsSync(imagePath)) {
          console.log(`✓ Image created: ${imageFilename}`);
          imageUrls.push(`/uploads/converted/${folderName}/images/${imageFilename}`);
          page++;
        } else {
          console.log(`✗ Image not found at ${imagePath}`);
          hasMorePages = false;
        }
      } catch (error) {
        // No more pages or conversion error
        console.error(`Error on page ${page}:`, error.message);
        if (page === 1) {
          throw error; // Re-throw first page errors
        }
        hasMorePages = false;
      }
    }

    const totalPages = imageUrls.length;

    if (totalPages === 0) {
      throw new Error('Failed to convert any pages. The file might be corrupted or unsupported.');
    }

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
