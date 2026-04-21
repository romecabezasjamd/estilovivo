import { removeBackground } from '@imgly/background-removal-node';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

async function test() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Provide input image path');
    process.exit(1);
  }
  
  console.log('Testing background removal on:', inputPath);
  try {
    const blob = await removeBackground(inputPath);
    const buffer = Buffer.from(await blob.arrayBuffer());
    const outputPath = 'test-output.png';
    writeFileSync(outputPath, buffer);
    console.log('Success! Output saved to:', outputPath);
  } catch (err) {
    console.error('Failed to remove background:', err);
  }
}

test();
