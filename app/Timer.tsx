"use client"

import { useState, useEffect, useRef, useCallback } from 'react';
import { generateScramble, DisplayCube, applyScramble, Cube } from 'react-rubiks-cube-utils';
import Cube2d from '../utils/Cube2d'


// --- Types ---
type TimerState = 'idle' | 'ready' | 'running';
type Penalty = '' | '+2' | 'DNF';

interface Solve {
    id: string;
    time: number;       // Raw timer value in ms
    penalty: Penalty;
    scramble: string;
    comment: string;
    timestamp: number;
}

// --- Helper: Format ms to mm:ss.cc ---
const formatTime = (ms: number, penalty: Penalty = '') => {
    if (penalty === 'DNF') return 'DNF';
    
    // If +2, we visually show the added time
    const finalTime = penalty === '+2' ? ms + 2000 : ms;

    const s = Math.floor(finalTime / 1000);
    const m = Math.floor(s / 60);
    const remS = s % 60;
    const remMs = Math.floor((finalTime % 1000) / 10);
    
    const strS = remS < 10 ? `0${remS}` : remS;
    const strMs = remMs < 10 ? `0${remMs}` : remMs;

    const timeString = m > 0 ? `${m}:${strS}.${strMs}` : `${s}.${strMs}`;
    return penalty === '+2' ? `${timeString}+` : timeString;
};

// --- Helper: Calculate Statistics (WCA Style) ---
const calculateStats = (solves: Solve[]) => {
    // Filter out solves to get effective times
    const validSolves = solves.map(s => {
        if (s.penalty === 'DNF') return Infinity;
        if (s.penalty === '+2') return s.time + 2000;
        return s.time;
    });

    const nonDnfSolves = validSolves.filter(t => t !== Infinity);
    
    // Best Solve (Single)
    const best = nonDnfSolves.length > 0 ? Math.min(...nonDnfSolves) : 0;

    // Helper for Averages
    const getAvg = (n: number) => {
        if (validSolves.length < n) return 0;
        
        // Take last n solves
        const subset = validSolves.slice(-n);
        
        // Count DNFs
        const dnfCount = subset.filter(t => t === Infinity).length;
        
        // WCA Logic: 
        // For Ao5: >1 DNF = DNF. 
        // For Ao12: >1 DNF = DNF. (Technically WCA allows 1 DNF to be dropped)
        if (dnfCount > 1) return 0; // Return 0 to signify DNF in UI for simplicity, or handle logic
        
        // Sort
        subset.sort((a, b) => a - b);
        
        // Remove best and worst
        // If 1 DNF, it is 'Infinity', so it's at the end (worst). It gets removed.
        const trimmed = subset.slice(1, -1);
        
        const sum = trimmed.reduce((a, b) => a + b, 0);
        return sum / trimmed.length;
    };

    // Mean (All non-DNFs)
    const sum = nonDnfSolves.reduce((a, b) => a + b, 0);
    const mean = nonDnfSolves.length > 0 ? sum / nonDnfSolves.length : 0;

    // Standard Deviation
    const variance = nonDnfSolves.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / nonDnfSolves.length;
    const stdDev = Math.sqrt(variance || 0);

    return {
        best,
        mean,
        stdDev,
        ao5: getAvg(5),
        ao12: getAvg(12),
        ao50: getAvg(50),
        ao100: getAvg(100)
    };
};


export default function Timer() {
    // --- Settings State ---
    const [cubetype, setCubetype] = useState<string>("3x3");
    const [session, setSession] = useState<string>("1");
    const [scramble, setScramble] = useState<string>("");
    
    // --- Timer Logic State ---
    const [timerState, setTimerState] = useState<TimerState>('idle');
    const [timeDisplay, setTimeDisplay] = useState<number>(0);
    
    // --- Data State ---
    const [solves, setSolves] = useState<Solve[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // --- Modal State ---
    const [selectedSolveId, setSelectedSolveId] = useState<string | null>(null);

    // Refs
    const timerStateRef = useRef<TimerState>('idle');
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);

    useEffect(() => { timerStateRef.current = timerState; }, [timerState]);

    // --- 1. Load Data ---
    useEffect(() => {
        const savedType = localStorage.getItem("cubetype");
        const savedSession = localStorage.getItem("session");
        if (savedType) setCubetype(savedType);
        if (savedSession) setSession(savedSession);
        setIsLoaded(true);
    }, []);

    // --- 2. Sync Session Data ---
    useEffect(() => {
        if (!isLoaded) return;
        
        localStorage.setItem("cubetype", cubetype);
        localStorage.setItem("session", session);
        setScramble(generateScramble({ type: cubetype }));

        const sessionKey = `session_v2_${session}`; // Changed key to avoid conflict with old number[] format
        const storedData = localStorage.getItem(sessionKey);
        
        if (storedData) {
            try {
                setSolves(JSON.parse(storedData));
            } catch (e) {
                console.error("Error parsing solves", e);
                setSolves([]);
            }
        } else {
            setSolves([]);
        }
    }, [cubetype, session, isLoaded]);

    // --- 3. Save Solves ---
    useEffect(() => {
        if (!isLoaded) return;
        const sessionKey = `session_v2_${session}`;
        localStorage.setItem(sessionKey, JSON.stringify(solves));
    }, [solves, session, isLoaded]);


    // --- Timer Functions ---
    const handleFinish = useCallback((finalTime: number) => {
        const newSolve: Solve = {
            id: Date.now().toString(), // Simple unique ID
            time: finalTime,
            penalty: '',
            scramble: scramble, // Save current scramble
            comment: scramble,  // Default comment is the scramble
            timestamp: Date.now()
        };

        setSolves(prev => [...prev, newSolve]);
        setScramble(generateScramble({ type: cubetype }));
    }, [cubetype, scramble]);

    const stopTimer = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        const finalTime = Date.now() - startTimeRef.current;
        setTimeDisplay(finalTime);
        setTimerState('idle');
        handleFinish(finalTime);
    }, [handleFinish]);

    const startTimer = useCallback(() => {
        setTimerState('running');
        startTimeRef.current = Date.now();
        intervalRef.current = setInterval(() => {
            setTimeDisplay(Date.now() - startTimeRef.current);
        }, 10);
    }, []);

    const readyTimer = useCallback(() => {
        setTimerState('ready');
        setTimeDisplay(0);
    }, []);

    // --- Keyboard Inputs ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Disable spacebar if modal is open
            if(selectedSolveId) return; 

            if (e.code === "Space") {
                if(timerStateRef.current !== 'running') e.preventDefault(); 
                if (timerStateRef.current === 'running') stopTimer();
                else if (timerStateRef.current === 'idle') readyTimer();
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if(selectedSolveId) return;

            if (e.code === "Space") {
                if (timerStateRef.current === 'ready') startTimer();
                else if (timerStateRef.current === 'idle') setTimerState('idle');
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, [readyTimer, startTimer, stopTimer, selectedSolveId]);


    // --- Solve Management ---
    const updateSolve = (id: string, updates: Partial<Solve>) => {
        setSolves(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const deleteSolve = (id: string) => {
        if(confirm("Delete this solve?")) {
            setSolves(prev => prev.filter(s => s.id !== id));
            setSelectedSolveId(null);
        }
    };

    const stats = calculateStats(solves);
    const selectedSolve = solves.find(s => s.id === selectedSolveId);
    let cube = applyScramble({ type: cubetype, scramble: scramble });

    return (
        <div className="bg-[#4A70A9] min-h-screen text-white font-sans relative">
            
            {/* --- DETAILS MODAL --- */}
            {selectedSolveId && selectedSolve && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[#2d4870] border border-white/20 p-6 rounded-lg w-full max-w-md shadow-2xl">
                        <h2 className="text-2xl font-mono font-bold text-center mb-4">
                            {formatTime(selectedSolve.time, selectedSolve.penalty)}
                        </h2>
                        
                        <div className="flex justify-center gap-4 mb-6">
                            <button 
                                onClick={() => updateSolve(selectedSolve.id, { penalty: selectedSolve.penalty === '+2' ? '' : '+2' })}
                                className={`px-4 py-2 rounded border ${selectedSolve.penalty === '+2' ? 'bg-yellow-600 border-yellow-400' : 'border-white/20 hover:bg-white/10'}`}
                            >
                                +2
                            </button>
                            <button 
                                onClick={() => updateSolve(selectedSolve.id, { penalty: selectedSolve.penalty === 'DNF' ? '' : 'DNF' })}
                                className={`px-4 py-2 rounded border ${selectedSolve.penalty === 'DNF' ? 'bg-red-600 border-red-400' : 'border-white/20 hover:bg-white/10'}`}
                            >
                                DNF
                            </button>
                            <button 
                                onClick={() => deleteSolve(selectedSolve.id)}
                                className="px-4 py-2 rounded border border-red-500 text-red-300 hover:bg-red-500/20"
                            >
                                Delete
                            </button>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm text-white/60 mb-1">Comment / Scramble</label>
                            <textarea 
                                className="w-full bg-[#1e3454] border border-white/20 rounded p-2 text-sm font-mono h-24"
                                value={selectedSolve.comment}
                                onChange={(e) => updateSolve(selectedSolve.id, { comment: e.target.value })}
                            />
                        </div>

                        <div className="text-center">
                            <button 
                                onClick={() => setSelectedSolveId(null)}
                                className="bg-white/20 hover:bg-white/30 px-6 py-2 rounded"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* --- HEADER --- */}
            <div className="border-b border-white/20 py-3 flex items-center bg-[#3b5d8f]">
                {/* Same header as before */}
                <div className="basis-1/5 px-4">
                    <span className="mr-2 font-bold">Type:</span>
                    <select 
                        className="bg-[#2d4870] border border-white/30 px-2 py-1 rounded text-white outline-none" 
                        value={cubetype} 
                        onChange={(e) => setCubetype(e.target.value)}
                    >
                        {['3x3','2x2','4x4','5x5','6x6','7x7'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="basis-4/5 px-4">
                    <span className="mr-2 font-bold">Session:</span>
                    <select 
                        className="bg-[#2d4870] border border-white/30 px-2 py-1 rounded text-white outline-none" 
                        value={session} 
                        onChange={(e) => setSession(e.target.value)}
                    >
                        {Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                    </select>
                </div>
            </div>

            {/* --- SCRAMBLE --- */}
            <div className="py-6 text-center text-xl md:text-2xl font-mono px-4 wrap-break-word leading-relaxed min-h-[100px] flex items-center justify-center">
                {isLoaded ? scramble : "Loading..."}
            </div>

            {/* --- CONTENT --- */}
            <div className="flex flex-col md:flex-row h-[calc(100vh-200px)] border-t border-white/20">
                
                {/* LEFT: Clickable Time List */}
                <div className="basis-1/6 border-r border-white/20 overflow-y-auto bg-[#3b5d8f]/50 text-sm">
                    <div className="p-2 text-center font-bold bg-[#2d4870] sticky top-0 z-10">Solves ({solves.length})</div>
                    <div className="flex flex-col-reverse p-2">
                        {solves.map((s, i) => (
                            <div 
                                key={s.id} 
                                onClick={() => setSelectedSolveId(s.id)}
                                className={`flex justify-between px-2 py-1 hover:bg-white/20 rounded cursor-pointer ${s.penalty === 'DNF' ? 'text-red-300' : ''}`}
                            >
                                <span className="text-white/60 w-8">{i + 1}.</span>
                                <span className="font-mono">{formatTime(s.time, s.penalty)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* MIDDLE: Timer Display */}
                <div className="basis-4/6 border-r border-white/20 flex flex-col justify-center items-center relative">
                    <div className={`text-[120px] font-mono font-bold select-none tabular-nums ${timerState === 'ready' ? 'text-green-400' : 'text-white'}`}>
                        {formatTime(timeDisplay)}
                    </div>
                    <div className="text-white/50 mt-4 text-lg">
                        {timerState === 'idle' && ""}
                        {timerState === 'ready' && ""}
                        {timerState === 'running' && ""}
                    </div>
                </div>

                {/* RIGHT: Stats and Cube display */}
                <div className="basis-1/6 overflow-y-auto bg-[#3b5d8f]/50 p-4 text-sm font-mono">
                    <h3 className="text-center font-bold mb-4 border-b border-white/20 pb-2">Session Stats</h3>
                    
                    <StatRow label="Best" value={stats.best} />
                    <StatRow label="Ao5" value={stats.ao5} />
                    <StatRow label="Ao12" value={stats.ao12} />
                    <StatRow label="Ao50" value={stats.ao50} />
                    <StatRow label="Ao100" value={stats.ao100} />
                    
                    <div className="my-4 border-t border-white/20"></div>
                    
                    <StatRow label="Mean" value={stats.mean} />
                    <StatRow label="Std Dev" value={stats.stdDev} />
                    
                    <div className="mt-8 text-center">
                        <button 
                            onClick={() => { if(confirm("Clear this session?")) setSolves([]); }}
                            className="bg-red-500/80 hover:bg-red-600 text-white px-3 py-1 rounded text-xs transition"
                        >
                            Reset Session
                        </button>
                    </div>

                    {/* Cube Display */}
                    <div className='my-8 bg-white'>
                        <Cube2d cube={cube}  />
                    </div>
                </div>

                <div>

                </div>

            </div>

        </div>
    )
}

function StatRow({ label, value }: { label: string, value: number }) {
    if (value === 0 && label !== "Best") return null; 
    return (
        <div className="flex justify-between mb-2">
            <span className="text-white/70">{label}:</span>
            <span className="font-bold">{value === 0 && label === 'Best' ? '-' : formatTime(value)}</span>
        </div>
    );
}