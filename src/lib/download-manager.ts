export interface DownloadJob {
    id: string;
    stationId: string;
    title: string;
    progress: number; // 0-100
    status: 'pending' | 'downloading' | 'processing' | 'completed' | 'failed';
    error?: string;
    startTime: Date;
}

class DownloadManager {
    private jobs: Map<string, DownloadJob> = new Map();
    private retentionPeriodMs = 60 * 1000; // Keep completed jobs for 1 minute

    createJob(stationId: string, title: string): string {
        const id = crypto.randomUUID();
        const job: DownloadJob = {
            id,
            stationId,
            title,
            progress: 0,
            status: 'pending',
            startTime: new Date()
        };
        this.jobs.set(id, job);
        return id;
    }

    updateProgress(id: string, progress: number) {
        const job = this.jobs.get(id);
        if (job) {
            job.progress = progress;
            job.status = 'downloading';
            if (progress >= 99) {
                job.status = 'processing';
            }
        }
    }

    completeJob(id: string) {
        const job = this.jobs.get(id);
        if (job) {
            job.progress = 100;
            job.status = 'completed';
            this.scheduleCleanup(id);
        }
    }

    failJob(id: string, error: string) {
        const job = this.jobs.get(id);
        if (job) {
            job.status = 'failed';
            job.error = error;
            this.scheduleCleanup(id);
        }
    }

    getJobs(): DownloadJob[] {
        return Array.from(this.jobs.values()).sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    }

    private scheduleCleanup(id: string) {
        setTimeout(() => {
            this.jobs.delete(id);
        }, this.retentionPeriodMs);
    }
}

const globalForDownloadManager = global as unknown as { downloadManager: DownloadManager };

export const downloadManager = globalForDownloadManager.downloadManager || new DownloadManager();

if (process.env.NODE_ENV !== 'production') globalForDownloadManager.downloadManager = downloadManager;
