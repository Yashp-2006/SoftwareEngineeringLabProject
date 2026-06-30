const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

const map = {
  '@/lib/algolia': '@backend/lib/algolia',
  '@/lib/redis': '@backend/lib/redis',
  '@/lib/schemas': '@backend/types/schemas',
  '@/lib/firebase-admin': '@backend/lib/firebase-admin',
  '@lib/firebase-admin': '@backend/lib/firebase-admin',
  '@/lib/tiesheet-generator': '@backend/services/tiesheet-generator',
  '@lib/tiesheet-generator': '@backend/services/tiesheet-generator',
  '@/lib/tiesheet-pdf-exporter': '@backend/services/tiesheet-pdf-exporter',
  '@lib/tiesheet-pdf-exporter': '@backend/services/tiesheet-pdf-exporter',
  '@/lib/wkf-categories': '@backend/lib/wkf-categories',
  '@lib/wkf-categories': '@backend/lib/wkf-categories'
};

function processDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;

      for (const [oldImport, newImport] of Object.entries(map)) {
        const regex1 = new RegExp(`from\\s+['"]${oldImport}['"]`, 'g');
        const regex2 = new RegExp(`import\\s*\\(\\s*['"]${oldImport}['"]\\s*\\)`, 'g');
        
        if (regex1.test(content) || regex2.test(content)) {
          content = content.replace(regex1, `from '${newImport}'`);
          content = content.replace(regex2, `import('${newImport}')`);
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated imports in', fullPath);
      }
    }
  }
}

processDirectory(directoryPath);
console.log('Done replacing imports');
