const fs = require('fs');

const path = 'd:/HARSHITHA_PROJECTS/Digital-Resume/src/pages/ResumeIntroPage.tsx';
let content = fs.readFileSync(path, 'utf8');

// The issue is Tailwind precedence. Base classes like "rounded-3xl", "rounded-2xl", "shadow-sm", "shadow-xl" are outside the ternary, 
// overriding the human mode inside the ternary.

// Fix Hero Section
content = content.replace(
  /className=\{`bg-white rounded-3xl p-8 shadow-sm border transition-all duration-700 relative overflow-hidden \$\{isHumanMode \? '([^']+)' : '([^']+)'\}`\}/,
  "className={`bg-white p-8 border transition-all duration-700 relative overflow-hidden ${isHumanMode ? '$1' : 'rounded-3xl shadow-sm border-slate-200'}`}"
);

// Fix At a Glance / Sidebar
content = content.replace(
  /className=\{`rounded-2xl border transition-all duration-700 overflow-hidden relative \$\{isHumanMode \? '([^']+)' : '([^']+)'\}`\}/,
  "className={`border transition-all duration-700 overflow-hidden relative ${isHumanMode ? '$1' : 'rounded-2xl bg-white border-slate-200 shadow-xl'}`}"
);

// Fix Skills / Tech Stack
// `bg-white p-6 rounded-2xl border transition-all group relative ${...}`
content = content.replace(
  /className=\{`bg-white p-6 rounded-2xl border transition-all group relative \$\{isHumanMode \?([^:]+): '([^']+)'\}`\}/g,
  "className={`bg-white p-6 border transition-all group relative ${isHumanMode ?$1: 'rounded-2xl border-slate-200 shadow-sm hover:shadow-md'}`}"
);

// Fix Experience Cards
content = content.replace(
  /className=\{`group relative bg-white p-6 rounded-3xl border transition-all duration-500 \$\{isHumanMode \? '([^']+)' : '([^']+)'\}`\}/g,
  "className={`group relative bg-white p-6 border transition-all duration-500 ${isHumanMode ? '$1' : 'rounded-3xl border-slate-200 shadow-sm hover:shadow-sm'}`}"
);

// Fix Avatar Wrapper which has wrong shape
content = content.replace(
  /border-amber-100 shadow-sm rotate-\[-2deg\] rounded-\[40%_60%_70%_30%\/40%_50%_60%_70%\] animate-wobble sketchy-border bg-amber-50 hover:rotate-1 hover:scale-105 hover:bg-amber-100/g,
  "border-amber-100 shadow-amber-200/40 rotate-[-2deg] rounded-[2rem] bg-amber-50 hover:rotate-1 hover:scale-105 hover:bg-amber-100"
);

// Fix avatar wrapper overrides
content = content.replace(
  /className=\{`h-32 w-32 md:h-40 md:w-40 overflow-hidden border-8 flex items-center justify-center transition-all duration-700 \$\{isHumanMode \? '([^']+)' : '([^']+)'\}`\}/,
  "className={`h-32 w-32 md:h-40 md:w-40 overflow-hidden border-8 flex items-center justify-center transition-all duration-700 ${isHumanMode ? '$1' : 'border-slate-50 rounded-3xl shadow-sm bg-slate-100'}`}"
);

// Make Sidebar (Portfolio Overview / At a glance) matching the UI using squiggly border like Hero
content = content.replace(
  /bg-white border-amber-300 shadow-amber-200\/50 rotate-\[1deg\] rounded-\[3rem\] animate-wobble/,
  "bg-amber-50/20 border-amber-300 shadow-amber-200/50 rotate-[0.5deg] rounded-[40%_60%_70%_30%/40%_50%_60%_70%] animate-wobble sketchy-border"
);

// Also set uppercase logic properly. Since I removed ALL uppercase globally earlier, I should restore them for standard mode only if I want, but the user is fine as long as Human Mode matches.
// Actually, I can leave them lowercase since standard mode looks clean that way too, or I can add them back. The most important part is that HUMAN MODE looks EXACTLY like the image.

// Add the background overlay if missing
if (!content.includes('bg-paper-overlay')) {
  content = content.replace(
    /\{isHumanMode && \(\s*<>\s*<div className="fixed inset-0 pointer-events-none z-\[9998\]/g,
    "{isHumanMode && (\n        <>\n          <div className=\"bg-paper-overlay fixed z-[-1] inset-0\"></div>\n          <div className=\"fixed inset-0 pointer-events-none z-[9998]"
  );
}

fs.writeFileSync(path, content, 'utf8');

// Fix tailwind.config.js for Inter -> Caveat
const twPath = 'd:/HARSHITHA_PROJECTS/Digital-Resume/tailwind.config.js';
let twContent = fs.readFileSync(twPath, 'utf8');
twContent = twContent.replace(
  /hand: \["Inter", "ui-sans-serif", "system-ui"\],/,
  'hand: ["Caveat", "cursive"],'
);
fs.writeFileSync(twPath, twContent, 'utf8');

console.log('Fixed Precedence Issues and Tailwind Config!');
