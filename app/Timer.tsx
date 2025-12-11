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
    const solvesRef = useRef(solves);

    useEffect(() => { solvesRef.current = solves; }, [solves]);
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
            if(selectedSolveId) return; 

            if (e.code === "Space") {
                if(timerStateRef.current !== 'running') e.preventDefault(); 
                if (timerStateRef.current === 'running') stopTimer();
                else if (timerStateRef.current === 'idle') readyTimer();
            }
            
            const alpha = ['w','x','c','v','b','n','m','a','s','d','f','g','h','j','k','l'];
            if (alpha.includes(e.key.toLowerCase())) {
                if (timerStateRef.current === 'running') stopTimer();
            }

            if (e.altKey && (e.code === "KeyZ" || e.key === 'z')) {
                e.preventDefault();
                if (timerStateRef.current === 'idle' && solves.length > 0) {
                    const lastSolve = solves[solves.length - 1];
                    if (confirm(`Delete last solve (${formatTime(lastSolve.time, lastSolve.penalty)})?`)) {
                        setSolves(prev => prev.slice(0, -1));
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
    }, [readyTimer, startTimer, stopTimer, selectedSolveId, solves]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (selectedSolveId) return;
        if (e.pointerType !== 'touch') return;

        // Prevent scrolling while holding timer
        if (timerStateRef.current !== 'running') e.preventDefault();
        
        if (timerStateRef.current === 'running') stopTimer();
        else if (timerStateRef.current === 'idle') readyTimer();
    }, [selectedSolveId, readyTimer, stopTimer]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (selectedSolveId) return;
        if (e.pointerType !== 'touch') return;

        if (timerStateRef.current === 'ready') startTimer();
        else if (timerStateRef.current === 'idle') setTimerState('idle');
    }, [selectedSolveId, startTimer]);

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

    // CSS class to dim UI when timer is active
    const dimUI = timerState === 'ready' || timerState === 'running' ? ' pointer-events-none' : '';

    return (
        <div className="bg-blue-950 h-screen flex flex-col text-white font-sans relative overflow-hidden">
            
            {/* --- DETAILS MODAL (Adjusted for mobile centering) --- */}
            {selectedSolveId && selectedSolve && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#2d4870] border border-white/20 p-6 rounded-lg w-full max-w-md shadow-2xl flex flex-col gap-4">
                        <h2 className="text-4xl font-mono font-bold text-center">
                            {formatTime(selectedSolve.time, selectedSolve.penalty)}
                        </h2>
                        
                        <div className="flex justify-center gap-4">
                            <button 
                                onClick={() => updateSolve(selectedSolve.id, { penalty: selectedSolve.penalty === '+2' ? '' : '+2' })}
                                className={`flex-1 py-3 rounded border text-lg font-bold ${selectedSolve.penalty === '+2' ? 'bg-yellow-600 border-yellow-400' : 'border-white/20 hover:bg-white/10'}`}
                            >
                                +2
                            </button>
                            <button 
                                onClick={() => updateSolve(selectedSolve.id, { penalty: selectedSolve.penalty === 'DNF' ? '' : 'DNF' })}
                                className={`flex-1 py-3 rounded border text-lg font-bold ${selectedSolve.penalty === 'DNF' ? 'bg-red-600 border-red-400' : 'border-white/20 hover:bg-white/10'}`}
                            >
                                DNF
                            </button>
                            <button 
                                onClick={() => deleteSolve(selectedSolve.id)}
                                className="flex-1 py-3 rounded border border-red-500 text-red-300 hover:bg-red-500/20"
                            >
                                Del
                            </button>
                        </div>

                        <div>
                            <label className="block text-sm text-white/60 mb-1">Comment</label>
                            <textarea 
                                className="w-full bg-[#1e3454] border border-white/20 rounded p-2 text-sm font-mono h-20"
                                value={selectedSolve.comment}
                                onChange={(e) => updateSolve(selectedSolve.id, { comment: e.target.value })}
                            />
                        </div>

                        <button 
                            onClick={() => setSelectedSolveId(null)}
                            className="bg-white/20 hover:bg-white/30 py-3 rounded text-lg"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* --- HEADER --- */}
            <div className={`shrink-0 border-b border-white/20 py-2 flex items-center justify-between bg-[#3b5d8f] transition-opacity duration-200 ${dimUI}`}>
                <div className="flex-1 px-2">
                    <select 
                        className="bg-[#2d4870] border border-white/30 px-4 py-1 rounded text-white outline-none  text-center" 
                        value={cubetype} 
                        onChange={(e) => setCubetype(e.target.value)}
                    >
                        {['3x3','2x2','4x4','5x5','6x6','7x7'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="flex-1 px-2">
                    <select 
                        className="bg-[#2d4870] border border-white/30 px-4 py-1 rounded text-white outline-none text-center" 
                        value={session} 
                        onChange={(e) => setSession(e.target.value)}
                    >
                        {Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>Session {i + 1}</option>)}
                    </select>
                </div>
            </div>

            {/* --- SCRAMBLE --- */}
            <div className={`shrink-0 py-4 text-center px-4 leading-relaxed flex flex-col items-center justify-center transition-opacity duration-200 ${dimUI}`}>
                <div className='flex items-center'> 
                    <div className='font-mono mx-2 text-xl md:text-3xl min-h-12'>{isLoaded ? scramble : "Loading..."} </div>
                    <div className="flex gap-2 mt-2 ">
                        <button className='text-gray-400 hover:text-white px-4 py-2 bg-white/5 rounded cursor-pointer' onClick={()=>{
                            if (prevscramble.length > 0){
                                setScramble(curr => prevscramble)
                                setPrevscramble(curr => "")
                            }
                        }}>Prev</button>
                        
                        <button className='text-gray-400 hover:text-white px-4 py-2 bg-white/5 rounded cursor-pointer' onClick={()=>{
                            setPrevscramble(curr => scramble)
                            setScramble(generateScramble({ type: cubetype }))
                        }}>Next</button>
                    </div>
                    
                </div>

                
            </div>

            {/* --- CONTENT (Layout: Vertical on Mobile, Row on Desktop) --- */}
            <div className="flex-1 flex flex-col md:flex-row min-h-0 border-t border-white/20 overflow-y-auto md:overflow-hidden">
                
                {/* MIDDLE: Timer (Moved to top for mobile, middle for desktop) */}
                {/* order-1 puts it first on mobile */}
                <div
                    className="order-1 md:order-2 grow md:basis-4/6 border-b md:border-b-0 md:border-r border-white/20 flex flex-col justify-center items-center relative overflow-hidden min-h-[50vh] md:min-h-auto"
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    style={{ touchAction: 'none' }} // Prevents browser zoom/scroll while touching
                >
                    <div className={`text-7xl md:text-[120px] font-mono font-bold select-none tabular-nums ${timerState === 'ready' ? 'text-green-400' : 'text-white'}`}>
                        {formatTime(timeDisplay)}
                    </div>
                   
                </div>

                {/* LEFT: Solves List (Moved below timer on mobile) */}
                <div className={`order-2 md:order-1 h-64 md:h-auto md:basis-1/6 border-b md:border-b-0 md:border-r border-white/20 overflow-y-auto bg-[#3b5d8f]/50 text-sm transition-opacity duration-200 ${dimUI}`}>
                    <div className="p-2 text-center font-bold bg-[#2d4870] sticky top-0 z-10">Solves ({solves.length})</div>
                    <div className="flex flex-col-reverse p-2 gap-1">
                        {solves.map((s, i) => (
                            <div 
                                key={s.id} 
                                onClick={() => setSelectedSolveId(s.id)}
                                className={`flex justify-between px-3 py-2 md:py-1 hover:bg-white/20 rounded cursor-pointer ${s.penalty === 'DNF' ? 'text-red-300' : ''}`}
                            >
                                <span className="text-white/60 w-8">{i + 1}.</span>
                                <span className="font-mono text-base md:text-sm">{formatTime(s.time, s.penalty)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT: Stats and Cube display */}
                <div className={`order-3 h-auto md:h-auto md:basis-1/6 overflow-y-auto bg-[#3b5d8f]/50 p-4 text-sm font-mono transition-opacity duration-200 ${dimUI}`}>
                    <h3 className="text-center font-bold mb-4 border-b border-white/20 pb-2">Stats</h3>
                    
                    <StatRow label="Ao5" value={stats.ao5} />
                    <StatRow label="Ao12" value={stats.ao12} />
                    <StatRow label="Ao50" value={stats.ao50} />
                    <StatRow label="Ao100" value={stats.ao100} />
                    <StatRow label="Best" value={stats.best} />
                    
                    <div className="my-4 border-t border-white/20"></div>
                    
                    <StatRow label="Mean" value={stats.mean} />
                    <StatRow label="SD" value={stats.stdDev} />
                    
                    <div className="mt-8 text-center pb-8 md:pb-0 ">
                        <button 
                            onClick={() => { if(confirm("Clear this session?")) setSolves([]); }}
                            className="bg-red-500/80 hover:bg-red-600 text-white px-4 py-2 rounded text-xs uppercase tracking-widest transition cursor-pointer"
                        >
                            Reset Session
                        </button>
                    </div>

                    <div className='my-8 bg-white/10 rounded p-2 hidden md:block'>
                        <button className='text-white/50 hover:text-white text-center w-full text-xs cursor-pointer' onClick={()=>{ setCheckState((prev)=> !prev) }}>
                            {checkState ? "Hide Cube State" : "Show Cube State"}
                        </button>
                        {checkState && <div className="mt-2"><Cube2d cube={cube}  /></div>}
                    </div>
                </div>

            </div>

        </div>
    )
}

function StatRow({ label, value }: { label: string, value: number }) {
    if (value === 0 && label !== "Best") return null; 
    return (
        <div className="flex justify-between mb-2 items-end">
            <span className="text-white/70 text-xs uppercase tracking-wide">{label}:</span>
            <span className="font-bold text-lg md:text-base">{value === 0 && label === 'Best' ? '-' : formatTime(value)}</span>
        </div>
    );
}