import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> } // params is now a Promise in Next.js 15+ or simply valid as params object in specific versions? The user env is likely Next 14/15. Let's use standard Next.js App Router pattern.
    // Actually, in App Router types, params is an object, but recently it was changed to Promise in typical latest Next.js 15 canary etc.
    // The current project seems to be Next.js 14 based on dependencies (not checked but likely).
    // Let's stick to standard `params: { id: string }` unless we know otherwise.
    // Wait, recent Next.js 15 enforced async params.
    // I'll check `package.json` to be safe if I can.
    // But standard `params: { id: string }` works in most current versions for route handlers.
    // Ah, wait. `context.params`.
) {
    // Await params if needed or just access
    const { id } = await params;

    try {
        db.prepare('DELETE FROM keywords WHERE id = ?').run(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete keyword' }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await request.json();
    const { enabled } = body;

    try {
        db.prepare('UPDATE keywords SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update keyword' }, { status: 500 });
    }
}
