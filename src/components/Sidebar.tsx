'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Radio, Calendar, FileAudio, Settings, Home } from 'lucide-react';
import { clsx } from 'clsx'; // Make sure clsx is installed or use template literal
// If clsx not installed, simple template literal is fine. I installed it.
import { twMerge } from 'tailwind-merge';

const navItems = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Schedules', href: '/schedules', icon: Calendar },
    { name: 'Recordings', href: '/records', icon: FileAudio },
    // { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="flex flex-col h-full w-64 bg-slate-900 text-white border-r border-slate-800">
            <div className="p-6 flex items-center space-x-2 border-b border-slate-800">
                <Radio className="w-8 h-8 text-blue-400" />
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
                    RadikoRec
                </span>
            </div>
            <nav className="flex-1 p-4 space-y-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={twMerge(
                                "flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200",
                                isActive
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50"
                                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                            )}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="font-medium">{item.name}</span>
                        </Link>
                    );
                })}
            </nav>
            <div className="p-4 border-t border-slate-800">
                <div className="text-xs text-slate-500 text-center">
                    Radiko Recorder System
                </div>
            </div>
        </div>
    );
}
