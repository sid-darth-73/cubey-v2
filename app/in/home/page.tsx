"use client"

import { useEffect, useState } from "react";

type Solve = {
    id: string;
    time: number;
    type: string;      // "3x3" | "4x4" etc (can be union later)
    penalty: string;   // "", "+2", "DNF"
    scramble: string;
    comment: string;
    timestamp: number;
};


function getSolvesFromLocalStorage(){
    const raw = localStorage.getItem('session_v2_1');
    if(!raw){
        return [];
    }

    let parsed: unknown;

    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error("Invalid JSON in localStorage");
    }

    if (!Array.isArray(parsed)) {
        throw new Error("Expected array of solves");
    }

    return parsed as Solve[];
}

async function exportSolves(){
    const solves = getSolvesFromLocalStorage();
    if(solves.length === 0) {
        return;
    }

    const payload = solves.map(s => ({
        solve_id: s.id,
        time_ms: s.time,
        cube_type: s.type,
        penalty: s.penalty || null,
        scramble: s.scramble,
        comment: s.comment || null,
        solved_at: new Date(s.timestamp)
    }));

    await fetch("/api/solves/exporttoserver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
}

async function addUserToserver(){
    await fetch("/api/user/add", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });
}

export default function Home() {
    //const { userId } = await auth()
    const [add, setAdd] = useState("not");
    
    //const user = await currentUser()
    useEffect(()=>{
        addUserToserver();
        exportSolves();
        //console.log(object)
        localStorage.removeItem("session_v2_1");
        setAdd("done");
    }, [])

    return (
        <div>
            /in/home
            
            <br />
            {add}
        </div>
    )
}
