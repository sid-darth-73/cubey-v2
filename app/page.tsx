"use client"
import Image from "next/image";
import Link from "next/link";
import Timer from "./Timer";
import { Solve } from "@/types/SolveType";

// async function handleJoin() {
//   let solves: Solve[] = [];
//   for(let i = 1; i <= 10; i++) {
//     if(!localStorage.getItem(`session_v2_${i}`)) {
//       continue
//     }
//     //@ts-ignore
//     const solves_in_session_i = JSON.parse(localStorage.getItem(`session_v2_${i}`));
//     for(const solve in solves_in_session_i) {
//       //@ts-ignore
//       solves += solve
//     }
//   }

//   const response = await fetch('/api/solves/exporttoserver', {
//     method: 'POST', 
//     headers: {
//       'Content-Type': 'application/json'
//     },
//     body: JSON.stringify(solves)
//   });
// }
export default function Home() {
  return (
    <div >
      {/* top naviagation for join and signup */}
      <div className="min-h-12 bg-[#222222] flex"> 
          <nav className="w-full px-6 py-4 bg-[#222222] text-white">
            <div className="flex items-center justify-end">

              <ul className="flex gap-6">
                <li>
                  <Link 
                      className="hover:text-blue-400 border m-2 px-2 py-1" 
                      href="/in/home"
                    >
                      Join
                    </Link>
              </li>
                <li><a className="hover:text-blue-400" href="/about">Learn</a></li>
              </ul>
            </div>
          </nav>
      </div>

      {/* Timer */}
      <div className="h-screen bg-[#4A70A9]">
        <Timer/>
      </div>
    </div>
  );
}
