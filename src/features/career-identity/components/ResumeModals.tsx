import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Download, History, MessageSquare, Mail,
    Phone, ArrowUpRight, Calendar, BadgeCheck, AlertCircle
} from 'lucide-react';

interface ResumeModalsProps {
    isHireMeModalOpen: boolean;
    setIsHireMeModalOpen: (open: boolean) => void;
    isContactModalOpen: boolean;
    setIsContactModalOpen: (open: boolean) => void;
    isScheduleModalOpen: boolean;
    setIsScheduleModalOpen: (open: boolean) => void;
    displayName: string;
    displayTitle: string;
    displayEmail: string;
    candidatePhone: string | null;
    isHumanMode: boolean;
    handleDownloadResume: () => void;
    handleEmailCandidate: () => void;
    handleWhatsAppCandidate: () => void;
    handleScheduleSubmit: (e: React.FormEvent) => Promise<void>;
    formData: any;
    setFormData: (data: any) => void;
    scheduleStep: 1 | 2 | 3;
    setScheduleStep: (step: 1 | 2 | 3) => void;
    formStatus: 'idle' | 'submitting' | 'success' | 'error';
    statusMessage?: { type: 'error' | 'success', text: string } | null;
    isAvatarModalOpen: boolean;
    setIsAvatarModalOpen: (open: boolean) => void;
    onAvatarSelect: (path: string) => void;
    initialGender?: 'boy' | 'girl';
}

const Scribble = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 12C3 12 5.5 18 12 18C18.5 18 21 12 21 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 3C8 3 5 6 5 10C5 14 8 17 12 17C16 17 19 14 19 10C19 6 16 3 12 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export const ResumeModals: React.FC<ResumeModalsProps> = ({
    isHireMeModalOpen, setIsHireMeModalOpen,
    isContactModalOpen, setIsContactModalOpen,
    isScheduleModalOpen, setIsScheduleModalOpen,
    displayName, displayTitle, displayEmail, candidatePhone,
    isHumanMode, handleDownloadResume, handleEmailCandidate, handleWhatsAppCandidate,
    handleScheduleSubmit, formData, setFormData, scheduleStep, setScheduleStep,
    formStatus, statusMessage, isAvatarModalOpen, setIsAvatarModalOpen,
    onAvatarSelect, initialGender = 'boy'
}) => {
    const [avatarGender, setAvatarGender] = React.useState<'boy' | 'girl'>(initialGender);

    React.useEffect(() => {
        if (initialGender) setAvatarGender(initialGender);
    }, [initialGender]);

    React.useEffect(() => {
        const allAvatarPaths = [
            ...Array.from({ length: 16 }, (_, i) => `/Avatar_profile/${i + 1}.jpg`)
        ];
        allAvatarPaths.forEach(path => {
            const img = new Image();
            img.src = path;
        });
    }, []);

    const avatars = avatarGender === 'boy'
        ? [1, 2, 3, 4, 5, 6, 7, 8].map(n => `/Avatar_profile/${n}.jpg`)
        : [9, 10, 11, 12, 13, 14, 15, 16].map(n => `/Avatar_profile/${n}.jpg`);

    return (
        <>
            {/* Hire Me Modal */}
            <AnimatePresence>
                {isHireMeModalOpen && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsHireMeModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className={`relative w-full max-w-lg overflow-hidden transition-all duration-700 ${isHumanMode ? 'bg-[#fdfcf8] rounded-[3rem] border-2 border-orange-200' : 'bg-white rounded-3xl shadow-2xl'}`}>
                            <div className={`p-6 text-white flex justify-between items-center transition-all duration-700 ${isHumanMode ? 'bg-orange-600' : 'bg-[#0e121b]'}`}>
                                <div>
                                    <h3 className={`text-xl font-normal transition-all duration-700 ${isHumanMode ? 'font-hand text-2xl' : ''}`}>{displayName}</h3>
                                    <p className={`text-sm opacity-70 transition-all duration-700 ${isHumanMode ? 'font-hand text-lg' : ''}`}>{displayTitle}</p>
                                </div>
                                <button onClick={() => setIsHireMeModalOpen(false)} className="p-2 hover:bg-white/20 rounded-full text-white"><X size={20} /></button>
                            </div>
                            <div className="p-8 space-y-4">
                                <p className={`text-sm text-slate-500 transition-all duration-700 ${isHumanMode ? 'font-hand text-xl text-stone-600' : ''}`}>Download the full resume directly or contact to request more details.</p>
                                <div className="space-y-3">
                                    <button onClick={handleDownloadResume} className={`w-full py-4 rounded-2xl font-normal text-sm flex items-center justify-center gap-2 transition-all shadow-lg duration-700 ${isHumanMode ? 'bg-orange-600 text-white hover:bg-orange-700 shadow-orange-100/50 font-hand text-xl tracking-normal' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'}`}>
                                        <Download size={18} />Download Resume
                                    </button>
                                    <button onClick={() => { setIsHireMeModalOpen(false); setIsScheduleModalOpen(true); }} className={`w-full py-4 rounded-2xl font-normal text-sm flex items-center justify-center gap-2 transition-all border-2 duration-700 ${isHumanMode ? 'border-orange-200 text-orange-600 bg-white hover:bg-orange-50 font-hand text-xl tracking-normal' : 'border-slate-100 text-[#0e121b] hover:bg-slate-50'}`}>
                                        <History size={18} />Schedule a Call
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Contact Modal */}
            <AnimatePresence>
                {isContactModalOpen && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsContactModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className={`relative w-full max-w-lg overflow-hidden transition-all duration-700 ${isHumanMode ? 'bg-[#fdfcf8] rounded-[3rem] border-2 border-orange-200 shadow-xl' : 'bg-white rounded-3xl shadow-2xl'}`}>
                            <div className={`p-6 flex justify-between items-center transition-all duration-700 ${isHumanMode ? 'bg-orange-600 text-white' : 'bg-blue-600 text-white'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl bg-white/20 transition-all duration-700`}><MessageSquare size={24} /></div>
                                    <div>
                                        <h3 className={`text-xl font-normal transition-all duration-700 ${isHumanMode ? 'font-hand text-2xl tracking-normal' : ''}`}>Contact {displayName}</h3>
                                        <p className={`text-[10px] font-normal uppercase tracking-widest opacity-70 transition-all duration-700 ${isHumanMode ? 'font-hand text-base' : ''}`}>Choose Communication Method</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsContactModalOpen(false)} className={`rounded-full p-2 hover:bg-white/10 transition-colors text-white`}><X size={20} /></button>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="space-y-4">
                                    <div className={`p-4 rounded-2xl border flex items-center justify-between group transition-all duration-700 ${isHumanMode ? 'bg-orange-50 border-orange-100 hover:border-orange-300' : 'bg-slate-50 border-slate-100 hover:border-blue-200'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-xl transition-all duration-700 ${isHumanMode ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 text-blue-600'}`}><Mail size={18} /></div>
                                            <div>
                                                <p className={`text-[10px] font-normal uppercase tracking-widest mb-0.5 transition-all duration-700 ${isHumanMode ? 'text-orange-700/60 font-hand text-base' : 'text-slate-400'}`}>Email Address</p>
                                                <p className={`text-sm font-normal transition-all duration-700 ${isHumanMode ? 'text-stone-800 font-hand text-lg' : 'text-[#0e121b]'}`}>{displayEmail}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {candidatePhone && (
                                        <div className={`p-4 rounded-2xl border flex items-center justify-between group transition-all duration-700 ${isHumanMode ? 'bg-orange-50 border-orange-100 hover:border-orange-300' : 'bg-slate-50 border-slate-100 hover:border-blue-200'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2.5 rounded-xl transition-all duration-700 ${isHumanMode ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 text-blue-600'}`}><Phone size={18} /></div>
                                                <div>
                                                    <p className={`text-[10px] font-normal uppercase tracking-widest mb-0.5 transition-all duration-700 ${isHumanMode ? 'text-orange-700/60 font-hand text-base' : 'text-slate-400'}`}>Mobile Number</p>
                                                    <p className={`text-sm font-normal transition-all duration-700 ${isHumanMode ? 'text-stone-800 font-hand text-lg' : 'text-[#0e121b]'}`}>+{candidatePhone}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className={`space-y-4 p-6 rounded-[2rem] border transition-all duration-700 ${isHumanMode ? 'bg-orange-50/30 border-orange-100' : 'bg-slate-50/50 border-slate-100'}`}>
                                    <button onClick={handleEmailCandidate} className={`w-full py-4 rounded-2xl font-normal transition-all flex items-center justify-center gap-2 shadow-sm relative overflow-hidden group duration-700 ${isHumanMode ? 'bg-orange-600 text-white hover:bg-orange-700 font-hand text-xl tracking-normal' : 'bg-blue-600 text-white hover:bg-blue-700 text-xs uppercase tracking-widest'}`}>
                                        <Mail size={18} className="transition-transform group-hover:scale-110" />
                                        <span>Email Candidate</span>
                                        <ArrowUpRight size={14} className="absolute right-4 opacity-40" />
                                    </button>

                                    {candidatePhone && (
                                        <button onClick={handleWhatsAppCandidate} className={`w-full py-4 rounded-2xl font-normal transition-all flex items-center justify-center gap-2 border-[1.5px] relative group duration-700 ${isHumanMode ? 'bg-white border-orange-600 text-orange-600 hover:bg-orange-50 font-hand text-xl tracking-normal' : 'bg-white border-blue-500 text-blue-600 hover:bg-blue-50 text-xs uppercase tracking-widest'}`}>
                                            <MessageSquare size={18} className="transition-transform group-hover:scale-110" />
                                            <span>WhatsApp Candidate</span>
                                            <ArrowUpRight size={14} className="absolute right-4 opacity-40" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Avatar Selection Modal - Ported directly from reference */}
            <AnimatePresence>
                {isAvatarModalOpen && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsAvatarModalOpen(false)}
                            className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className={`relative w-full max-w-2xl overflow-hidden transition-all duration-700 ${isHumanMode ? 'bg-[#fdfcf8] rounded-[3rem] border-2 border-orange-200 shadow-2xl shadow-orange-100/50' : 'bg-white rounded-[2.5rem] shadow-2xl'}`}
                        >
                            {/* Header */}
                            <div className={`p-8 flex justify-between items-center transition-all duration-700 ${isHumanMode ? 'bg-orange-600 text-white' : 'bg-[#0e121b] text-white'}`}>
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                                        <Scribble className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className={`text-2xl font-normal transition-all duration-700 ${isHumanMode ? 'font-hand text-3xl tracking-normal' : ''}`}>Choose Your Avatar</h3>
                                        <p className={`text-xs opacity-70 transition-all duration-700 ${isHumanMode ? 'font-hand text-base tracking-normal' : 'uppercase tracking-widest'}`}>Pick one to represent your profile</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsAvatarModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
                            </div>

                            {/* Selector Content */}
                            <div className="p-8 space-y-8">
                                {/* Gender Toggle */}
                                <div className="flex justify-center">
                                    <div className="flex p-1.5 bg-slate-100 rounded-2xl gap-1">
                                        <button
                                            onClick={() => setAvatarGender('boy')}
                                            className={`px-8 py-2.5 rounded-xl text-sm font-black transition-all ${avatarGender === 'boy' ? 'bg-white text-blue-600 shadow-sm scale-105' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            BOYS
                                        </button>
                                        <button
                                            onClick={() => setAvatarGender('girl')}
                                            className={`px-8 py-2.5 rounded-xl text-sm font-black transition-all ${avatarGender === 'girl' ? 'bg-white text-pink-600 shadow-sm scale-105' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            GIRLS
                                        </button>
                                    </div>
                                </div>

                                {/* Avatar Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                                    {avatars.map((path, idx) => (
                                        <motion.button
                                            key={path}
                                            whileHover={{ scale: 1.05, y: -5 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => onAvatarSelect(path)}
                                            className={`group relative aspect-square rounded-[2rem] overflow-hidden border-4 transition-all bg-slate-100 ${isHumanMode ? 'border-orange-50 hover:border-orange-500' : 'border-slate-50 hover:border-blue-500'}`}
                                        >
                                            {/* Shimmer Placeholder */}
                                            <div className="absolute inset-0 bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 animate-shimmer" style={{ backgroundSize: '1000px 100%' }}></div>

                                            <img
                                                src={path}
                                                alt={`Avatar ${idx + 1}`}
                                                className="w-full h-full object-cover relative z-10"
                                                loading="eager"
                                                decoding="async"
                                                onLoad={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    if (target.previousElementSibling) {
                                                        (target.previousElementSibling as HTMLElement).style.display = 'none';
                                                    }
                                                }}
                                            />
                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold uppercase">
                                                Select
                                            </div>
                                        </motion.button>
                                    ))}
                                </div>

                                <p className={`text-center text-sm text-slate-400 transition-all duration-700 ${isHumanMode ? 'font-hand text-base' : ''}`}>
                                    You can change your avatar anytime by clicking on it in the header.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
};