const fs = require('fs');
const path = require('path');

const mappings = [
  ['bg-[#0D0B0A]', 'bg-[#F8F1E8]'],
  ['bg-[#0a0603]', 'bg-[#F8F1E8]'],
  ['bg-[#151210]', 'bg-white border border-[#EDE4D5]'],
  ['bg-[#1C1510]', 'bg-white border border-[#EDE4D5]'],
  ['bg-[#15110F]', 'bg-white border border-[#EDE4D5]'],
  ['bg-[#0f0805]', 'bg-[#F8F1E8] border-r border-[#EDE4D5]'],
  ['text-white/60', 'text-[#8E7F71]'],
  ['text-white', 'text-[#2C1810]'],
  ['hover:text-white', 'hover:text-[#2C1810]'],
  ['border-white/10', 'border-[#EDE4D5]'],
  ['border-white/20', 'border-[#EDE4D5]'],
  ['border-white/[0.08]', 'border-[#EDE4D5]'],
  ['border-white/5', 'border-[#EDE4D5]'],
  ['border-[rgba(255,255,255,0.06)]', 'border-[#EDE4D5]'],
  ['text-[#8a6a52]', 'text-[#B89A7D]'],
  ['text-[#E8650A]', 'text-[#C4956A]'],
  ['bg-[#E8650A]', 'bg-[#3B2314]'],
  ['text-[#E28B4B]', 'text-[#C4956A]'],
  ['bg-[#E28B4B]', 'bg-[#3B2314] text-[#E7CFA8]'],
  ['text-[#E7CFA8]', 'text-[#2C1810]'],
  ['text-[#F5DFC0]', 'text-[#2C1810]'],
  ['hover:bg-white/5', 'hover:bg-[#EDE4D5]'],
  ['hover:bg-white/20', 'hover:bg-[#EDE4D5]'],
  ['bg-white/10', 'bg-[#F8F1E8]'],
  ['shadow-black/50', 'shadow-[#C4956A]/10'],
  ['bg-[#120F0D]', 'bg-white'],
  ['bg-black/50', 'bg-[#F8F1E8]/80'],
  ['hover:bg-black/70', 'hover:bg-white'],
  ['text-[#0D0B0A]', 'text-[#E7CFA8]'],
  ['bg-gradient-to-t from-[#0D0B0A] via-[#0D0B0A] to-transparent', 'bg-gradient-to-t from-[#F8F1E8] via-[#F8F1E8] to-transparent'],
  ['bg-[linear-gradient(135deg,rgba(226,139,75,0.14)_0%,rgba(21,17,15,0.95)_45%,rgba(13,11,10,0.96)_100%)]', 'bg-white'],
  ['linear-gradient(180deg, #1A0D04 0%, #120800 100%)', 'linear-gradient(180deg, #F8F1E8 0%, #EDE4D5 100%)']
];

function walk(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    if (fs.statSync(dirPath).isDirectory()) {
      walk(dirPath, callback);
    } else {
      callback(path.join(dir, f));
    }
  });
}

function processFile(f) {
  if (!f.endsWith('.tsx') && !f.endsWith('.ts')) return;
  // Use path.sep to handle windows separators properly
  if (f.includes('app' + path.sep + 'menu' + path.sep + 'page.tsx')) return;

  let content = fs.readFileSync(f, 'utf8');
  let replaced = content;

  // special pre-fixes
  replaced = replaced.split('bg-[#E8650A]').join('bg-[#3B2314]');
  
  for (const [key, val] of mappings) {
    replaced = replaced.split(key).join(val);
  }

  // specific button text fixes
  replaced = replaced.split('bg-[#3B2314] text-[#2C1810]').join('bg-[#3B2314] text-[#E7CFA8]');
  replaced = replaced.split('bg-[#3B2314] text-white').join('bg-[#3B2314] text-[#E7CFA8]');

  if (content !== replaced) {
    fs.writeFileSync(f, replaced);
    console.log('Updated', f);
  }
}

const dirApp = path.join(process.cwd(), 'app');
const dirComponents = path.join(process.cwd(), 'components');

walk(dirApp, processFile);
walk(dirComponents, processFile);
console.log('Done');
