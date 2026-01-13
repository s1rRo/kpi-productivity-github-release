#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Patterns to fix
const patterns = [
  // Fix direct parseInt(req.query.param)
  {
    regex: /parseInt\(req\.query\.(\w+)(?:\s*as\s*string)?\s*,?\s*10?\)/g,
    replacement: (match, param) => `getQueryParamAsNumber(req.query.${param})`
  },
  // Fix new Date(req.query.param)
  {
    regex: /new Date\(req\.query\.(\w+)(?:\s*as\s*string)?\)/g,
    replacement: (match, param) => `new Date(getQueryParamAsString(req.query.${param}))`
  },
  // Fix String(req.query.param)
  {
    regex: /String\(req\.query\.(\w+)\)/g,
    replacement: (match, param) => `getQueryParamAsString(req.query.${param})`
  },
];

// Files to process
const routesDir = path.join(__dirname, 'src', 'routes');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Check if file already imports express-helpers
  const hasImport = content.includes("from '../utils/express-helpers'") ||
                    content.includes('from "../utils/express-helpers"');

  // Apply patterns
  patterns.forEach(({ regex, replacement }) => {
    if (regex.test(content)) {
      content = content.replace(regex, replacement);
      modified = true;
    }
  });

  // Add import if needed and modified
  if (modified && !hasImport) {
    // Find the last import statement
    const importRegex = /^import .* from ['"].*['"];?\s*$/gm;
    const imports = content.match(importRegex);

    if (imports && imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);
      const insertPosition = lastImportIndex + lastImport.length;

      const importStatement = "\nimport { getQueryParam, getQueryParamAsString, getQueryParamAsNumber } from '../utils/express-helpers';";

      content = content.slice(0, insertPosition) + importStatement + content.slice(insertPosition);
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed: ${path.basename(filePath)}`);
    return true;
  }

  return false;
}

function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  let totalFixed = 0;

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isFile() && file.endsWith('.ts')) {
      if (processFile(filePath)) {
        totalFixed++;
      }
    }
  });

  return totalFixed;
}

console.log('🔧 Fixing Express 5 query parameters...\n');

try {
  const fixed = processDirectory(routesDir);
  console.log(`\n✅ Fixed ${fixed} files`);
  console.log('\n⚠️  Note: Some complex cases may still need manual fixes');
  console.log('Run: npx tsc --noEmit to check for remaining errors\n');
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
