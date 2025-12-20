import { NextResponse } from 'next/server';
import postgres from 'postgres';


let { PGHOST, PGDATABASE, PGUSER, PGPASSWORD } = process.env;


const conn = postgres({
  host: PGHOST,
  database: PGDATABASE,
  username: PGUSER,
  password: PGPASSWORD,
  port: 5432,
  ssl: 'require',
});

function selectAll() {
  return conn`SELECT * FROM playing_with_neon`;
}

export async function GET() {
    const res = await selectAll();
    //const data = await res.json();

    return NextResponse.json({
        message: "hello from test route",
        data: res
    })
}


