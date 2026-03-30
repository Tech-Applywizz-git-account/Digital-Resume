const fs = require('fs');

const origPath = 'd:/HARSHITHA_PROJECTS/Digital-Resume/src/pages/ResumeIntroPage.tsx';
let content = fs.readFileSync(origPath, 'utf-8');

// 1. Add states for Custom Cursor, Schedule Modal, Chart details etc.
content = content.replace(
  "const [expandedExp, setExpandedExp] = useState<Record<number, boolean>>({});",
  `const [expandedExp, setExpandedExp] = useState<Record<number, boolean>>({});
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [cursorVariant, setCursorVariant] = useState<'default' | 'hover' | 'text'>('default');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [scheduleStep, setScheduleStep] = useState(1);
  const [expandedProjectIndex, setExpandedProjectIndex] = useState<number | null>(null);`
);

// 2. Add Mouse Move Effects
const handleDownloadResumeLine = "const handleDownloadResume = () => {";
content = content.replace(
  handleDownloadResumeLine,
  `useEffect(() => {
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

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus('submitting');
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setFormStatus('success');
      setFormData({ name: '', email: '', subject: '', message: '' });
      setTimeout(() => {
        setIsScheduleModalOpen(false);
        setFormStatus('idle');
        setScheduleStep(1);
        setSelectedDate(null);
        setSelectedTime(null);
      }, 5000);
    } catch (error) {
      setFormStatus('error');
    }
  };

  ` + handleDownloadResumeLine
);

// We need to keep the mapping, so I will update just the classes for isHumanMode to match the user's snippet.

// Update the root wrapper
content = content.replace(
  "className={`min-h-screen transition-all duration-1000 ${isHumanMode ? 'bg-[#fdf9f0] text-stone-800 font-sans bg-paper' : 'bg-[#f6f6f8] text-slate-900 font-sans'} selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden relative`}",
  "className={`min-h-screen transition-all duration-1000 ${isHumanMode ? 'bg-[#fdf9f0] text-stone-800 font-sans bg-paper' : 'bg-[#f6f6f8] text-slate-900 font-sans'} selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden relative`}"
);

// We'll surgically replace the rendering for Hero section, Skills, Experience using string replace matching.
const heroStartStr = "{/* Hero */}\\n            <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className={`bg-white rounded-3xl p-8 shadow-sm border transition-all duration-700 relative overflow-hidden ${isHumanMode ? 'rotate-[-1.5deg] shadow-amber-200/60 border-amber-300 rounded-[40%_60%_70%_30%/40%_50%_60%_70%] animate-wobble sketchy-border' : 'border-slate-200'}`}>";
const heroReplacementStr = "            {/* Hero Section */}\\n            <motion.section \n              initial={{ opacity: 0, y: 20 }}\n              whileInView={{ opacity: 1, y: 0 }}\n              viewport={{ once: true }}\n              className={`bg-white p-8 shadow-sm border transition-all duration-700 relative overflow-hidden ${isHumanMode ? 'rotate-[-1.5deg] shadow-amber-200/60 border-amber-300 rounded-[40%_60%_70%_30%/40%_50%_60%_70%] animate-wobble sketchy-border' : 'border-slate-200 rounded-3xl'}`}";

content = content.replace(
  '{/* Hero */}\n            <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className={`bg-white rounded-3xl p-8 shadow-sm border transition-all duration-700 relative overflow-hidden ${isHumanMode ? \'rotate-[-1.5deg] shadow-amber-200/60 border-amber-300 rounded-[40%_60%_70%_30%/40%_50%_60%_70%] animate-wobble sketchy-border\' : \'border-slate-200\'}`>',
  heroReplacementStr + '\\n            >'
);

// Also need to add Custom Cursor div
content = content.replace(
  "      {dataError && (",
  `      {/* Custom Cursor */}
      <motion.div
        className={\`fixed top-0 left-0 w-8 h-8 rounded-full border-2 pointer-events-none z-[9999] hidden md:block \${isHumanMode ? 'border-amber-600/50' : 'border-blue-600/50'}\`}
        animate={{
          x: mousePos.x - 16,
          y: mousePos.y - 16,
          scale: isMouseDown ? 0.8 : (cursorVariant === 'hover' ? 1.5 : cursorVariant === 'text' ? 0.5 : 1),
          backgroundColor: cursorVariant === 'hover' ? (isHumanMode ? 'rgba(217, 119, 6, 0.1)' : 'rgba(37, 99, 235, 0.1)') : 'transparent',
          borderColor: cursorVariant === 'hover' ? (isHumanMode ? 'rgba(217, 119, 6, 0.8)' : 'rgba(37, 99, 235, 0.8)') : (isHumanMode ? 'rgba(217, 119, 6, 0.4)' : 'rgba(37, 99, 235, 0.4)'),
          borderRadius: isHumanMode ? "40% 60% 70% 30% / 40% 50% 60% 70%" : "50%",
        }}
        transition={{ 
          type: 'spring', 
          damping: 25, 
          stiffness: 250, 
          mass: 0.5,
          borderRadius: { duration: 2, repeat: Infinity, repeatType: "reverse" }
        }}
      />
      <motion.div
        className={\`fixed top-0 left-0 w-1.5 h-1.5 rounded-full pointer-events-none z-[9999] hidden md:block \${isHumanMode ? 'bg-amber-600' : 'bg-blue-600'}\`}
        animate={{
          x: mousePos.x - 3,
          y: mousePos.y - 3,
          scale: cursorVariant === 'hover' ? 0 : (isMouseDown ? 1.5 : 1),
          opacity: isHumanMode ? 0.8 : 1
        }}
        transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.2 }}
      />
      {dataError && (`
);

// I will just download the user's provided file as replacement for the whole file, but preserving the logic blocks from my end. Actually, a better approach is replacing the entire App function with the user's one, but patching the data fetching over.
console.log("Saving initial changes before advanced string replace...");
fs.writeFileSync(origPath, content, 'utf-8');
