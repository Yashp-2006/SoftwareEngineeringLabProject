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
      
      // We want to replace `@backend/` with a relative path to `backend/`
      // First, figure out how many levels deep `dir` is relative to `clientDir`
      const relativeToClient = path.relative(dir, clientDir);
      // from client, backend is `../backend`
      // so from `dir`, backend is `${relativeToClient}/../backend`
      let pathToBackend = path.join(relativeToClient, '../backend').replace(/\\/g, '/');
      if (!pathToBackend.startsWith('.')) {
        pathToBackend = './' + pathToBackend;
      }
      
      // regex to match import statements with @backend/
      const regex1 = /from\s+['"]@backend\/(.*?)['"]/g;
      const regex2 = /import\s*\(\s*['"]@backend\/(.*?)['"]\s*\)/g;
      
      let modified = false;
      if (regex1.test(content) || regex2.test(content)) {
        content = content.replace(regex1, `from '${pathToBackend}/$1'`);
        content = content.replace(regex2, `import('${pathToBackend}/$1')`);
        modified = true;
      }

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated to relative in', fullPath);
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
    const regex1 = /from\s+['"]@backend\/(.*?)['"]/g;
    const regex2 = /import\s*\(\s*['"]@backend\/(.*?)['"]\s*\)/g;
    if (regex1.test(content) || regex2.test(content)) {
      content = content.replace(regex1, `from '../backend/$1'`);
      content = content.replace(regex2, `import('../backend/$1')`);
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log('Updated to relative in', fullPath);
    }
  }
}
console.log('Done mapping @backend to relative paths');
