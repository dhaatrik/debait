#!/usr/bin/env node

/**
 * Zero-dependency cross-platform packaging script for DeBait Chrome Extension.
 * Generates store-ready zip archives using Node.js built-ins (fs, path, zlib).
 */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT_DIR = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'manifest.json');

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('Error: manifest.json not found in root directory.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const version = manifest.version;
const distDir = path.join(ROOT_DIR, 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const zipFilename = `debait-v${version}.zip`;
const zipPath = path.join(distDir, zipFilename);

// Strict distribution whitelist (excludes dev markdown, tests, scripts, git)
const INCLUDED_ENTRIES = [
  'manifest.json',
  'background.js',
  'content',
  'popup',
  'icons',
  'LICENSE'
];

function collectFiles(basePath, relativeDir = '') {
  const fullPath = path.join(basePath, relativeDir);
  if (!fs.existsSync(fullPath)) return [];

  const stat = fs.statSync(fullPath);
  if (stat.isFile()) {
    return [{
      name: relativeDir.replace(/\\/g, '/'),
      content: fs.readFileSync(fullPath)
    }];
  }

  if (stat.isDirectory()) {
    const entries = fs.readdirSync(fullPath);
    const files = [];
    for (const entry of entries) {
      const entryRelPath = relativeDir ? path.join(relativeDir, entry) : entry;
      files.push(...collectFiles(basePath, entryRelPath));
    }
    return files;
  }

  return [];
}

// Precomputed CRC32 table for zero-dependency raw zip assembly
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c >>> 0;
}

function calculateCrc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createZipArchive(files) {
  const localHeaders = [];
  const centralDirectoryHeaders = [];
  let currentOffset = 0;

  for (const file of files) {
    const filenameBuf = Buffer.from(file.name.replace(/\\/g, '/'), 'utf8');
    const uncompressedData = file.content;
    const compressedData = zlib.deflateRawSync(uncompressedData);
    const crc = calculateCrc32(uncompressedData);

    // 1. Local File Header (30 bytes + filename + data)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local header signature
    localHeader.writeUInt16LE(20, 4);         // Version needed (2.0)
    localHeader.writeUInt16LE(0, 6);          // General purpose bit flag
    localHeader.writeUInt16LE(8, 8);          // Compression: Deflate
    localHeader.writeUInt16LE(0, 10);         // Last mod file time
    localHeader.writeUInt16LE(0, 12);         // Last mod file date
    localHeader.writeUInt32LE(crc, 14);       // CRC-32
    localHeader.writeUInt32LE(compressedData.length, 18); // Compressed size
    localHeader.writeUInt32LE(uncompressedData.length, 22); // Uncompressed size
    localHeader.writeUInt16LE(filenameBuf.length, 26);    // Filename length
    localHeader.writeUInt16LE(0, 28);         // Extra field length

    localHeaders.push(localHeader, filenameBuf, compressedData);

    // 2. Central Directory Header (46 bytes + filename)
    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(0x02014b50, 0);    // Central dir signature
    cdHeader.writeUInt16LE(20, 4);            // Version made by
    cdHeader.writeUInt16LE(20, 6);            // Version needed
    cdHeader.writeUInt16LE(0, 8);             // General purpose bit flag
    cdHeader.writeUInt16LE(8, 10);            // Compression: Deflate
    cdHeader.writeUInt16LE(0, 12);            // Last mod file time
    cdHeader.writeUInt16LE(0, 14);            // Last mod file date
    cdHeader.writeUInt32LE(crc, 16);          // CRC-32
    cdHeader.writeUInt32LE(compressedData.length, 20); // Compressed size
    cdHeader.writeUInt32LE(uncompressedData.length, 24); // Uncompressed size
    cdHeader.writeUInt16LE(filenameBuf.length, 28);    // Filename length
    cdHeader.writeUInt16LE(0, 30);            // Extra field length
    cdHeader.writeUInt16LE(0, 32);            // File comment length
    cdHeader.writeUInt16LE(0, 34);            // Disk number start
    cdHeader.writeUInt16LE(0, 36);            // Internal file attributes
    cdHeader.writeUInt32LE(0, 38);            // External file attributes
    cdHeader.writeUInt32LE(currentOffset, 42);// Relative offset of local header

    centralDirectoryHeaders.push(cdHeader, filenameBuf);

    currentOffset += localHeader.length + filenameBuf.length + compressedData.length;
  }

  const centralDirectoryOffset = currentOffset;
  const centralDirectoryBuf = Buffer.concat(centralDirectoryHeaders);

  // 3. End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);          // EOCD signature
  eocd.writeUInt16LE(0, 4);                   // Number of this disk
  eocd.writeUInt16LE(0, 6);                   // Disk with start of CD
  eocd.writeUInt16LE(files.length, 8);        // Number of CD entries on this disk
  eocd.writeUInt16LE(files.length, 10);       // Total number of CD entries
  eocd.writeUInt32LE(centralDirectoryBuf.length, 12); // Size of CD
  eocd.writeUInt32LE(centralDirectoryOffset, 16);     // Offset of start of CD
  eocd.writeUInt16LE(0, 20);                  // Zip file comment length

  return Buffer.concat([...localHeaders, centralDirectoryBuf, eocd]);
}

// Collect all files to include
const filesToPackage = [];
for (const entry of INCLUDED_ENTRIES) {
  const fullEntryPath = path.join(ROOT_DIR, entry);
  if (fs.existsSync(fullEntryPath)) {
    filesToPackage.push(...collectFiles(ROOT_DIR, entry));
  } else {
    console.warn(`Warning: Whitelisted entry not found: ${entry}`);
  }
}

// Generate package
console.log(`Packaging DeBait v${version}...`);
const zipBuffer = createZipArchive(filesToPackage);
fs.writeFileSync(zipPath, zipBuffer);

console.log(`Successfully created: ${path.relative(ROOT_DIR, zipPath)} (${(zipBuffer.length / 1024).toFixed(1)} KB)`);
console.log(`Included ${filesToPackage.length} files:`);
for (const file of filesToPackage) {
  console.log(`  + ${file.name}`);
}
