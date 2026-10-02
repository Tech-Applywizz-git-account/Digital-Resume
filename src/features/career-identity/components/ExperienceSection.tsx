import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { History, Briefcase } from 'lucide-react';
import { Scribble, CircleScribble } from './CommonElements';

interface ExperienceSectionProps {
    isHumanMode: boolean;
    experience: any[];
}

export const ExperienceSection: React.FC<ExperienceSectionProps> = ({ isHumanMode, experience }) => {
    const [expandedExp, setExpandedExp] = useState<Record<number, boolean>>({});

    if (!experience || experience.length === 0) {
        return (
            <section className="space-y-8">
                <h3 className={`text-lg font-bold flex items-center gap-2 transition-all duration-700 relative ${isHumanMode ? 'text-stone-800 font-hand text-2xl tracking-normal' : 'text-[#0e121b]'}`}>
                    <History size={20} className={isHumanMode ? 'text-amber-600' : 'text-blue-600'} />
                    Career Trajectory
                    {isHumanMode && <Scribble className="-bottom-2 left-0 w-full text-amber-500/40" />}
                </h3>
                <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-slate-400">
                    <Briefcase size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Experience details will appear here</p>
                </div>
            </section>
        );
    }

    return (
        <section className="space-y-8">
            <h3 className={`text-lg font-bold flex items-center gap-2 transition-all duration-700 relative ${isHumanMode ? 'text-stone-800 font-hand text-2xl tracking-normal' : 'text-[#0e121b]'}`}>
                <History size={20} className={isHumanMode ? 'text-amber-600' : 'text-blue-600'} />
                Career Trajectory
                {isHumanMode && <Scribble className="-bottom-2 left-0 w-full text-amber-500/40" />}
            </h3>
            <div className="space-y-6">
                {experience.map((job, i) => {
                    const isExpanded = expandedExp[i];
                    const isCurrentRole = job.duration && job.duration.toLowerCase().includes('present');

                    let shortDesc = job.description || "";
                    if (shortDesc.length > 300) {
                        shortDesc = shortDesc.substring(0, 300);
                        const lastPeriod = shortDesc.lastIndexOf('.');
                        if (lastPeriod > 150) {
                            shortDesc = shortDesc.substring(0, lastPeriod + 1);
                        } else {
                            shortDesc = shortDesc.substring(0, shortDesc.lastIndexOf(' '));
                            if (!shortDesc.endsWith('.')) shortDesc += '.';
                        }
                    }
                    shortDesc = shortDesc.replace(/\.{2,}/g, '.');

                    return (
                        <div
                            key={i}
                            onClick={() => setExpandedExp(prev => ({ ...prev, [i]: !prev[i] }))}
                            className={`group relative bg-white p-6 rounded-3xl border cursor-pointer transition-all duration-500 hover:-translate-y-1 ${isHumanMode
                                ? `shadow-human rotate-[1.2deg] rounded-human-lg ${isExpanded ? 'border-amber-500' : 'border-human-primary/10'}`
                                : `shadow-sm hover:shadow-xl rounded-3xl ${isExpanded ? 'border-blue-600 shadow-lg shadow-blue-50' : 'border-slate-200 hover:border-blue-200'}`}`}
                        >
                            {isHumanMode && <CircleScribble className="-top-4 -right-4 w-12 h-12 text-amber-200" />}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                <div className="flex items-center gap-4">
                                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all ${isCurrentRole ? (isHumanMode ? 'bg-human-primary text-white shadow-human rotate-3 scale-110' : 'bg-blue-600 text-white shadow-lg shadow-blue-200') : 'bg-slate-100 text-slate-400'}`}>
                                        <Briefcase size={20} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h4 className={`font-bold transition-all duration-700 ${isHumanMode ? 'text-stone-800 font-hand text-xl tracking-normal' : 'text-[#0e121b] group-hover:text-blue-600'}`}>{job.role}</h4>
                                            {isCurrentRole && (
                                                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-normal uppercase tracking-wider border ${isHumanMode ? 'bg-human-primary text-white border-human-primary/20 rotate-3 font-hand text-sm tracking-normal shadow-human' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                                    <div className={`h-1 w-1 rounded-full animate-pulse ${isHumanMode ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
                                                    Active
                                                </span>
                                            )}
                                        </div>
                                        <p className={`text-sm font-normal uppercase tracking-widest transition-all duration-700 ${isHumanMode ? 'text-amber-700/80 font-hand text-base tracking-normal' : 'text-slate-600'}`}>{job.company}</p>
                                    </div>
                                </div>
                                <div className={`px-5 py-2 rounded-human border text-[10px] font-normal uppercase tracking-widest h-fit transition-all duration-700 ${isHumanMode ? 'bg-human-bg border-human-primary/20 text-human-primary -rotate-2 font-hand text-sm tracking-normal shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                                    {job.duration}
                                </div>
                            </div>

                            {!isExpanded && (
                                <p className={`text-sm leading-relaxed pl-16 transition-all duration-700 ${isHumanMode ? 'text-stone-800 font-hand text-sm tracking-normal' : 'text-slate-700'}`}>
                                    {shortDesc}
                                </p>
                            )}

                            {!isExpanded ? (
                                <div className="mt-6 pl-16 flex items-center gap-4">
                                    <button onClick={(e) => { e.stopPropagation(); setExpandedExp(prev => ({ ...prev, [i]: true })); }} className={`font-normal flex items-center gap-1 hover:underline transition-all duration-700 ${isHumanMode ? 'text-amber-600 font-hand text-sm tracking-normal' : 'text-[10px] uppercase tracking-widest text-blue-600'}`}>
                                        view more
                                    </button>
                                    {isCurrentRole && (
                                        <>
                                            <span className="h-1 w-1 bg-slate-200 rounded-full"></span>
                                            <span className={`text-[10px] font-normal uppercase tracking-widest flex items-center gap-1.5 transition-colors ${isHumanMode ? 'text-blue-600 font-hand text-sm tracking-normal' : 'text-blue-600'}`}>
                                                <div className="h-1.5 w-1.5 rounded-full animate-pulse bg-blue-500"></div>
                                                Current Role
                                            </span>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <p className={`text-sm leading-relaxed pl-16 mb-4 transition-all duration-700 ${isHumanMode ? 'text-stone-800 font-hand text-base tracking-normal' : 'text-slate-700'}`}>
                                        {job.description}
                                    </p>
                                    {(() => {
                                        const descText = job.description || "";
                                        let displayAchievements = job.achievements
                                            ? job.achievements.filter((a: string) => a && a.toLowerCase() !== 'not specified' && !descText.includes(a.substring(0, 30)))
                                            : [];

                                        if (displayAchievements.length < 6 && job.description) {
                                            const sentences = job.description.match(/[^.!?]+[.!?]+/g) || [];
                                            for (let s of sentences) {
                                                if (displayAchievements.length >= 6) break;
                                                const cleanSentence = s.trim();
                                                if (cleanSentence.length > 20 &&
                                                    !displayAchievements.some((a: string) => a.includes(cleanSentence.substring(0, 20))) &&
                                                    !descText.startsWith(cleanSentence.substring(0, 30))) {
                                                    displayAchievements.push(cleanSentence);
                                                }
                                            }
                                        }
                                        displayAchievements = displayAchievements.slice(0, 6);

                                        return displayAchievements.length > 0 && (
                                            <div className="mt-4 pl-16 space-y-2">
                                                {displayAchievements.map((achievement: string, aIdx: number) => (
                                                    <div key={aIdx} className="flex gap-2 items-start">
                                                        <div className={`mt-2 shrink-0 h-1 w-1 rounded-full ${isHumanMode ? 'bg-amber-400' : 'bg-blue-600'}`}></div>
                                                        <p className={`text-[11px] leading-relaxed ${isHumanMode ? 'text-stone-600 font-hand text-sm tracking-normal' : 'text-slate-700'}`}>{achievement}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                    <div className="mt-6 pl-16 flex items-center gap-4">
                                        <button onClick={(e) => { e.stopPropagation(); setExpandedExp(prev => ({ ...prev, [i]: false })); }} className={`font-normal flex items-center gap-1 hover:underline transition-all duration-700 ${isHumanMode ? 'text-amber-600 font-hand text-sm tracking-normal' : 'text-[10px] uppercase tracking-widest text-blue-600'}`}>
                                            view less
                                        </button>
                                        {isCurrentRole && (
                                            <>
                                                <span className="h-1 w-1 bg-slate-200 rounded-full"></span>
                                                <span className={`text-[10px] font-normal uppercase tracking-widest flex items-center gap-1.5 transition-colors ${isHumanMode ? 'text-blue-600 font-hand text-sm tracking-normal' : 'text-blue-600'}`}>
                                                    <div className="h-1.5 w-1.5 rounded-full animate-pulse bg-blue-500"></div>
                                                    Current Role
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
};