export interface Schedule {
    id: number;
    station_id: string;
    start_time: string;
    duration: number;
    title?: string;
    recurring_pattern?: string;
    day_of_week?: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    created_at: string;
}

export interface Record {
    id: number;
    filename: string;
    station_id: string;
    title?: string;
    start_time: string;
    duration: number;
    file_path: string;
    size: number;
    created_at: string;
}
