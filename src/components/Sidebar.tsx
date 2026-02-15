'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Radio, Calendar, FileAudio, Settings, Home, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const navItems = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Schedules', href: '/schedules', icon: Calendar },
    { name: 'Recordings', href: '/records', icon: FileAudio },
    { name: 'Keywords', href: '/keywords', icon: Search },
    // { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

export function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
    const pathname = usePathname();

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={twMerge(
                "fixed inset-y-0 left-0 z-50 flex flex-col h-full w-64 bg-white border-r border-slate-200 transition-transform duration-300 lg:static lg:translate-x-0",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="p-6 flex items-center justify-between border-b border-slate-100">
                    <div className="flex items-center space-x-2">
                        <img src="/logo.png" alt="radikoRec" className="h-16 w-auto" />
                    </div>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setIsOpen(false)}
                                className={twMerge(
                                    "flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200",
                                    isActive
                                        ? "bg-radiko-blue text-white shadow-lg shadow-blue-200"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-radiko-blue"
                                )}
                            >
                                <item.icon className="w-5 h-5" />
                                <span className="font-medium">{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>
                <div className="p-4 border-t border-slate-100">
                    <div className="text-xs text-slate-400 text-center">
                        radiko Recorder System
                    </div>
                </div>
            </div>
        </>
    );
}

