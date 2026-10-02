import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Sparkles, BadgeCheck } from 'lucide-react';
import { Scribble, CircleScribble, Shimmer } from './CommonElements';

interface SkillsSectionProps {
    isHumanMode: boolean;
    dataLoading: boolean;
    parsed: any;
    skillGroups: any[];
    getDynamicIcon: (cat: string) => React.ReactNode;
}

export const SkillsSection: React.FC<SkillsSectionProps> = ({ isHumanMode, dataLoading, parsed, skillGroups, getDynamicIcon }) => {
    const allSkills = skillGroups.flatMap(g => g.items || []);

    return (
        <section className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className={`text-lg font-bold flex items-center gap-2 transition-all duration-700 relative ${isHumanMode ? 'text-stone-800 font-hand text-2xl tracking-normal' : 'text-[#0e121b]'}`}>
                    <Bot size={20} className={isHumanMode ? 'text-amber-600 animate-pulse' : 'text-blue-600'} />
                    Core Skills
                    {isHumanMode && <Scribble className="-bottom-2 left-0 w-full text-amber-500/40" />}
                </h3>
            </div>
            {dataLoading && !parsed ? (
                <div className="bg-white p-6 rounded-2xl border border-slate-200">
                    <div className="flex flex-wrap gap-2">
                        <Shimmer className="h-8 w-20" />
                        <Shimmer className="h-8 w-28" />
                        <Shimmer className="h-8 w-24" />
                        <Shimmer className="h-8 w-32" />
                        <Shimmer className="h-8 w-20" />
                        <Shimmer className="h-8 w-16" />
                    </div>
                </div>
            ) : allSkills.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                    {allSkills.map((skill: string, idx: number) => (
                        <span
                            key={skill}
                            className={`px-4 py-2 border text-sm font-medium rounded-xl transition-all cursor-default ${isHumanMode
                                ? `bg-amber-50/30 text-stone-700 border-amber-200 hover:border-amber-500 hover:bg-amber-100 font-hand text-base tracking-normal shadow-sm ${idx % 2 === 0 ? 'rotate-[0.5deg]' : '-rotate-[0.5deg]'}`
                                : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 shadow-sm'
                                }`}
                        >
                            {skill}
                        </span>
                    ))}
                </div>
            ) : (
                <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-slate-400">
                    <BadgeCheck size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Skills will appear here</p>
                </div>
            )}
        </section>
    );
};