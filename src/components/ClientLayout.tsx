'use client';

import { useState } from 'react';
import { Sidebar } from "@/components/Sidebar";
import { Menu, X, Radio } from 'lucide-react';
import { AudioProvider } from '@/context/AudioContext';
import { PersistentPlayer } from '@/components/PersistentPlayer';
import { DownloadStatus } from '@/components/DownloadStatus';

export function ClientLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <AudioProvider>
            <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans antialiased">
                <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    {/* Mobile Header */}
                    <header className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 shrink-0">
                        <div className="flex items-center space-x-2">
                            <img src="/logo.png" alt="radikoRec" className="h-20 w-auto" />
                        </div>
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 text-slate-400 hover:text-radiko-blue hover:bg-slate-100 rounded-lg transition-colors"
                            aria-label="Open menu"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                    </header>

                    <main className="flex-1 overflow-y-auto p-4 md:p-8 relative pb-32 md:pb-40">
                        <div className="absolute inset-0 bg-slate-50 -z-10" />
                        {/* Subtle gradient blob - lightened */}
                        <div className="absolute top-0 left-0 w-full h-96 bg-blue-100/30 blur-[100px] rounded-full -z-10 pointer-events-none" />

                        <div className="max-w-6xl mx-auto">
                            {children}
                        </div>
                    </main>
                </div>

                <PersistentPlayer />
                <DownloadStatus />
            </div>
        </AudioProvider>
    );
}

