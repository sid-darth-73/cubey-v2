"use client"

import { useState, useEffect, useRef, useCallback } from 'react';
import { generateScramble, applyScramble } from 'react-rubiks-cube-utils';
import Cube2d from '../utils/Cube2d'

// --- Types ---
type TimerState = 'idle' | 'ready' | 'running';
type Penalty = '' | '+2' | 'DNF';

interface Solve {
    id: string;
    time: number;
    penalty: Penalty;
    scramble: string;
    comment: string;
    timestamp: number;
}

// --- Helper: Format ms to mm:ss.cc ---
const formatTime = (ms: number, penalty: Penalty = '') => {
    if (penalty === 'DNF') return 'DNF';
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

// --- Helper: Calculate Statistics ---
const calculateStats = (solves: Solve[]) => {
    const validSolves = solves.map(s => {
        if (s.penalty === 'DNF') return Infinity;
        if (s.penalty === '+2') return s.time + 2000;
        return s.time;
    });

    const nonDnfSolves = validSolves.filter(t => t !== Infinity);
    const best = nonDnfSolves.length > 0 ? Math.min(...nonDnfSolves) : 0;

    const getAvg = (n: number) => {
        if (validSolves.length < n) return 0;
        const subset = validSolves.slice(-n);
        const dnfCount = subset.filter(t => t === Infinity).length;
        if (dnfCount > 1) return 0;
        
        subset.sort((a, b) => a - b);
        const trimmed = subset.slice(1, -1);
        const sum = trimmed.reduce((a, b) => a + b, 0);
        return sum / trimmed.length;
    };

    const sum = nonDnfSolves.reduce((a, b) => a + b, 0);
    const mean = nonDnfSolves.length > 0 ? sum / nonDnfSolves.length : 0;
    const variance = nonDnfSolves.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / nonDnfSolves.length;
    const stdDev = Math.sqrt(variance || 0);

    return { best, mean, stdDev, ao5: getAvg(5), ao12: getAvg(12), ao50: getAvg(50), ao100: getAvg(100) };
};

export default function Timer() {
    // --- Settings State ---
    const [cubetype, setCubetype] = useState<string>("3x3");
    const [session, setSession] = useState<string>("1");
    const [scramble, setScramble] = useState<string>("");
    const [prevscramble, setPrevscramble] = useState<string>("");
    
    // --- Timer Logic State ---
    const [timerState, setTimerState] = useState<TimerState>('idle');
    const [timeDisplay, setTimeDisplay] = useState<number>(0);
    const [checkState, setCheckState] = useState<boolean>(false);
    
    // --- Data State ---
    const [solves, setSolves] = useState<Solve[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // --- Modal State ---
    const [selectedSolveId, setSelectedSolveId] = useState<string | null>(null);

    // Refs
    const timerStateRef = useRef<TimerState>('idle');
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);

    // : Create a ref to track solves without triggering re-renders in the event listener
    const solvesRef = useRef(solves);

    // : Keep the ref synced with the state
    useEffect(() => {
        solvesRef.current = solves;
    }, [solves]);

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

        const sessionKey = `session_v2_${session}`; 
        const storedData = localStorage.getItem(sessionKey);
        if (storedData) {
            try { setSolves(JSON.parse(storedData)); } catch (e) { setSolves([]); }
        } else { setSolves([]); }
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
            id: Date.now().toString(),
            time: finalTime,
            penalty: '',
            scramble: scramble,
            comment: scramble,
            timestamp: Date.now()
        };
        setSolves(prev => [...prev, newSolve]);
        setPrevscramble((curr)=>scramble)
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
            // Disable inputs if modal is open
            if(selectedSolveId) return; 

            // 1. Spacebar Logic (Timer)
            if (e.code === "Space") {
                if(timerStateRef.current !== 'running') e.preventDefault(); 
                if (timerStateRef.current === 'running') stopTimer();
                else if (timerStateRef.current === 'idle') readyTimer();
            }

            // 2. SHORTCUT: Option/Alt + Z to delete last solve
            if (e.altKey && (e.code === "KeyZ" || e.key === 'z')) {
                e.preventDefault();
                // Only allow deletion if timer is idle and there are solves
                if (timerStateRef.current === 'idle' && solves.length > 0) {
                    const lastSolve = solves[solves.length - 1];
                    // Simple confirmation
                    if (confirm(`Delete last solve (${formatTime(lastSolve.time, lastSolve.penalty)})?`)) {
                        setSolves(prev => prev.slice(0, -1)); // Remove the last item
                    }
                }
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
    }, [readyTimer, startTimer, stopTimer, selectedSolveId, solves]); // Added 'solves' to dependency array


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
        <div className="bg-blue-950 h-screen flex flex-col text-white font-sans relative overflow-hidden">
            
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
            <div className="shrink-0 border-b border-white/20 py-1 flex items-center bg-[#3b5d8f]">
                <div className="basis-1/5 px-4">
                    <span className="mr-2 font-bold hidden md:inline">Type:</span>
                    <select 
                        className="bg-[#2d4870] border border-white/30 px-2 py-1 rounded text-white outline-none w-full md:w-auto" 
                        value={cubetype} 
                        onChange={(e) => setCubetype(e.target.value)}
                    >
                        {['3x3','2x2','4x4','5x5','6x6','7x7'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="basis-4/5 px-4">
                    <span className="mr-2 font-bold hidden md:inline">Session:</span>
                    <select 
                        className="bg-[#2d4870] border border-white/30 px-2 py-1 rounded text-white outline-none w-full md:w-auto" 
                        value={session} 
                        onChange={(e) => setSession(e.target.value)}
                    >
                        {Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                    </select>
                </div>
            </div>

            {/* --- SCRAMBLE --- */}
            <div className="shrink-0 py-6 text-center font-mono px-4 wrap-break-word leading-relaxed min-h-[100px] flex items-center justify-center">
                <div className='mx-4 text-xl md:text-3xl'> {isLoaded ? scramble : "Loading..."} </div>

                <span className='text-gray-400 cursor-pointer' onClick={()=>{
                    if (prevscramble.length > 0){
                        setScramble(curr => prevscramble)
                        setPrevscramble(curr => "")
                    }
                }}>prev/ </span>
                <span className='text-gray-400 cursor-pointer' onClick={()=>{
                    setPrevscramble(curr => scramble)
                    setScramble(generateScramble({ type: cubetype }))
                }}>next</span>
            </div>

            {/* --- CONTENT --- */}
            <div className="flex-1 flex flex-row min-h-0 border-t border-white/20">
                
                {/* LEFT: Clickable Time List */}
                <div className="basis-1/6 border-r border-white/20 overflow-y-auto bg-[#3b5d8f]/50 text-sm">
                    <div className="p-2 text-center font-bold bg-[#2d4870] sticky top-0 z-10">Solves</div>
                    <div className="flex flex-col-reverse p-2">
                        {solves.map((s, i) => (
                            <div 
                                key={s.id} 
                                onClick={() => setSelectedSolveId(s.id)}
                                className={`flex justify-between px-1 md:px-2 py-1 hover:bg-white/20 rounded cursor-pointer ${s.penalty === 'DNF' ? 'text-red-300' : ''}`}
                            >
                                <span className="text-white/60 w-6 md:w-8">{i + 1}.</span>
                                <span className="font-mono">{formatTime(s.time, s.penalty)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* MIDDLE: Timer Display */}
                <div className="basis-4/6 border-r border-white/20 flex flex-col justify-center items-center relative overflow-hidden">
                    <div className={`text-6xl md:text-[120px] font-mono font-bold select-none tabular-nums ${timerState === 'ready' ? 'text-green-400' : 'text-white'}`}>
                        {formatTime(timeDisplay)}
                    </div>
                    <div className="text-white/50 mt-4 text-lg">
                        {timerState === 'idle' && ""}
                        {timerState === 'ready' && ""}
                        {timerState === 'running' && ""}
                    </div>
                </div>

                {/* RIGHT: Stats and Cube display */}
                <div className="basis-1/6 overflow-y-auto bg-[#3b5d8f]/50 p-2 md:p-4 text-xs md:text-sm font-mono">
                    <h3 className="text-center font-bold mb-4 border-b border-white/20 pb-2">Stats</h3>
                    
                    <StatRow label="Best" value={stats.best} />
                    <StatRow label="Ao5" value={stats.ao5} />
                    <StatRow label="Ao12" value={stats.ao12} />
                    <StatRow label="Ao50" value={stats.ao50} />
                    <StatRow label="Ao100" value={stats.ao100} />
                    
                    <div className="my-4 border-t border-white/20"></div>
                    
                    <StatRow label="Mean" value={stats.mean} />
                    <StatRow label="SD" value={stats.stdDev} />
                    
                    <div className="mt-8 text-center">
                        <button 
                            onClick={() => { if(confirm("Clear this session?")) setSolves([]); }}
                            className="bg-red-500/80 hover:bg-red-600 text-white px-2 py-1 rounded text-[10px] md:text-xs transition"
                        >
                            Reset
                        </button>
                    </div>

                    <div className='my-8 bg-white hidden md:block'>
                        <button className='text-gray-400 text-center w-full' onClick={()=>{ setCheckState((prev)=> !prev) }}>State</button>
                        {checkState && <Cube2d cube={cube}  />}
                    </div>
                </div>

            </div>

        </div>
    )
}

function StatRow({ label, value }: { label: string, value: number }) {
    if (value === 0 && label !== "Best") return null; 
    return (
        <div className="flex flex-col xl:flex-row justify-between mb-2">
            <span className="text-white/70">{label}:</span>
            <span className="font-bold">{value === 0 && label === 'Best' ? '-' : formatTime(value)}</span>
        </div>
    );
}