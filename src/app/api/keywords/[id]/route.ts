import { NextResponse } from 'next/server';
import { drizzleDb } from '@/lib/db';
import { keywords } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    // Await params if needed or just access
    const { id } = await params;

    try {
        drizzleDb.delete(keywords).where(eq(keywords.id, Number(id))).run();
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
        const updateData: Partial<typeof keywords.$inferInsert> = {};
        if (enabled !== undefined) updateData.enabled = enabled ? 1 : 0;
        if (prevent_duplicates !== undefined) updateData.prevent_duplicates = prevent_duplicates ? 1 : 0;

        if (Object.keys(updateData).length > 0) {
            drizzleDb.update(keywords)
                .set(updateData)
                .where(eq(keywords.id, Number(id)))
                .run();
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update keyword' }, { status: 500 });
    }
}
