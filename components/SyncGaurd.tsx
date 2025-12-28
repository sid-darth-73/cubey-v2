"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Solve } from "@/types/SolveType";

export default function SyncGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(true);

  useEffect(() => {
    const syncData = async () => {
      let allSolves: Solve[] = [];
      
      for(let i = 1; i <= 10; i++) {
        const key = `session_v2_${i}`;
        const rawData = localStorage.getItem(key);
        
        if (rawData) {
          try {
            const parsed = JSON.parse(rawData);
            if (Array.isArray(parsed)) {
              allSolves.push(...parsed);
            }
          } catch (e) {
            console.error("JSON Parse error", e);
          }
        }
      }

      try {

        if (allSolves.length > 0) {
            const res = await fetch('/api/solves/exporttoserver', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(allSolves)
            });

            if (res.ok) {
                // Clear local only after safe export
                for (let i = 1; i <= 10; i++) {
                    localStorage.removeItem(`session_v2_${i}`);
                }
            } else {
                console.error("Export failed, keeping local data safe.");
            }
        }

        // IMPORT: Fetch latest 50 for ALL sessions in PARALLEL
        
        const importPromises = Array.from({ length: 10 }, (_, i) => i + 1).map(async (sessionId) => {
            try {
                const res = await fetch(`/api/solves/importfromserver/${sessionId}`);
                if (!res.ok) throw new Error(`Failed to fetch session ${sessionId}`);
                
                const data = await res.json();
                
                // DATA SAFETY: Ensure we strip the wrapper and stringify
                // API returns { solves: [...] }, localStorage needs "[...]"
                if (data.solves && Array.isArray(data.solves)) {
                    localStorage.setItem(
                        `session_v2_${sessionId}`, 
                        JSON.stringify(data.solves)
                    );
                }
            } catch (err) {
                console.warn(`Error syncing session ${sessionId}`, err);
            }
        });

        // Wait for all 10 requests to finish simultaneously
        await Promise.all(importPromises);

        // -- Refresh Server Components to show new DB state
        router.refresh();

      } catch (err) {
        console.error("Sync sequence failed", err);
      } finally {
        setIsSyncing(false);
      }
    };

    syncData();
  }, [router]);

  if (isSyncing) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#222222] text-white">
        <div className="animate-pulse flex flex-col items-center">
            <h2 className="text-xl font-bold mt-4">Syncing your solves...</h2>
            <p className="text-sm text-gray-400">Updating 10 sessions</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}