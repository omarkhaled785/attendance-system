const fs = require('fs');
const path = require('path');

// Update this path to where your font actually is
const fontPath = path.join(__dirname, 'frontend/src/assets/fonts/Amiri-Regular.ttf');

if (!fs.existsSync(fontPath)) {
  console.error('❌ Font file not found at:', fontPath);
  console.log('Please update the fontPath variable to point to your Amiri-Regular.ttf file');
  process.exit(1);
}

const fontBuffer = fs.readFileSync(fontPath);
const base64Font = fontBuffer.toString('base64');

const output = `// Amiri Regular Font - Base64 Encoded
// This file is auto-generated. Do not edit manually.
export const amiriFontBase64 = "${base64Font}";
`;

const outputPath = path.join(__dirname, 'frontend/src/utils/arabicFont.js');
fs.writeFileSync(outputPath, output);

console.log('✅ Font converted to base64 successfully!');
console.log('📁 Saved to:', outputPath);
console.log('📊 Font size:', Math.round(base64Font.length / 1024), 'KB');