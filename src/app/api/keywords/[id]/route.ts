import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
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
    const { enabled, prevent_duplicates } = body;

    try {
        if (enabled !== undefined) {
            db.prepare('UPDATE keywords SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
        }
        if (prevent_duplicates !== undefined) {
            db.prepare('UPDATE keywords SET prevent_duplicates = ? WHERE id = ?').run(prevent_duplicates ? 1 : 0, id);
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update keyword' }, { status: 500 });
    }
}
