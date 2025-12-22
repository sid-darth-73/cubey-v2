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

export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const result = await sql`
            INSERT INTO cuber (clerk_id) 
            VALUES (${userId}) 
            ON CONFLICT (clerk_id) DO UPDATE 
            SET clerk_id = EXCLUDED.clerk_id
            RETURNING id
        `;
        
        // result is an array: [{ id: 1 }]
        return NextResponse.json({ success: true, dbId: result[0].id });

    } catch (error) {
        console.error("Database Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}