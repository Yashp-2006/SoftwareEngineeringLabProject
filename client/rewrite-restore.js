const fs = require('fs');
const path = require('path');

const clientDir = path.join(__dirname, 'client');
const srcDir = path.join(clientDir, 'src');

function processDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      const regex1 = /from\s+['"](\.\.\/)+backend\/(.*?)['"]/g;
      const regex2 = /import\s*\(\s*['"](\.\.\/)+backend\/(.*?)['"]\s*\)/g;
      
      let modified = false;
      if (regex1.test(content) || regex2.test(content)) {
        content = content.replace(regex1, `from '@backend/$2'`);
        content = content.replace(regex2, `import('@backend/$2')`);
        modified = true;
      }

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Restored @backend in', fullPath);
      }
    }
  }
}

processDirectory(srcDir);
// Also check root client components if any
const clientRootFiles = fs.readdirSync(clientDir);
for (const file of clientRootFiles) {
  const fullPath = path.join(clientDir, file);
  if (!fs.statSync(fullPath).isDirectory() && (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx'))) {
    let content = fs.readFileSync(fullPath, 'utf8');
    const regex1 = /from\s+['"](\.\.\/)+backend\/(.*?)['"]/g;
    const regex2 = /import\s*\(\s*['"](\.\.\/)+backend\/(.*?)['"]\s*\)/g;
    if (regex1.test(content) || regex2.test(content)) {
      content = content.replace(regex1, `from '@backend/$2'`);
      content = content.replace(regex2, `import('@backend/$2')`);
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log('Restored @backend in', fullPath);
    }
  }
}
console.log('Done mapping back to @backend');
