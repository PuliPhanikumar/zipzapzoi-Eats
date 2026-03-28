const fs = require('fs');
const path = require('path');

const targetDir = 'd:/zipzapzoi/ZipZapZoi Food Delivery/ZipZapZoi Eats Codes';

let filesModified = 0;
let errors = 0;

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('.git')) {
                walkDir(fullPath);
            }
        } else if (fullPath.endsWith('.html') || fullPath.endsWith('.js')) {
            try {
                let content = fs.readFileSync(fullPath, 'utf8');
                if (content.includes('© 2025')) {
                    content = content.replace(/© 2025/g, '© 2025');
                    fs.writeFileSync(fullPath, content, 'utf8');
                    console.log(`Updated copyright in: ${file}`);
                    filesModified++;
                }
            } catch (err) {
                console.error(`Error reading ${file}: ${err.message}`);
                errors++;
            }
        }
    }
}

walkDir(targetDir);
console.log(`\n\n=== COPYRIGHT UPDATE COMPLETE ===`);
console.log(`Files updated: ${filesModified}`);
console.log(`Errors encountered: ${errors}`);
