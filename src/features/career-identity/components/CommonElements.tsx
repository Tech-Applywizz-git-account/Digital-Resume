import React from 'react';
import { motion } from 'framer-motion';

export const Scribble = ({ className }: { className?: string }) => (
    <motion.svg
        viewBox="0 0 100 20"
        className={`absolute pointer-events-none fill-none stroke-current opacity-40 ${className}`}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.4 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
    >
        <motion.path
            d="M5,15 Q25,5 45,15 T85,10"
            strokeWidth="2"
            strokeLinecap="round"
            animate={{ d: ["M5,15 Q25,5 45,15 T85,10", "M5,14 Q25,6 45,14 T85,11", "M5,15 Q25,5 45,15 T85,10"] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
    </motion.svg>
);

export const CircleScribble = ({ className }: { className?: string }) => (
    <motion.svg
        viewBox="0 0 100 100"
        className={`absolute pointer-events-none fill-none stroke-current opacity-40 ${className}`}
        initial={{ rotate: 0, scale: 0.8, opacity: 0 }}
        animate={{ rotate: 360, scale: 1, opacity: 0.4 }}
        transition={{
            rotate: { duration: 20, repeat: Infinity, ease: "linear" },
            scale: { duration: 1, ease: "easeOut" },
            opacity: { duration: 1 }
        }}
    >
        <circle cx="50" cy="50" r="45" strokeWidth="1.5" strokeDasharray="5 5" />
    </motion.svg>
);

export const Tape = ({ className = "" }: { className?: string }) => (
    <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05, rotate: 2 }}
        className={`absolute h-6 w-16 bg-amber-200/40 backdrop-blur-[1px] border border-amber-300/20 shadow-sm z-10 ${className}`}
        style={{ clipPath: 'polygon(5% 0%, 95% 2%, 100% 50%, 98% 95%, 5% 100%, 0% 50%)' }} />
);

export const Shimmer = ({ className }: { className?: string }) => (
    <div className={`relative overflow-hidden bg-slate-200/50 rounded-xl ${className}`}>
        <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
        />
    </div>
);