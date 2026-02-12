import { InferSelectModel } from 'drizzle-orm';
import { schedules, records } from '@/lib/schema';

export type Schedule = InferSelectModel<typeof schedules> & {
    status: 'pending' | 'processing' | 'completed' | 'failed';
};

export type Record = InferSelectModel<typeof records>;
