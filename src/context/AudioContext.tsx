'use client';

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { Record as RadioRecord } from '@/types';

interface AudioContextType {
    currentRecord: RadioRecord | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    playbackRate: number;
    playRecord: (record: RadioRecord) => void;
    togglePlay: () => void;
    seek: (time: number) => void;
    skip: (seconds: number) => void;
    setRate: (rate: number) => void;
    playbackHistory: Record<string, HistoryItem>;
}

const STORAGE_KEY = 'radiko_player_state';
const HISTORY_KEY = 'radiko_player_history';

interface HistoryItem {
    currentTime: number;
    duration: number;
    updatedAt: number;
}

interface PlayerState {
    record: RadioRecord;
    currentTime: number;
    playbackRate: number;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: React.ReactNode }) {
    const [currentRecord, setCurrentRecord] = useState<RadioRecord | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [playbackHistory, setPlaybackHistory] = useState<Record<string, HistoryItem>>({});
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Keyboard shortcuts
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in input/textarea
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    skip(-10);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    skip(30);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentRecord, isPlaying]);

    // Cleanup and Event Listeners
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
            // Save state periodically (every 2s approx would be optimization, but here saving on every update for simplicity/reliability)
            if (currentRecord) {
                const state: PlayerState = {
                    record: currentRecord,
                    currentTime: audio.currentTime,
                    playbackRate: audio.playbackRate
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            }
        };

        const handleDurationChange = () => setDuration(audio.duration);
        const handleEnded = () => {
            setIsPlaying(false);
            // Clear state on end? Or keep it? keeping it allows replaying.
        };
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('durationchange', handleDurationChange);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);

        // Restore state on mount
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && !currentRecord) {
            try {
                const parsed: PlayerState = JSON.parse(saved);
                if (parsed.record && parsed.record.id) {
                    setCurrentRecord(parsed.record);
                    setPlaybackRate(parsed.playbackRate || 1.0);
                    setCurrentTime(parsed.currentTime || 0);

                    // Don't auto-play, just restore state
                    if (audioRef.current) {
                        audioRef.current.src = `/api/records/${parsed.record.filename}`;
                        audioRef.current.currentTime = parsed.currentTime;
                        audioRef.current.playbackRate = parsed.playbackRate || 1.0;
                    }
                }
            } catch (e) {
                console.error('Failed to restore player state', e);
            }
        }

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('durationchange', handleDurationChange);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
        };
    }, [currentRecord]); // Re-bind listeners when currentRecord changes to capture correct closure value

    const playRecord = (record: RadioRecord) => {
        if (currentRecord?.id === record.id) {
            togglePlay();
            return;
        }

        setCurrentRecord(record);
        if (audioRef.current) {
            audioRef.current.src = `/api/records/${record.filename}`;
            audioRef.current.playbackRate = playbackRate;
            // Check history
            const historyItem = playbackHistory[record.id];
            const startTime = historyItem ? historyItem.currentTime : 0;

            audioRef.current.currentTime = startTime;
            if (startTime > 0) {
                setCurrentTime(startTime);
            }
            audioRef.current.play();
        }
    };

    const updateHistory = (id: string, time: number, dur: number) => {
        setPlaybackHistory(prev => {
            const next = {
                ...prev,
                [id]: {
                    currentTime: time,
                    duration: dur,
                    updatedAt: Date.now()
                }
            };
            localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
            return next;
        });
    };

    const togglePlay = () => {
        if (!audioRef.current || !currentRecord) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
    };

    const seek = (time: number) => {
        if (!audioRef.current) return;
        audioRef.current.currentTime = time;
        setCurrentTime(time);
    };

    const skip = (seconds: number) => {
        if (!audioRef.current) return;
        const newTime = Math.max(0, Math.min(audioRef.current.duration, audioRef.current.currentTime + seconds));
        seek(newTime);
    };

    const setRate = (rate: number) => {
        setPlaybackRate(rate);
        if (audioRef.current) {
            audioRef.current.playbackRate = rate;
        }
    };

    return (
        <AudioContext.Provider value={{
            currentRecord,
            isPlaying,
            currentTime,
            duration,
            playbackRate,
            playRecord,
            togglePlay,
            seek,
            skip,
            setRate,
            playbackHistory
        }}>
            {children}
            <audio ref={audioRef} style={{ display: 'none' }} />
        </AudioContext.Provider>
    );
}

export function useAudio() {
    const context = useContext(AudioContext);
    if (context === undefined) {
        throw new Error('useAudio must be used within an AudioProvider');
    }
    return context;
}
