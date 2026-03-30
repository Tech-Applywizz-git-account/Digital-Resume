const fs = require('fs');
const path = require('path');

const targetPath = 'd:/HARSHITHA_PROJECTS/Digital-Resume/src/pages/ResumeIntroPage.tsx';
let content = fs.readFileSync(targetPath, 'utf8');

// The goal is to aggressively clean up the human mode styling.

// 1. Shadow cleanup
content = content.replace(/shadow-human/g, 'shadow-sm');
// Note: we'll handle shadow-xl and shadow-2xl cautiously, 
// replacing them with shadow-sm only inside human mode strings if possible, 
// or just globally replace if the user meant globally. 
// "Remove ALL heavy shadows: shadow-xl shadow-2xl shadow-human Use ONLY: shadow-sm"
// I will replace inside the human mode ternaries where possible:
content = content.replace(/isHumanMode \? '([^']*)shadow-xl([^']*)'/g, "isHumanMode ? '$1shadow-sm$2'");
content = content.replace(/isHumanMode \? '([^']*)shadow-2xl([^']*)'/g, "isHumanMode ? '$1shadow-sm$2'");
content = content.replace(/shadow-xl/g, 'shadow-sm'); // The user asked to remove ALL heavy shadows.
content = content.replace(/shadow-2xl/g, 'shadow-sm');

// 2. Border radius simplification
content = content.replace(/rounded-\[3rem\]/g, 'rounded-[2rem]');
content = content.replace(/rounded-human-lg/g, 'rounded-[2rem]');
content = content.replace(/rounded-human/g, 'rounded-xl');

// 3. FONT USAGE - remove font-sans inside human mode
content = content.replace(/isHumanMode \? '([^']*)font-sans([^']*)'/g, "isHumanMode ? '$1$2'");

// 4. HERO SECTION FIX
// Name to text-7xl lowercase tracking-tight
content = content.replace(/text-human-text font-hand text-8xl lowercase tracking-normal/g, 'text-stone-800 font-hand text-7xl lowercase tracking-tight');
// Title to text-3xl
content = content.replace(/text-amber-700 font-hand text-4xl lowercase tracking-normal/g, 'text-amber-700 font-hand text-3xl lowercase');

// 5. BUTTON FIX
// Buttons currently have "text-xs font-normal uppercase tracking-widest" outside and "font-hand text-3xl lowercase tracking-normal" inside.
// User said: "Replace ALL button styles: Remove: text-xs uppercase tracking-widest Use: font-hand text-lg lowercase tracking-normal Keep slight rotation"
content = content.replace(/text-xs font-normal uppercase tracking-widest/g, 'text-xs font-normal');
content = content.replace(/text-xs font-normal lowercase tracking-widest/g, 'text-xs font-normal');
content = content.replace(/text-xs font-medium uppercase tracking-widest/g, 'text-xs font-medium');
content = content.replace(/text-xs font-medium lowercase tracking-widest/g, 'text-xs font-medium');
content = content.replace(/text-\[10px\] font-normal uppercase tracking-widest/g, 'text-[10px] font-normal');
content = content.replace(/text-\[10px\] font-normal lowercasecase tracking-widest/g, 'text-[10px] font-normal');
content = content.replace(/text-\[10px\] font-black uppercase tracking-widest/g, 'text-[10px] font-black');
content = content.replace(/text-\[10px\] font-black lowercasecase tracking-widest/g, 'text-[10px] font-black');

// For human mode inside button ternaries: replace text-2xl, text-3xl, text-4xl with text-lg where it's a button.
// Contact button:
content = content.replace(/font-hand text-2xl lowercase tracking-normal/g, 'font-hand text-lg lowercase tracking-normal');
content = content.replace(/font-hand text-3xl lowercase tracking-normal/g, 'font-hand text-lg lowercase tracking-normal');
content = content.replace(/font-hand text-4xl/g, 'font-hand text-3xl'); // sections

// 6. SKILLS / TAGS FIX
// Skills tags previously: 
content = content.replace(/text-\[11px\] font-normal rounded-lg border transition-all cursor-default/g, 'px-3 py-1.5 rounded-lg border transition-all cursor-default');
// Replace skill tag ternary human mode part:
content = content.replace(/bg-amber-50\/30 text-stone-600 border-amber-200 hover:border-amber-500 hover:bg-amber-100 font-hand text-sm lowercase tracking-normal (\$\{sIdx % 2 === 0 \? 'rotate-\[1deg\]' : '-rotate-\[1deg\]'\})/g,
    "bg-paper text-stone-800 border-amber-300 shadow-sm font-hand text-sm lowercase tracking-normal ${sIdx % 2 === 0 ? 'rotate-[1deg]' : '-rotate-[1deg]'}"
);
// It was inside a string literal, we can do a regex:
content = content.replace(/bg-amber-50\/30([^\`]*?)font-hand text-sm lowercase tracking-normal \$\{sIdx/g, "bg-paper text-stone-800 border-amber-300 shadow-sm font-hand text-sm lowercase tracking-normal ${sIdx");

// Fix general occurrences of oversized font-hand
content = content.replace(/font-hand text-5xl/g, 'font-hand text-3xl');

// Section headings -> text-3xl
// Career Trajectory heading:
content = content.replace(/text-stone-800 font-hand text-[2-5]xl lowercase tracking-normal/g, 'text-stone-800 font-hand text-3xl lowercase tracking-normal');
content = content.replace(/text-stone-800 font-hand text-3xl/g, 'text-stone-800 font-hand text-3xl lowercase tracking-normal');

// 7. EXPERIENCE SECTION FIX
// Replace description body text:
content = content.replace(/text-human-text font-hand text-2xl lowercase tracking-normal/g, 'text-stone-800 font-hand text-lg lowercase leading-relaxed');

// Remove uppercase tags inside experience:
content = content.replace(/text-sm font-normal uppercase tracking-widest/g, 'text-sm font-normal');
content = content.replace(/text-\[10px\] uppercase tracking-widest/g, 'text-[10px]');
content = content.replace(/text-\[8px\] font-normal uppercase tracking-wider/g, 'text-xs font-normal');
content = content.replace(/uppercase tracking-widest/g, '');

// Also fix any remaining "text-4xl" for job.role to "text-xl" or "text-lg"
content = content.replace(/text-human-text font-hand text-4xl lowercase tracking-normal/g, 'text-stone-800 font-hand text-2xl lowercase tracking-normal');
content = content.replace(/text-human-primary\/80 font-hand text-2xl lowercase tracking-normal/g, 'text-amber-700 font-hand text-lg lowercase tracking-normal');

// Time duration text
content = content.replace(/text-human-primary -rotate-2 font-hand text-3xl lowercase tracking-normal/g, 'text-amber-700 font-hand text-lg -rotate-1 lowercase tracking-normal');

// View more
content = content.replace(/text-amber-600 font-hand text-2xl lowercase tracking-normal/g, 'text-amber-600 font-hand text-lg lowercase tracking-normal');

// Education/Experience in hero
content = content.replace(/text-stone-800 font-hand text-lg/g, 'text-stone-800 font-hand text-lg lowercase tracking-normal');
content = content.replace(/text-amber-600 font-hand text-lg/g, 'text-amber-600 font-hand text-lg lowercase tracking-normal');

// Write back
fs.writeFileSync(targetPath, content, 'utf8');
console.log('Typography tweaks applied');
