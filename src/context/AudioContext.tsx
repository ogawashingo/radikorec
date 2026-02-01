'use client';

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { Record } from '@/types';

interface AudioContextType {
    currentRecord: Record | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    playbackRate: number;
    playRecord: (record: Record) => void;
    togglePlay: () => void;
    seek: (time: number) => void;
    skip: (seconds: number) => void;
    setRate: (rate: number) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: React.ReactNode }) {
    const [currentRecord, setCurrentRecord] = useState<Record | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
        const handleDurationChange = () => setDuration(audio.duration);
        const handleEnded = () => setIsPlaying(false);
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('durationchange', handleDurationChange);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('durationchange', handleDurationChange);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
        };
    }, []);

    const playRecord = (record: Record) => {
        if (currentRecord?.id === record.id) {
            togglePlay();
            return;
        }

        setCurrentRecord(record);
        if (audioRef.current) {
            audioRef.current.src = `/api/records/${record.filename}`;
            audioRef.current.playbackRate = playbackRate;
            audioRef.current.play();
        }
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
            setRate
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
