import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import postgres from 'postgres';
import { Solve } from '@/types/SolveType';

const sql = postgres({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  username: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  port: 5432,
  ssl: 'require',
});


export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        
        if (!Array.isArray(body) || body.length === 0) {
            return NextResponse.json({ message: "No solves to sync" }, { status: 200 });
        }
        
        const solves = body as Solve[];

        const cuberResult = await sql`
            SELECT id FROM cuber WHERE clerk_id = ${userId} LIMIT 1
        `;

        let cuberId: number;

        if (cuberResult.length === 0) {
            const newUser = await sql`
                INSERT INTO cuber (clerk_id) VALUES (${userId}) RETURNING id
            `;
            cuberId = newUser[0].id;
        } else {
            cuberId = cuberResult[0].id;
        }

        // Prepare Data for Bulk Insert
        // We map the incoming JSON to the exact column names expected by Postgres.js
        const cleanData = solves.map((s) => ({
            cuber_id: cuberId,
            time: s.time,         
            type: s.type,
            scramble: s.scramble,
            penalty: s.penalty || "", 
            comment: s.comment || "",
            session_id: s.session,            // DEFAULTED: Schema requires it, but frontend se abhi test ke liye 1 hi bheja hai
            created_at: s.timestamp
        }));

        // 6. Bulk Insert
        // Postgres.js handles the bulk insert syntax automatically when you pass an array of objects
        await sql`
            INSERT INTO solves ${ sql(cleanData) }
        `;

        return NextResponse.json({ 
            success: true, 
            count: cleanData.length 
        });

    } catch (error) {
        console.error("Export Error:", error);
        
        // Check for common integer overflow error
        if ((error as any).code === '22003') { // Postgres code for numeric value out of range
             return NextResponse.json({ 
                error: "Time value too large for database. Please upgrade column to INT4." 
            }, { status: 500 });
        }

        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}