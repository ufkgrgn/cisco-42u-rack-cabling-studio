const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const pdfPath = path.resolve('d:/cisco/cisco-42u-rack-cabling-studio/servermax-katalog.pdf');
const buf = fs.readFileSync(pdfPath);
console.log('Read PDF buffer length:', buf.length);

let pos = 0;
let streams = 0;
let textChunks = [];

while ((pos = buf.indexOf('stream', pos)) !== -1) {
  let start = pos + 6;
  if (buf[start] === 0x0d && buf[start + 1] === 0x0a) start += 2;
  else if (buf[start] === 0x0a || buf[start] === 0x0d) start += 1;

  let end = buf.indexOf('endstream', start);
  if (end === -1) break;

  const slice = buf.subarray(start, end);
  streams++;

  try {
    const uncompressed = zlib.inflateSync(slice);
    const str = uncompressed.toString('latin1');
    textChunks.push(str);
  } catch (e) {
    const rawStr = slice.toString('latin1');
    if (rawStr.includes('BT') || rawStr.includes('Tj') || rawStr.includes('ET')) {
      textChunks.push(rawStr);
    }
  }

  pos = end + 9;
}

console.log(`Found ${streams} streams. Decompressed text chunks: ${textChunks.length}`);

let extractedText = [];
for (const chunk of textChunks) {
  const tjMatches = chunk.match(/\((.*?)\)\s*Tj/g);
  if (tjMatches) {
    for (const m of tjMatches) {
      const inner = m.match(/\((.*?)\)\s*Tj/);
      if (inner && inner[1]) extractedText.push(inner[1]);
    }
  }
  const tjArrayMatches = chunk.match(/\[(.*?)\]\s*TJ/g);
  if (tjArrayMatches) {
    for (const m of tjArrayMatches) {
      const parts = m.match(/\((.*?)\)/g);
      if (parts) {
        extractedText.push(parts.map(p => p.slice(1, -1)).join(''));
      }
    }
  }
}

console.log('Extracted strings count:', extractedText.length);
fs.writeFileSync(path.resolve(__dirname, 'extracted_pdf_raw.txt'), extractedText.join('\n'), 'utf8');

const fullText = textChunks.join('\n');
fs.writeFileSync(path.resolve(__dirname, 'all_streams_text.txt'), fullText, 'latin1');
console.log('Saved extracted files.');
