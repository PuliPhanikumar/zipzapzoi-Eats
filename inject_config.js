/**
 * ZipZapZoi Eats — Inject zoi_config.js into ALL HTML pages
 * that include db_simulation.js or other engine files but are missing zoi_config.js.
 * 
 * Run: node inject_config.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname);
let injected = 0;
let skipped = 0;
let alreadyHas = 0;

// Find all HTML files
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

console.log(`\n🔧 ZipZapZoi Config Injector\n`);
console.log(`Found ${files.length} HTML files\n`);

files.forEach(file => {
    const filePath = path.join(ROOT, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Skip if already has zoi_config.js
    if (content.includes('zoi_config.js')) {
        alreadyHas++;
        return;
    }

    // Check if it uses any of the engine files or has fetch/ZOI_CONFIG references
    const needsConfig = 
        content.includes('db_simulation.js') ||
        content.includes('zoi_customer_engine.js') ||
        content.includes('zoi_partner_engine.js') ||
        content.includes('zoi_theme.js') ||
        content.includes('zoi_location.js') ||
        content.includes('ZOI_CONFIG') ||
        content.includes('ZoiToken') ||
        content.includes('zoiApi(') ||
        content.includes('zoiApiSilent(');

    if (!needsConfig) {
        skipped++;
        return;
    }

    // Inject zoi_config.js BEFORE db_simulation.js or first engine script
    const patterns = [
        /(<script\s+src=["'](?:\.\/)?js\/db_simulation\.js["'])/,
        /(<script\s+src=["'](?:\.\/)?js\/zoi_theme\.js["'])/,
        /(<script\s+src=["'](?:\.\/)?js\/zoi_customer_engine\.js["'])/,
        /(<script\s+src=["'](?:\.\/)?js\/zoi_partner_engine\.js["'])/,
        /(<script\s+src=["'](?:\.\/)?js\/zoi_location\.js["'])/,
    ];

    let replaced = false;
    for (const pattern of patterns) {
        if (pattern.test(content)) {
            content = content.replace(pattern, '<script src="js/zoi_config.js"></script>\n    $1');
            replaced = true;
            break;
        }
    }

    // Fallback: inject before </head> or </body>
    if (!replaced) {
        if (content.includes('</head>')) {
            content = content.replace('</head>', '    <script src="js/zoi_config.js"></script>\n</head>');
            replaced = true;
        } else if (content.includes('</body>')) {
            content = content.replace('</body>', '    <script src="js/zoi_config.js"></script>\n</body>');
            replaced = true;
        }
    }

    if (replaced) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  ✅ ${file}`);
        injected++;
    }
});

console.log(`\n📊 Results:`);
console.log(`  Already had config: ${alreadyHas}`);
console.log(`  Newly injected:     ${injected}`);
console.log(`  Skipped (no need):  ${skipped}`);
console.log(`  Total HTML files:   ${files.length}\n`);
