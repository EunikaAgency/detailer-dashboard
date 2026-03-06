import { NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { requireApiAuthIfEnabled } from "@/lib/apiAccess";

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
    const auth = await requireApiAuthIfEnabled(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique timestamp and create organized directory structure
    const timestamp = Date.now();
    const originalName = file.name.replace(/\.pdf$/i, '');
    const folderName = `${timestamp}-${originalName}`;
    const conversionDir = join(process.cwd(), 'public', 'converted', folderName);
    const imagesDir = join(conversionDir, 'images');
    
    // Create directories
    await mkdir(imagesDir, { recursive: true });

    // Save the original PDF
    const filename = `${timestamp}-${file.name}`;
    const filepath = join(conversionDir, filename);
    await writeFile(filepath, buffer);
    console.log('PDF saved to:', filepath);
    console.log('File exists:', existsSync(filepath));

    // Convert PDF to images - dynamic import to avoid SSR issues
    const { fromPath } = await import('pdf2pic');
    
    // Convert PDF to images
    const options = {
      density: 300,
      saveFilename: `page`,
      savePath: imagesDir,
      format: 'png',
      width: CONVERSION_WIDTH,
      height: CONVERSION_HEIGHT
    };

    console.log('Conversion options:', options);
    const convert = fromPath(filepath, options);
    
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

    // Don't delete the original PDF - keep it in the folder
    // await unlink(filepath);

    if (totalPages === 0) {
      return NextResponse.json(
        { error: 'Failed to convert any pages. The PDF might be corrupted or protected.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'PDF converted successfully',
      images: imageUrls,
      totalPages
    });

  } catch (error) {
    console.error('Conversion error:', error);
    return NextResponse.json(
      { error: 'Failed to convert PDF: ' + error.message },
      { status: 500 }
    );
  }
}
