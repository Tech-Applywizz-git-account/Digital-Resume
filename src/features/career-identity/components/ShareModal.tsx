import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Link, QrCode, Check, Download, Smartphone, Copy } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    shareUrl: string;
    candidateName: string | null;
    displayName: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, shareUrl, candidateName, displayName }) => {
    const [copied, setCopied] = useState(false);
    const [showQR, setShowQR] = useState(false);

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = shareUrl;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleDownloadQR = () => {
        const canvas = document.getElementById('share-qr-canvas') as HTMLCanvasElement;
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = `${displayName.replace(/\s+/g, '_')}_career_identity_qr.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-[#0e121b] p-6 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white/10 rounded-xl">
                                    <Smartphone size={22} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-white text-xl font-bold">Share Profile</h3>
                                    <p className="text-blue-200 text-xs uppercase tracking-widest font-medium">Career Identity</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X size={20} className="text-white" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Copy Link */}
                            <button
                                onClick={handleCopyLink}
                                className="w-full p-4 rounded-2xl border border-slate-100 flex items-center gap-4 hover:border-blue-200 hover:bg-blue-50/50 transition-all group active:scale-[0.99]"
                            >
                                <div className="p-3 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                                    {copied ? <Check size={20} className="text-emerald-500" /> : <Link size={20} />}
                                </div>
                                <div className="text-left flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-900">{copied ? 'Copied!' : 'Copy Link'}</p>
                                    <p className="text-xs text-slate-500 truncate">{shareUrl}</p>
                                </div>
                                <Copy size={16} className="text-slate-400 shrink-0" />
                            </button>

                            {/* QR Code */}
                            <button
                                onClick={() => setShowQR(!showQR)}
                                className="w-full p-4 rounded-2xl border border-slate-100 flex items-center gap-4 hover:border-blue-200 hover:bg-blue-50/50 transition-all group active:scale-[0.99]"
                            >
                                <div className="p-3 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                                    <QrCode size={20} />
                                </div>
                                <div className="text-left flex-1">
                                    <p className="text-sm font-bold text-slate-900">QR Code</p>
                                    <p className="text-xs text-slate-500">Show scannable QR code</p>
                                </div>
                            </button>

                            {showQR && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col items-center gap-4"
                                >
                                    <div className="bg-white p-4 rounded-2xl shadow-sm">
                                        <QRCodeCanvas
                                            id="share-qr-canvas"
                                            value={shareUrl}
                                            size={180}
                                            level="H"
                                            bgColor="#ffffff"
                                            fgColor="#0e121b"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500 text-center break-all max-w-full">{shareUrl}</p>
                                    <div className="flex gap-3 w-full">
                                        <button
                                            onClick={handleDownloadQR}
                                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#0e121b] text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors"
                                        >
                                            <Download size={14} /> Download
                                        </button>
                                        <button
                                            onClick={handleCopyLink}
                                            className="flex-1 flex items-center justify-center gap-2 py-3 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors"
                                        >
                                            <Copy size={14} /> Copy Link
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                        </div>

                        <div className="px-6 pb-6">
                            <button
                                onClick={onClose}
                                className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all text-xs uppercase tracking-widest"
                            >
                                Done
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};