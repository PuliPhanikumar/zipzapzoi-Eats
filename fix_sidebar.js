const fs = require('fs');

try {
    let s = fs.readFileSync('global_sidebar.js', 'utf8');

    // Look for the improperly escaped anchor tag inside the JS string
    const badStr = '<a href="restaurant aggregator hub.html" class="flex items-center gap-3 px-3 py-2 text-gray-400 hover:bg-white/5 hover:text-white rounded-lg transition-all group"><span class="material-symbols-outlined group-hover:text-primary transition-colors">hub</span> Aggregator Hub <span class="ml-auto bg-green-500/20 text-green-400 py-0.5 px-2 rounded-full text-[9px] font-black uppercase tracking-widest">New</span></a>';

    // Replacement string with proper JSON/JS string escape backslashes
    const fixedStr = '<a href=\\"restaurant aggregator hub.html\\" class=\\"flex items-center gap-3 px-3 py-2 text-gray-400 hover:bg-white/5 hover:text-white rounded-lg transition-all group\\"><span class=\\"material-symbols-outlined group-hover:text-primary transition-colors\\\">hub</span> Aggregator Hub <span class=\\"ml-auto bg-green-500/20 text-green-400 py-0.5 px-2 rounded-full text-[9px] font-black uppercase tracking-widest\\">New</span></a>';

    if (s.includes(badStr)) {
        s = s.replace(badStr, fixedStr);
        fs.writeFileSync('global_sidebar.js', s);
        console.log('Successfully fixed escaping in global_sidebar.js');
    } else {
        console.log('Bad string target not found. Script may not be corrupted in this way.');
    }
} catch (e) {
    console.error('Error during rewrite:', e.message);
}
