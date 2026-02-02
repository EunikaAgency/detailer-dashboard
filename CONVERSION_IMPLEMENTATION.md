# PDF/PPT to Image Conversion Implementation

## Overview
Successfully integrated automatic PDF, PPT, and PPTX to image conversion functionality across the product management system. When users upload these file types, they are automatically converted to high-quality PNG images.

## Implementation Details

### 1. Conversion Utility (`lib/fileConverter.js`)
Created a centralized utility module that handles:
- **PDF Conversion**: Uses `pdf2pic` library to convert PDF pages to PNG images
- **PPT/PPTX Conversion**: Uses LibreOffice to first convert to PDF, then converts to images
- **Automatic Detection**: Identifies file types by MIME type and extension
- **Error Handling**: Falls back to saving original file if conversion fails

**Key Functions:**
- `convertPdfToImages(buffer, filename)` - Converts PDF to images
- `convertPptToImages(buffer, filename)` - Converts PPT/PPTX to images
- `convertFileToImages(buffer, filename, mimeType)` - Main conversion function
- `isPdf()` and `isPpt()` - File type detection helpers

### 2. Add Product (`/api/products` POST)
**File**: [app/api/products/route.js](app/api/products/route.js)

When adding a new product:
- Detects PDF/PPT/PPTX files in media uploads
- Automatically converts them to images
- Stores all converted images in `/public/converted/{timestamp}-{filename}/images/`
- Each page becomes a separate image in the product media array
- Original files are preserved in the conversion folder

### 3. Edit Product Media (`/api/products/[id]/media` POST)
**File**: [app/api/products/[id]/media/route.js](app/api/products/[id]/media/route.js)

When adding media to an existing product:
- Same conversion logic as Add Product
- Appends converted images to product's media array
- Maintains existing media items

### 4. Edit Product (`/api/products/[id]` PUT)
**File**: [app/api/products/[id]/route.js](app/api/products/[id]/route.js)

Enhanced to support both JSON and FormData:
- **JSON Mode**: Updates product metadata (existing functionality)
- **FormData Mode**: Handles new file uploads with conversion
- Intelligently merges new media with existing media
- Cleans up removed files from uploads directory

## Conversion Settings

### Image Quality
- **Density**: 300 DPI (high quality)
- **Format**: PNG
- **Dimensions**: 2000x2000 pixels (maintains aspect ratio)

### File Organization
```
public/
  └── uploads/
      ├── (regular uploaded files like images, videos)
      └── converted/            # Converted PDF/PPT files
          └── {timestamp}-{name}/
              ├── {original-filename}.pdf or .ppt(x)  ← Original file preserved
              └── images/       # Generated PNG files
                  ├── page.1.png
                  ├── page.2.png
                  └── page.N.png
```

## Dependencies

### Required NPM Package
- **pdf2pic**: Installed via `npm install pdf2pic`

### System Requirements (CRITICAL)

#### For PDF Conversion (Required):
```bash
# Ubuntu/Debian
sudo apt-get install -y graphicsmagick ghostscript

# Verify installation
which gm  # Should show /usr/bin/gm
which gs  # Should show /usr/bin/gs
```

#### For PPT/PPTX Conversion (Required):
```bash
# Ubuntu/Debian
sudo apt-get install -y libreoffice

# The API will return a helpful error if LibreOffice is not found
```

**Note**: Without GraphicsMagick and Ghostscript, PDF conversion will fail and the original PDF will be saved to the uploads directory instead of being converted to images.

## Usage Examples

### 1. Add Product with PDF
```javascript
const formData = new FormData();
formData.append('name', 'Product Guide');
formData.append('category', 'Documentation');
formData.append('description', 'Product information');
formData.append('mediaFile', pdfFile); // Will auto-convert

const response = await fetch('/api/products', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});
```

### 2. Add Media to Existing Product
```javascript
const formData = new FormData();
formData.append('mediaFile', pptFile); // Will auto-convert

const response = await fetch('/api/products/{id}/media', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});
```

### 3. Update Product with New Files
```javascript
const formData = new FormData();
formData.append('name', 'Updated Product');
formData.append('mediaFile', pdfFile); // Will auto-convert and merge

const response = await fetch('/api/products/{id}', {
  method: 'PUT',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});
```

## Supported File Types

### Automatic Conversion
- ✅ PDF (`.pdf`)
- ✅ PowerPoint (`.ppt`)
- ✅ PowerPoint OpenXML (`.pptx`)

### Pass-through (No Conversion)
- Images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`)
- Videos (`.mp4`, `.mov`, `.webm`, `.avi`)

## Error Handling

The implementation includes robust error handling:

1. **Conversion Failures**: If conversion fails, the original file is saved instead
2. **LibreOffice Missing**: Returns clear error message with installation instructions
3. **Invalid Files**: Validates file types before processing
4. **Logging**: Comprehensive console logging for debugging

## Testing Checklist

- [x] Install pdf2pic dependency
- [x] Install GraphicsMagick (required for PDF conversion)
- [x] Install Ghostscript (required for PDF conversion)
- [x] Create conversion utility module
- [x] Update Add Product endpoint
- [x] Update Edit Product Media endpoint
- [x] Update Edit Product endpoint
- [x] Test PDF conversion successfully
- [ ] Install LibreOffice on server (required for PPT/PPTX)
- [ ] Test with sample PPT/PPTX file
- [ ] Verify converted images display correctly in the UI
- [ ] Test error handling with invalid files

## Verified Working

✅ **PDF Conversion**: Tested and working with GraphicsMagick + Ghostscript  
✅ **Original File Preservation**: PDFs are saved in the converted directory  
✅ **Image Generation**: High-quality PNG images are created in the images subdirectory  
✅ **File Organization**: Timestamped folders keep conversions organized

## Notes

- Converted images are stored persistently in the `/public/converted/` directory
- Each conversion creates a unique folder with timestamp and filename
- Original files are preserved for reference
- The conversion process may take a few seconds for large files with many pages
- All three endpoints (Add Product, Edit Product Media, Edit Product) now support automatic conversion
