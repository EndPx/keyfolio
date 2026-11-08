// Server-side JSON-RPC proxy (KF-08b.2): the browser calls /api/rpc and this
// route forwards to the NEAR testnet RPC. Avoids browser CORS constraints
// and keeps the RPC URL server-side. Read-only usage only — this proxy does
// not add any authority.
import { NextResponse } from 'next/server';

const RPC_URL = process.env.NEXT_RPC_URL ?? 'https://rpc.fastnear.com';

export async function POST(request: Request) {
  const body = await request.text();
  try {
    const upstream = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const json = await upstream.json();
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json(
      { error: { message: String((err as Error).message ?? err).slice(0, 200) } },
      { status: 502 },
    );
  }
}
