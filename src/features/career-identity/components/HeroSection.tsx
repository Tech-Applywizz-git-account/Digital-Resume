import React from 'react';
import { motion } from 'framer-motion';
import { Play, Mail, Camera } from 'lucide-react';
import { Shimmer } from './CommonElements';

interface HeroSectionProps {
    dataLoading: boolean;
    parsed: any;
    isHumanMode: boolean;
    displayName: string;
    displayTitle: string;
    displayEducation: string;
    displayYears: string;
    displayKeyMetric: string;
    displayOpenToRelocate: boolean;
    videoUrl: string | null;
    selectedAvatar: string | null;
    onAvatarClick: () => void;
    canChangeAvatar: boolean;
    setIsIntroVideoOpen: (open: boolean) => void;
    setIsContactModalOpen: (open: boolean) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
    dataLoading,
    parsed,
    isHumanMode,
    displayName,
    displayTitle,
    displayEducation,
    displayYears,
    displayKeyMetric,
    displayOpenToRelocate,
    videoUrl,
    selectedAvatar,
    onAvatarClick,
    canChangeAvatar,
    setIsIntroVideoOpen,
    setIsContactModalOpen
}) => {
    if (dataLoading && !parsed) {
        return (
            <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-2xl shadow-slate-100 border border-slate-50 relative overflow-hidden">
                <div className="flex flex-col md:flex-row gap-10 items-center md:items-start text-center md:text-left">
                    <Shimmer className="h-40 w-40 md:h-44 md:w-44 rounded-[2.5rem]" />
                    <div className="flex-1 space-y-6 w-full">
                        <div className="space-y-3">
                            <Shimmer className="h-10 w-2/3 mx-auto md:mx-0" />
                            <Shimmer className="h-6 w-1/3 mx-auto md:mx-0" />
                        </div>
                        <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-50">
                            <div className="space-y-2"><Shimmer className="h-3 w-12" /><Shimmer className="h-4 w-full" /></div>
                            <div className="space-y-2"><Shimmer className="h-3 w-12" /><Shimmer className="h-4 w-full" /></div>
                            <div className="space-y-2"><Shimmer className="h-3 w-12" /><Shimmer className="h-4 w-full" /></div>
                        </div>
                        <div className="flex gap-4 pt-2">
                            <Shimmer className="h-12 w-40 rounded-2xl" />
                            <Shimmer className="h-12 w-32 rounded-2xl" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className={`bg-white rounded-[2.5rem] p-6 md:p-8 shadow-2xl shadow-slate-100 border border-slate-50 transition-all duration-700 relative overflow-hidden group hover:-translate-y-1 ${isHumanMode ? 'rotate-[-1deg] shadow-amber-100 border-amber-200 !rounded-[4rem]' : ''}`}
        >
            <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className={`relative shrink-0 mx-auto md:mx-0 ${canChangeAvatar ? 'cursor-pointer group/avatar' : ''}`} onClick={canChangeAvatar ? onAvatarClick : undefined}>
                    <div className={`h-32 w-32 md:h-36 md:w-36 overflow-hidden shadow-xl transition-all duration-700 ${isHumanMode ? 'rounded-[1.5rem] rotate-[-2deg]' : 'rounded-[2rem]'} ${!selectedAvatar && canChangeAvatar ? 'ring-4 ring-blue-500/20 animate-pulse' : ''}`}>
                        {selectedAvatar ? (
                            <img
                                src={selectedAvatar}
                                alt={displayName}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover/avatar:scale-110"
                            />
                        ) : (
                            <div className={`w-full h-full flex items-center justify-center bg-slate-100 text-5xl md:text-7xl font-black font-sans uppercase transition-all duration-700 ${isHumanMode ? 'text-orange-600 font-hand' : 'text-blue-500'}`}>
                                {displayName ? displayName.charAt(0) : '?'}
                            </div>
                        )}
                    </div>

                    {!selectedAvatar && canChangeAvatar && (
                        <motion.div
                            initial={{ scale: 0, x: 20 }}
                            animate={{ scale: 1, x: 0 }}
                            className="absolute -top-3 -right-3 flex items-center"
                        >
                            <motion.div
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`mr-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg ${isHumanMode ? 'bg-orange-600 text-white' : 'bg-blue-600 text-white'}`}
                            >
                                Pick Avatar
                            </motion.div>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white transition-all duration-700 ${isHumanMode ? 'bg-orange-600 text-white' : 'bg-blue-600 text-white'}`}>
                                <div className="absolute inset-0 rounded-full bg-inherit animate-ping opacity-20"></div>
                                <Camera size={14} className="relative z-10" />
                            </div>
                        </motion.div>
                    )}

                    {canChangeAvatar && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold uppercase tracking-widest text-center px-4 rounded-inherit">
                            Change Avatar
                        </div>
                    )}
                </div>

                <div className="flex-1 space-y-4">
                    <div className="space-y-1 text-center md:text-left">
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                            <h1 className={`text-3xl md:text-4xl font-black tracking-tight transition-colors duration-700 ${isHumanMode ? 'font-hand text-2xl text-stone-800' : 'text-[#0e121b]'}`}>
                                {displayName}
                            </h1>
                            <div className="flex gap-2">
                                <span className={`px-3 py-1 text-white text-[10px] font-bold uppercase tracking-widest rounded-full shadow-md transition-all duration-700 ${isHumanMode ? 'bg-orange-600 shadow-orange-100 font-hand text-base tracking-normal' : 'bg-blue-600 shadow-blue-100'}`}>
                                    verified
                                </span>
                                {displayOpenToRelocate && (
                                    <span className={`px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all duration-700 shadow-sm ${isHumanMode ? 'font-hand text-base tracking-normal bg-orange-50/50 text-orange-700' : ''}`}>
                                        open to relocate
                                    </span>
                                )}
                            </div>
                        </div>
                        <p className={`text-lg font-bold transition-all duration-700 ${isHumanMode ? 'font-hand text-lg text-amber-700 tracking-normal' : 'text-blue-600'}`}>
                            {displayTitle || 'Professional Role'}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-[max-content_max-content_1fr] gap-x-4 lg:gap-x-6 gap-y-4 py-4 border-y border-slate-50 items-start">
                        <div className="text-left space-y-0.5">
                            <p className={`text-[9px] font-bold text-slate-400 uppercase tracking-widest transition-all duration-700 ${isHumanMode ? 'font-hand text-lg tracking-normal' : ''}`}>Education</p>
                            <p className={`text-xs font-bold text-[#0e121b] truncate transition-all duration-700 ${isHumanMode ? 'font-hand text-xl tracking-normal text-stone-800' : ''}`}>{displayEducation || 'MS (CS)'}</p>
                        </div>
                        <div className="text-left space-y-0.5 border-t sm:border-t-0 sm:border-l border-slate-100 sm:pl-4 lg:pl-6">
                            <p className={`text-[9px] font-bold text-slate-400 uppercase tracking-widest transition-all duration-700 ${isHumanMode ? 'font-hand text-lg tracking-normal' : ''}`}>Experience</p>
                            <p className={`text-xs font-bold text-[#0e121b] whitespace-nowrap transition-all duration-700 ${isHumanMode ? 'font-hand text-xl tracking-normal text-stone-800' : ''}`}>{displayYears || '5 Years'}</p>
                        </div>
                        <div className="text-left space-y-0.5 col-span-2 sm:col-span-1 border-t sm:border-t-0 sm:border-l border-slate-100 sm:pl-4 lg:pl-6 min-w-0">
                            <p className={`text-[9px] font-bold text-slate-400 uppercase tracking-widest transition-all duration-700 ${isHumanMode ? 'font-hand text-lg tracking-normal' : ''}`}>Key Metric</p>
                            <p className={`text-xs font-bold whitespace-nowrap transition-all duration-700 ${isHumanMode ? 'text-orange-600 font-hand text-3xl tracking-normal' : 'text-blue-600'}`}>
                                {displayKeyMetric || '70% Boost'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-center md:justify-start gap-3 pt-1">
                        {videoUrl && (
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setIsIntroVideoOpen(true)}
                                className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl transition-all duration-700 shadow-xl ${isHumanMode ? 'bg-orange-600 text-white font-hand text-xl tracking-normal hover:bg-orange-700 shadow-orange-100/50' : 'bg-[#0e121b] text-white font-bold text-[10px] uppercase tracking-widest shadow-slate-200 hover:bg-slate-800'}`}
                            >
                                <Play size={16} fill="currentColor" className="text-white" /> WATCH INTRO
                            </motion.button>
                        )}
                        <button
                            onClick={() => setIsContactModalOpen(true)}
                            className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl border transition-all duration-700 shadow-sm ${isHumanMode ? 'bg-white border-orange-200 text-orange-600 font-hand text-xl tracking-normal hover:bg-orange-50 shadow-orange-50' : 'bg-white border-slate-100 text-[#0e121b] font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 shadow-slate-50'}`}
                        >
                            <Mail size={16} /> CONTACT
                        </button>
                    </div>
                </div>
            </div>
        </motion.section>
    );
};