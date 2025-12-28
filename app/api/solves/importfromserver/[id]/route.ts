import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import postgres from 'postgres';

const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD } = process.env;

const sql = postgres({
  host: PGHOST,
  database: PGDATABASE,
  username: PGUSER,
  password: PGPASSWORD,
  port: 5432,
  ssl: 'require',
});


export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> } 
) {

    const { id } = await params;
    
    const sessionId = parseInt(id);

    if (isNaN(sessionId)) {
         return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
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

        const solves = await sql`
            SELECT * FROM solves 
            WHERE cuber_id = ${cuberId} 
            AND session_id = ${sessionId}
            ORDER BY created_at DESC 
            LIMIT 50
        `;

        return NextResponse.json({
            solves: solves
        });

    } catch (error) {
        console.error("Database error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}