import React from 'react';
import { Layers, Github, PlayCircle, Layout } from 'lucide-react';
import { Scribble, Tape } from './CommonElements';

interface Project {
    title: string;
    description: string;
    status: string;
    problem: string;
    impact: string;
    techStack: string[];
    githubLink?: string;
    projectLink?: string;
}

interface ProjectsSectionProps {
    isHumanMode: boolean;
    projects: Project[];
}

export const ProjectsSection: React.FC<ProjectsSectionProps> = ({ isHumanMode, projects }) => {
    if (!projects || projects.length === 0) {
        return (
            <section className="space-y-8">
                <h3 className={`text-lg font-bold flex items-center gap-2 transition-all duration-700 relative ${isHumanMode ? 'text-stone-800 font-hand text-2xl tracking-normal' : 'text-[#0e121b]'}`}>
                    <Layers size={20} className={isHumanMode ? 'text-amber-600' : 'text-blue-600'} />
                    Interactive Project Explorer
                    {isHumanMode && <Scribble className="-bottom-2 left-0 w-full text-amber-500/40" />}
                </h3>
                <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-slate-400">
                    <Layout size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Key projects will appear here</p>
                </div>
            </section>
        );
    }

    return (
        <section className="space-y-8">
            <h3 className={`text-lg font-bold flex items-center gap-2 transition-all duration-700 relative ${isHumanMode ? 'text-stone-800 font-hand text-2xl tracking-normal' : 'text-[#0e121b]'}`}>
                <Layers size={20} className={isHumanMode ? 'text-amber-600' : 'text-blue-600'} />
                Interactive Project Explorer
                {isHumanMode && <Scribble className="-bottom-2 left-0 w-full text-amber-500/40" />}
            </h3>
            <div className="space-y-6">
                {projects.map((project, i) => (
                    <div key={i} className={`bg-white rounded-2xl border overflow-hidden transition-all duration-500 relative ${isHumanMode ? 'border-amber-300 shadow-amber-100 rotate-[-1.5deg] rounded-[3rem] border-dashed' : 'border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1'}`}>
                        {isHumanMode && (
                            <>
                                <Tape className="-top-2 left-10 rotate-[-12deg]" />
                                <Tape className="-top-2 right-10 rotate-[12deg]" />
                                <Scribble className="top-0 left-0 w-full text-amber-200/50" />
                            </>
                        )}
                        <div className={`border-b p-6 transition-colors ${isHumanMode ? 'border-amber-200' : 'border-slate-100'}`}>
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h4 className={`text-xl font-bold transition-colors ${isHumanMode ? 'text-stone-800 font-hand text-xl' : 'text-[#0e121b]'}`}>{project.title}</h4>
                                    <p className={`text-sm mt-1 transition-colors ${isHumanMode ? 'text-stone-500 font-hand text-base' : 'text-slate-500'}`}>{project.description}</p>
                                </div>
                                <span className={`px-3 py-1 text-xs font-normal rounded-full border transition-all ${project.status === 'Active'
                                    ? (isHumanMode ? 'bg-amber-600 text-white border-amber-500 rotate-3' : 'bg-blue-50 text-blue-600 border-blue-100')
                                    : (isHumanMode ? 'bg-stone-100 text-stone-600 border-stone-200 -rotate-3' : 'bg-blue-50 text-blue-600 border-blue-100')
                                    }`}>
                                    {project.status}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <h5 className={`text-[10px] font-normal uppercase tracking-widest mb-3 transition-colors ${isHumanMode ? 'text-amber-700 font-hand text-base' : 'text-slate-400'}`}>Problem</h5>
                                    <p className={`text-sm leading-relaxed transition-colors ${isHumanMode ? 'text-stone-600 font-hand text-base' : 'text-slate-600'}`}>{project.problem}</p>
                                </div>
                                <div>
                                    <h5 className={`text-[10px] font-normal uppercase tracking-widest mb-3 transition-colors ${isHumanMode ? 'text-amber-700 font-hand text-base' : 'text-slate-400'}`}>Impact</h5>
                                    <p className={`text-sm leading-relaxed transition-colors ${isHumanMode ? 'text-stone-600 font-hand text-base' : 'text-slate-600'}`}>{project.impact}</p>
                                </div>
                            </div>
                        </div>
                        <div className={`p-6 transition-colors ${isHumanMode ? 'bg-amber-50/40' : 'bg-slate-50'}`}>
                            <h5 className={`text-[10px] font-normal uppercase tracking-widest mb-4 transition-colors ${isHumanMode ? 'text-amber-700 font-hand text-base' : 'text-slate-400'}`}>Tech Stack & Architecture</h5>
                            <div className="flex flex-wrap gap-2">
                                {(project.techStack || []).map((tech, idx) => (
                                    <span
                                        key={tech}
                                        className={`px-3 py-1.5 border text-xs font-medium rounded-lg transition-all ${isHumanMode
                                            ? `bg-white border-amber-300 text-stone-700 shadow-sm font-hand text-sm tracking-normal ${idx % 2 === 0 ? 'rotate-1' : '-rotate-1'}`
                                            : 'bg-white border-slate-200 text-slate-600'
                                            }`}
                                    >
                                        {tech}
                                    </span>
                                ))}
                            </div>
                            {(project.githubLink || project.projectLink) && (
                                <div className="mt-8 flex justify-end items-center">
                                    <a
                                        href={project.githubLink || project.projectLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`border px-4 py-2 rounded-lg text-xs font-normal transition-all shadow-sm flex items-center gap-2 group ${isHumanMode
                                            ? 'bg-amber-600 border-amber-500 text-white hover:bg-amber-700 font-hand text-base'
                                            : 'bg-white border-slate-200 text-[#0e121b] hover:bg-slate-50'
                                            }`}
                                    >
                                        {project.githubLink ? (
                                            <>
                                                GitHub
                                                <Github size={14} className={`transition-transform group-hover:scale-110 ${isHumanMode ? 'text-white' : 'text-[#0e121b]'}`} />
                                            </>
                                        ) : (
                                            <>
                                                View Project
                                                <PlayCircle size={14} className={`transition-transform group-hover:scale-110 ${isHumanMode ? 'text-white' : 'text-blue-600'}`} />
                                            </>
                                        )}
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};