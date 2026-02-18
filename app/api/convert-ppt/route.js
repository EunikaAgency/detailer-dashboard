import { NextResponse } from 'next/server';
import { writeFile, mkdir, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';

const execPromise = promisify(exec);

// Polyfill for DOMMatrix if needed
if (typeof global.DOMMatrix === 'undefined') {
  global.DOMMatrix = class DOMMatrix {
    constructor() {}
  };
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const CONVERSION_WIDTH = Number(process.env.CONVERSION_WIDTH || '1920');
const CONVERSION_HEIGHT = Number(process.env.CONVERSION_HEIGHT || '1080');

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = [
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(ppt|pptx)$/i)) {
      return NextResponse.json(
        { error: 'Only PPT/PPTX files are allowed' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique timestamp and create organized directory structure
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const originalName = file.name.replace(/\.(ppt|pptx)$/i, '');
    const folderName = `${timestamp}-${originalName}`;
    const conversionDir = join(process.cwd(), 'public', 'converted', folderName);
    const imagesDir = join(conversionDir, 'images');
    
    // Create directories
    await mkdir(imagesDir, { recursive: true });

    // Save the original PPT/PPTX
    const filename = `${timestamp}-${file.name}`;
    const filepath = join(conversionDir, filename);
    // LibreOffice creates PDF with same basename as input file
    const baseName = filename.replace(/\.(ppt|pptx)$/i, '');
    const pdfPath = join(conversionDir, `${baseName}.pdf`);

    // Save the uploaded file temporarily
    await writeFile(filepath, buffer);
    console.log('PPT saved to:', filepath);

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
        // Clean up
        await unlink(filepath);
        return NextResponse.json(
          { 
            error: 'LibreOffice is not installed. Please install LibreOffice to convert PPT/PPTX files.',
            installCommand: 'sudo apt-get install libreoffice'
          },
          { status: 500 }
        );
      }
    }

    // Convert PPT/PPTX to PDF using LibreOffice
    try {
      const command = `${libreOfficePath} --headless --convert-to pdf --outdir "${conversionDir}" "${filepath}"`;
      console.log('Running command:', command);
      const { stdout, stderr } = await execPromise(command, { timeout: 60000 });
      console.log('LibreOffice stdout:', stdout);
      if (stderr) console.log('LibreOffice stderr:', stderr);
    } catch (error) {
      console.error('LibreOffice conversion error:', error);
      await unlink(filepath);
      return NextResponse.json(
        { error: 'Failed to convert PPT to PDF: ' + error.message },
        { status: 500 }
      );
    }

    // Check if PDF was created
    console.log('Checking for PDF at:', pdfPath);
    if (!existsSync(pdfPath)) {
      console.error('PDF not created at:', pdfPath);
      await unlink(filepath);
      return NextResponse.json(
        { error: 'PDF conversion failed - output file not found' },
        { status: 500 }
      );
    }
    console.log('✓ PDF created successfully');

    // Convert PDF to images
    const { fromPath } = await import('pdf2pic');
    
    const options = {
      density: 300,
      saveFilename: `page`,
      savePath: imagesDir,
      format: 'png',
      width: CONVERSION_WIDTH,
      height: CONVERSION_HEIGHT
    };

    console.log('Conversion options:', options);
    const convert = fromPath(pdfPath, options);
    
    // Convert pages - we'll convert until we hit an error (no more pages)
    const imageUrls = [];
    let page = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      try {
        console.log(`Attempting to convert page ${page}...`);
        const result = await convert(page, { responseType: 'image' });
        console.log(`Conversion result for page ${page}:`, result);
        
        const imageFilename = `page.${page}.png`;
        const imagePath = join(imagesDir, imageFilename);
        
        console.log('Checking for image at:', imagePath);
        
        // Verify the image was created
        if (existsSync(imagePath)) {
          console.log(`✓ Image created: ${imageFilename}`);
          imageUrls.push(`/converted/${folderName}/images/${imageFilename}`);
          page++;
        } else {
          console.log(`✗ Image not found at ${imagePath}`);
          hasMorePages = false;
        }
      } catch (error) {
        // No more pages or conversion error
        console.error(`Error on page ${page}:`, error.message);
        if (page === 1) {
          console.error('Error converting first page:', error);
          throw error; // Re-throw first page errors
        }
        hasMorePages = false;
      }
    }

    const totalPages = imageUrls.length;

    // Don't delete files - keep everything in the folder
    // await unlink(filepath);
    // await unlink(pdfPath);

    if (totalPages === 0) {
      return NextResponse.json(
        { error: 'Failed to convert any pages. The file might be corrupted or unsupported.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'PPT/PPTX converted successfully',
      images: imageUrls,
      totalPages
    });

  } catch (error) {
    console.error('Conversion error:', error);
    return NextResponse.json(
      { error: 'Failed to convert PPT/PPTX: ' + error.message },
      { status: 500 }
    );
  }
}
