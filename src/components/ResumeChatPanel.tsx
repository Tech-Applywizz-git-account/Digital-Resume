import React, { useState, useRef, useEffect } from "react";
import { Send, X, MessageSquare, User, Bot, Loader2, Sparkles, Play, FileText, Download } from "lucide-react";
import { Button } from "../components/ui/button";
import { supabase } from "../integrations/supabase/client";
import * as pdfjsLib from "pdfjs-dist";

// Configure PDF.js worker
const pdfjsVersion = pdfjsLib.version || "5.4.296";
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    timestamp: Date;
}

export interface ResumeChatPanelProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'chat' | 'video' | 'resume';
    videoUrl: string | null;
    resumeUrl?: string | null;
    onModeChange: (mode: 'chat' | 'video' | 'resume') => void;
    onDownload?: () => void | Promise<void>;
    isDataLoading?: boolean;
    recruiterMode?: boolean;
}

const DEFAULT_QUESTIONS = [
    "Summarize this candidate's experience",
    "What are their key technical skills?",
    "Do they have leadership experience?",
    "What is their education background?"
];

const RECRUITER_QUESTIONS = [
    "Tell me about yourself",
    "What are your key strengths?",
    "What projects are you most proud of?",
    "How can I contact you?"
];

const ResumeChatPanel = ({
    isOpen,
    onClose,
    mode,
    videoUrl,
    resumeUrl,
    onModeChange,
    onDownload,
    isDataLoading,
    recruiterMode = false
}: ResumeChatPanelProps) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: recruiterMode
                ? "Hi there! 👋 I'm glad you're here. Feel free to ask me anything — about my experience, skills, projects, or how I can add value to your team. I'm happy to chat!"
                : "Hi! I'm here to help you analyze this resume. You can ask me questions about the candidate's experience, skills, or background.",
            sender: 'bot',
            timestamp: new Date()
        }
    ]);
    const [inputText, setInputText] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [resumeText, setResumeText] = useState<string>("");
    const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(
        recruiterMode ? RECRUITER_QUESTIONS : DEFAULT_QUESTIONS
    );
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadResumeText = async () => {
            // 1. Try to load from localStorage first
            const storedText = localStorage.getItem('resumeFullText');
            if (storedText) {
                setResumeText(storedText);
                return;
            }

            // 2. If not in localStorage, but we have URL, fetch and parse it
            if (resumeUrl) {
                try {
                    console.log("Fetching resume PDF from:", resumeUrl);
                    setIsLoading(true); // Show loading while parsing

                    const response = await fetch(resumeUrl);
                    const blob = await response.blob();
                    const arrayBuffer = await blob.arrayBuffer();

                    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                    const pdf = await loadingTask.promise;

                    let text = "";
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const content = await page.getTextContent();
                        const pageText = (content.items as any[])
                            .map((item: any) => item.str)
                            .join("\n");
                        text += pageText + "\n\n";
                    }

                    // Clean up multiple newlines but preserve structure
                    const extractedText = text.replace(/\n\s*\n/g, "\n").trim().slice(0, 25000);
                    console.log("Extracted PDF text length:", extractedText.length);

                    setResumeText(extractedText);
                    // Optionally save to localStorage for cache
                    localStorage.setItem('resumeFullText', extractedText);

                } catch (err: any) {
                    console.error("Failed to parse PDF from URL:", err);
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        text: "I was unable to read the resume file. Please ensure it is accessible.",
                        sender: 'bot',
                        timestamp: new Date()
                    }]);
                } finally {
                    setIsLoading(false);
                }
            }
        };

        if (isOpen) {
            loadResumeText();
        }
    }, [isOpen, resumeUrl]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen, mode, isLoading]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleSendMessage = async (text: string) => {
        if (!text.trim()) return;

        const newMessage: Message = {
            id: Date.now().toString(),
            text: text,
            sender: 'user',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, newMessage]);
        setInputText("");
        setIsLoading(true);

        try {
            if (!resumeText) {
                // Try one last check in case it just finished loading
                const currentStored = localStorage.getItem('resumeFullText');
                if (currentStored) {
                    setResumeText(currentStored);
                } else {
                    throw new Error("Resume content not available. Please wait for the resume to load or refresh the page.");
                }
            }

            const { data, error } = await supabase.functions.invoke('resume-chat', {
                body: {
                    resumeText: resumeText,
                    messages: messages.map(m => ({ role: m.sender === 'bot' ? 'assistant' : 'user', content: m.text })),
                    question: text,
                    recruiterMode: recruiterMode
                }
            });

            if (error) throw error;

            let botText = data.answer || "I couldn't generate a response.";

            // Extract suggested questions if present
            if (botText.includes("SUGGESTED_QUESTIONS:")) {
                const parts = botText.split("SUGGESTED_QUESTIONS:");
                botText = parts[0].trim();
                const suggestions = parts[1].split("|").map((q: string) => q.trim()).filter((q: string) => q.length > 0);
                if (suggestions.length > 0) {
                    setSuggestedQuestions(suggestions);
                }
            }

            const botResponse: Message = {
                id: (Date.now() + 1).toString(),
                text: botText,
                sender: 'bot',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, botResponse]);

        } catch (error: any) {
            console.error("Chat error details:", error);

            let errorMessage = "Sorry, I encountered an error analyzing the resume.";

            if (error.message) {
                if (error.message.includes("Failed to send a request")) {
                    errorMessage += " deeply failed to connect to the AI service. Please try again in a moment.";
                } else if (error.context && error.context.status) {
                    errorMessage += ` Server returned status ${error.context.status}.`;
                } else {
                    errorMessage += ` ${error.message}`;
                }
            } else {
                errorMessage += " Unknown error occurred.";
            }

            const errorResponse: Message = {
                id: (Date.now() + 1).toString(),
                text: errorMessage,
                sender: 'bot',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorResponse]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(inputText);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed top-20 right-6 w-full max-w-[420px] h-[calc(100vh-100px)] bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-gray-100 z-[110] flex flex-col overflow-hidden transition-all duration-300">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 flex justify-between items-center text-white shrink-0">
                <h3 className="font-semibold flex items-center gap-2">
                    {mode === 'chat' ? (
                        <>
                            <MessageSquare className="w-5 h-5" />
                            Ask About Resume
                        </>
                    ) : mode === 'video' ? (
                        <>
                            <Play className="w-5 h-5" />
                            Video Introduction
                        </>
                    ) : (
                        <>
                            <FileText className="w-5 h-5" />
                            Resume Preview
                        </>
                    )}
                </h3>
                <button
                    onClick={onClose}
                    className="hover:bg-white/20 p-1 rounded-full transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative bg-gray-50 flex flex-col">
                {mode === 'video' ? (
                    // Video Mode
                    <div className="h-full w-full flex items-center justify-center bg-black p-0 overflow-hidden">
                        {videoUrl ? (
                            <video
                                controls
                                preload="metadata"
                                playsInline
                                className="w-full h-full object-contain"
                                src={videoUrl}
                                onLoadedMetadata={(e) => {
                                    e.currentTarget.currentTime = 0;
                                }}
                            >
                                <source src={videoUrl} type="video/webm" />
                                <source src={videoUrl} type="video/mp4" />
                                Your browser does not support the video tag.
                            </video>
                        ) : (
                            <div className="text-white text-center p-4">
                                <p>No video available for this candidate.</p>
                            </div>
                        )}
                    </div>
                ) : mode === 'resume' ? (
                    // Resume Mode
                    <div className="h-full w-full bg-gray-100 flex flex-col relative">
                        {resumeUrl ? (
                            <>
                                <iframe
                                    src={`${resumeUrl}#toolbar=0&navpanes=0`}
                                    className="w-full h-full border-none"
                                    title="Resume PDF"
                                />
                                {isDataLoading && (
                                    <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-20">
                                        <Loader2 className="w-8 h-8 text-[#0B4F6C] animate-spin" />
                                    </div>
                                )}
                                {onDownload && (
                                    <div className="absolute bottom-6 right-6 z-10">
                                        <Button
                                            onClick={onDownload}
                                            className="shadow-lg bg-[#0B4F6C] hover:bg-[#093d54] text-white flex items-center gap-2"
                                        >
                                            <Download className="w-4 h-4" />
                                            Download Enhanced Copy
                                        </Button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500 p-4 text-center">
                                <p>No resume available to preview.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    // Chat Mode
                    <>
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    {msg.sender === 'bot' && (
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0B4F6C] to-[#0B4F6C]/80 flex items-center justify-center shrink-0 shadow-sm mt-1">
                                            <Sparkles className="w-4 h-4 text-white" />
                                        </div>
                                    )}

                                    <div
                                        className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm shadow-sm transition-all ${msg.sender === 'user'
                                            ? 'bg-[#0B4F6C] text-white rounded-br-sm'
                                            : 'bg-white text-slate-700 border border-slate-100 rounded-bl-sm'
                                            }`}
                                    >
                                        {msg.sender === 'user' ? (
                                            msg.text
                                        ) : (
                                            <div className="space-y-1">
                                                {msg.text.split('\n').map((line, i) => {
                                                    // Handle list items
                                                    const isListItem = line.trim().startsWith('-') || line.trim().startsWith('•') || /^\d+\./.test(line.trim());

                                                    // Process bold text
                                                    const parts = line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
                                                        if (part.startsWith('**') && part.endsWith('**')) {
                                                            return <strong key={j} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
                                                        }
                                                        return <span key={j}>{part}</span>;
                                                    });

                                                    if (!line.trim()) {
                                                        return <div key={i} className="h-2" />;
                                                    }

                                                    return (
                                                        <div key={i} className={`${isListItem ? 'pl-2' : ''} leading-relaxed`}>
                                                            {parts}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {msg.sender === 'user' && (
                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 shadow-sm mt-1">
                                            <User className="w-4 h-4 text-slate-500" />
                                        </div>
                                    )}
                                </div>
                            ))}

                            {isLoading && (
                                <div className="flex gap-3 justify-start">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0B4F6C] to-[#0B4F6C]/80 flex items-center justify-center shrink-0 shadow-sm mt-1">
                                        <Sparkles className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm px-5 py-3 shadow-sm flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-[#0B4F6C]" />
                                        <span className="text-sm text-slate-500 font-medium">Thinking...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Suggested Questions */}
                        <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar pt-2">
                            {suggestedQuestions.map((q, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSendMessage(q)}
                                    className="whitespace-nowrap px-4 py-2 bg-white border border-[#0B4F6C]/20 text-[#0B4F6C] text-xs font-medium rounded-xl hover:bg-[#0B4F6C] hover:text-white transition-all shadow-sm active:scale-95"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white border-t border-gray-50 shrink-0">
                            <div className="relative flex items-center gap-2">
                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask about detailed experience, skills..."
                                    className="flex-1 pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B4F6C]/20 focus:border-[#0B4F6C] transition-all text-sm placeholder:text-gray-400"
                                />
                                <button
                                    onClick={() => handleSendMessage(inputText)}
                                    disabled={!inputText.trim() || isLoading}
                                    className="absolute right-2 p-2 bg-[#0B4F6C] text-white rounded-lg hover:bg-[#093d54] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ResumeChatPanel;
