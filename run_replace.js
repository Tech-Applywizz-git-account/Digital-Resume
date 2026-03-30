const fs = require('fs');

const origPath = 'd:/HARSHITHA_PROJECTS/Digital-Resume/src/pages/ResumeIntroPage.tsx';
let content = fs.readFileSync(origPath, 'utf-8');

// Define replacements as an array of objects
const replacements = [
  // 1. Root wrapper colors
  {
    target: "className={`min-h-screen transition-all duration-1000 ${isHumanMode ? 'bg-human-bg text-human-text font-sans bg-paper' : 'bg-[#f6f6f8] text-slate-900 font-sans'} selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden relative`}",
    replacement: "className={`min-h-screen transition-all duration-1000 ${isHumanMode ? 'bg-[#fdf9f0] text-stone-800 font-sans bg-paper cursor-none' : 'bg-[#f6f6f8] text-slate-900 font-sans'} selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden relative`}"
  },
  // 2. Overlays
  {
    target: `<div className="fixed inset-0 pointer-events-none z-[9997] bg-human-primary/5 mix-blend-multiply"></div>`,
    replacement: `<div className="bg-paper-overlay"></div>\n          <div className="fixed inset-0 pointer-events-none z-[9997] bg-amber-900/5 mix-blend-multiply"></div>`
  },
  // 3. Hero section styling
  {
    target: "className={`bg-white rounded-3xl p-8 shadow-sm border transition-all duration-700 relative overflow-hidden ${isHumanMode ? 'rotate-[-1.5deg] shadow-amber-200/60 border-amber-300 rounded-[3rem] animate-wobble' : 'border-slate-200'}`}",
    replacement: "className={`bg-white p-8 shadow-sm border transition-all duration-700 relative overflow-hidden ${isHumanMode ? 'rotate-[-1.5deg] shadow-amber-200/60 border-amber-300 rounded-[40%_60%_70%_30%/40%_50%_60%_70%] animate-wobble sketchy-border' : 'border-slate-200 rounded-3xl'}`}"
  },
  // 4. Hero section Scribble positions
  {
    target: `<div className="font-hand text-amber-600 text-2xl -rotate-12 opacity-90 drop-shadow-sm"> Hand-crafted with care! </div>\n                  </motion.div>\n                  <Scribble className="top-1/4 -right-10 w-40 text-amber-600 rotate-12" />\n                  <CircleScribble className="bottom-10 -left-10 w-32 text-amber-400" />\n                </>`,
    replacement: `<div className="absolute inset-0 bg-paper opacity-10 pointer-events-none mix-blend-multiply"></div>\n                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="absolute -top-4 -left-4 z-10 pointer-events-none">\n                    <svg width="120" height="120" viewBox="0 0 100 100" className="text-amber-500 opacity-50">\n                      <path d="M20,20 Q40,10 60,20 T80,40" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />\n                      <circle cx="20" cy="20" r="4" fill="currentColor" />\n                    </svg>\n                  </motion.div>\n                  <Scribble className="top-1/4 -right-10 w-40 text-amber-600 rotate-12" />\n                  <CircleScribble className="bottom-10 -left-10 w-32 text-amber-400" />\n                </>`
  },
  // 5. Header Nav hover buttons
  {
    target: `<button\n                onClick={() => setIsHumanMode(!isHumanMode)}\n                className={\`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-normal uppercase tracking-widest transition-all duration-700 \${isHumanMode ? 'bg-amber-100 text-amber-700 border border-amber-200 font-hand text-lg lowercase tracking-normal' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'}\`}\n                title={isHumanMode ? "Disable Human Mode" : "Enable Human Mode"}\n              >\n                <Sparkles size={12} className={isHumanMode ? 'animate-pulse' : ''} />\n                {isHumanMode ? 'human mode on' : 'Human Mode'}\n              </button>\n              <button onClick={() => setIsContactModalOpen(true)} className={\`hidden sm:block px-6 py-2 rounded-xl text-xs font-normal uppercase tracking-widest transition-all duration-700 shadow-xl \${isHumanMode ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-200/40 font-hand text-2xl lowercase tracking-normal rotate-1 hover:scale-105' : 'bg-[#0e121b] text-white hover:bg-blue-600 shadow-slate-200'}\`}>contact</button>`,
    replacement: `<motion.button \n                whileHover={{ scale: 1.05 }}\n                whileTap={{ scale: 0.95 }}\n                onClick={() => setIsHumanMode(!isHumanMode)}\n                className={\`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-normal uppercase tracking-widest transition-all \${isHumanMode ? 'bg-amber-100 text-amber-700 border border-amber-200 font-hand text-lg lowercase tracking-normal' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'}\`}\n                title={isHumanMode ? "Disable Human Mode" : "Enable Human Mode"}\n              >\n                <Sparkles size={12} className={isHumanMode ? 'animate-pulse' : ''} />\n                {isHumanMode ? 'Human Mode On' : 'Human Mode'}\n              </motion.button>\n              <motion.button \n                whileHover={{ scale: 1.05, rotate: isHumanMode ? -1 : 0 }}\n                whileTap={{ scale: 0.95 }}\n                onClick={() => setIsContactModalOpen(true)}\n                className={\`hidden sm:block px-6 py-2 rounded-xl text-xs font-normal uppercase tracking-widest transition-all shadow-xl \${isHumanMode ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-200/40 font-hand text-2xl lowercase tracking-normal' : 'bg-[#0e121b] text-white hover:bg-blue-600 shadow-slate-200'}\`}\n              >\n                Contact\n              </motion.button>`
  },
  // 6. Avatar square border radius
  {
    target: "className={`h-32 w-32 md:h-40 md:w-40 overflow-hidden border-8 flex items-center justify-center transition-all duration-700 ${isHumanMode ? 'border-amber-100 shadow-human rotate-[-2deg] rounded-human-lg bg-amber-50 hover:rotate-1 hover:scale-105 hover:bg-amber-100' : 'border-slate-50 rounded-3xl shadow-2xl bg-slate-100'}`}",
    replacement: "className={`h-32 w-32 md:h-40 md:w-40 overflow-hidden flex items-center justify-center transition-all duration-700 ${isHumanMode ? 'border-[6px] border-amber-100 shadow-amber-100 rotate-[-2deg] rounded-[40%_60%_70%_30%/40%_50%_60%_70%] bg-amber-50 hover:rotate-1 hover:scale-105 hover:bg-amber-100 animate-wobble sketchy-border' : 'border-8 border-slate-50 rounded-3xl shadow-2xl bg-slate-100'}`}"
  },
  // 7. Add cursor states to hook
  {
    target: "const [expandedExp, setExpandedExp] = useState<Record<number, boolean>>({});",
    replacement: "const [expandedExp, setExpandedExp] = useState<Record<number, boolean>>({});\n  const [isMouseDown, setIsMouseDown] = useState(false);\n  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });\n  const [cursorVariant, setCursorVariant] = useState<'default' | 'hover' | 'text'>('default');"
  },
  // 8. Add mouse move effect hook before handleDownloadResume
  {
    target: "const handleDownloadResume = () => {",
    replacement: `useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('a') || target.closest('[role="button"]')) {
        setCursorVariant('hover');
      } else if (target.closest('input') || target.closest('textarea') || target.closest('p') || target.closest('h1') || target.closest('h2') || target.closest('h3')) {
        setCursorVariant('text');
      } else {
        setCursorVariant('default');
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    const handleMouseDown = () => setIsMouseDown(true);
    const handleMouseUp = () => setIsMouseDown(false);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleDownloadResume = () => {`
  },
  // 9. Add cursor custom elements
  {
    target: "{dataError && (",
    replacement: `{isHumanMode && (
        <>
          <motion.div
            className="fixed top-0 left-0 w-8 h-8 rounded-full border-2 border-amber-600/50 pointer-events-none z-[9999] hidden md:block"
            animate={{
              x: mousePos.x - 16,
              y: mousePos.y - 16,
              scale: isMouseDown ? 0.8 : (cursorVariant === 'hover' ? 1.5 : cursorVariant === 'text' ? 0.5 : 1),
              backgroundColor: cursorVariant === 'hover' ? 'rgba(217, 119, 6, 0.1)' : 'transparent',
              borderColor: cursorVariant === 'hover' ? 'rgba(217, 119, 6, 0.8)' : 'rgba(217, 119, 6, 0.4)',
              borderRadius: "40% 60% 70% 30% / 40% 50% 60% 70%",
            }}
            transition={{ type: 'spring', damping: 25, stiffness: 250, mass: 0.5 }}
          />
          <motion.div
            className="fixed top-0 left-0 w-1.5 h-1.5 bg-amber-600 rounded-full pointer-events-none z-[9999] hidden md:block"
            animate={{
              x: mousePos.x - 3,
              y: mousePos.y - 3,
              scale: cursorVariant === 'hover' ? 0 : (isMouseDown ? 1.5 : 1),
              opacity: 0.8
            }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.2 }}
          />
        </>
      )}

      {dataError && (`
  }
];

let modified = false;
replacements.forEach(r => {
  if (content.includes(r.target)) {
    content = content.replace(r.target, r.replacement);
    modified = true;
  } else {
    console.warn("Target not found:\\n", r.target.substring(0, 100), "...");
  }
});

// Extra fix to ensure human colors are perfectly matched
content = content.replace(/text-human-text/g, 'text-stone-800');
content = content.replace(/bg-human-bg/g, 'bg-[#fdf9f0]');
content = content.replace(/text-human-primary/g, 'text-amber-600');
content = content.replace(/bg-human-primary/g, 'bg-amber-600');
content = content.replace(/border-human-primary\\/20 / g, 'border-amber-600/20');
content = content.replace(/border-human-primary/g, 'border-amber-600');
content = content.replace(/shadow-human/g, 'shadow-amber-200/60');
content = content.replace(/text-human-secondary/g, 'text-amber-500');

// Fix contact and download buttons in sidebar
content = content.replace(
  `<button onClick={() => { setIsContactModalOpen(true); setIsSidebarOpen(false); }} className={\`flex items-center gap-3 w-full p-4 rounded-2xl shadow-lg transition-all \${isHumanMode ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-200' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200'}\`}>`,
  `<motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { setIsContactModalOpen(true); setIsSidebarOpen(false); }} className={\`flex items-center gap-3 w-full p-4 rounded-2xl shadow-lg transition-all \${isHumanMode ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-200 font-hand text-2xl lowercase' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200'}\`}>`
);

if (modified) {
  fs.writeFileSync(origPath, content, 'utf-8');
  console.log("Replaced successfully!");
} else {
  console.log("No replacements were made.");
}
