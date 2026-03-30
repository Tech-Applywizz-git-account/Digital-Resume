const fs = require('fs');

const origPath = 'd:/HARSHITHA_PROJECTS/Digital-Resume/src/pages/ResumeIntroPage.tsx';
let content = fs.readFileSync(origPath, 'utf-8');

// Ensure root has font-sans for non-human mode
content = content.replace(
  "className={`min-h-screen transition-all duration-1000 ${isHumanMode ? 'bg-[#fdf9f0] text-stone-800 bg-paper cursor-none' : 'bg-[#f6f6f8] text-slate-900'} selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden relative`}",
  "className={`min-h-screen transition-all duration-1000 ${isHumanMode ? 'bg-[#fdf9f0] text-stone-800 bg-paper cursor-none' : 'bg-[#f6f6f8] text-slate-900 font-sans'} selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden relative`}"
);

// If the replaced string matched completely earlier, including font-sans removal, I want to add font-sans to default.
// Let's do a more robust replace for the root:
content = content.replace(/bg-\[#f6f6f8\] text-slate-900([^']*?)/, 'bg-[#f6f6f8] text-slate-900 font-sans');

// Check if uppercase/lowercase replacement caused `lowercasecase`.
content = content.replace(/lowercasecase/g, 'lowercase');

// Make sure that buttons that didn't have lowercase have lowercase now, as per user's diff.
// The user changed things directly. I can just write it to the file.
fs.writeFileSync(origPath, content, 'utf-8');
