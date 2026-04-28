import { RadikoClient } from '../radiko';

// Mock global fetch
global.fetch = jest.fn();

describe('RadikoClient', () => {
    let client: RadikoClient;

    const mockResponse = (ok: boolean, text: string, json: any = {}) => ({
        ok,
        text: async () => text,
        json: async () => json,
        headers: {
            get: (key: string) => {
                if (key.toLowerCase() === 'x-radiko-authtoken') return 'test-token';
                if (key.toLowerCase() === 'x-radiko-keylength') return '16';
                if (key.toLowerCase() === 'x-radiko-keyoffset') return '0';
                return null;
            }
        }
    });

    beforeEach(() => {
        client = new RadikoClient();
        (global.fetch as jest.Mock).mockClear();
        // Default mock
        (global.fetch as jest.Mock).mockResolvedValue(mockResponse(true, ''));
    });

    describe('getProgramSchedule', () => {
        it('should parse program schedule correctly', async () => {
            const mockXml = `
                <radiko>
                    <stations>
                        <station id="TBS">
                            <scd>
                                <progs>
                                    <prog ft="20240201120000" to="20240201130000" dur="3600">
                                        <title>Test Program</title>
                                        <pfm>Test Performer</pfm>
                                        <desc>Test Description</desc>
                                    </prog>
                                </progs>
                            </scd>
                        </station>
                    </stations>
                </radiko>
            `;

            (global.fetch as jest.Mock).mockResolvedValue(mockResponse(true, mockXml));

            const programs = await client.getProgramSchedule('TBS', '20240201');

            expect(programs).toHaveLength(1);
            expect(programs[0].title).toBe('Test Program');
            expect(programs[0].start_time).toBe('2024-02-01 12:00:00');
        });

        it('should return empty array if no programs found', async () => {
            const mockXml = `
                <radiko>
                    <stations>
                        <station id="TBS">
                            <scd>
                                <progs>
                                </progs>
                            </scd>
                        </station>
                    </stations>
                </radiko>
            `;

            (global.fetch as jest.Mock).mockResolvedValue(mockResponse(true, mockXml));

            const programs = await client.getProgramSchedule('TBS', '20240201');
            expect(programs).toEqual([]);
        });
    });

    describe('getStations', () => {
        it('should parse station list correctly', async () => {
            const mockXml = `
                <region>
                    <stations>
                        <station>
                            <id>TBS</id>
                            <name>TBS Radio</name>
                        </station>
                        <station>
                            <id>QRR</id>
                            <name>Bunka Hoso</name>
                        </station>
                    </stations>
                </region>
            `;

            (global.fetch as jest.Mock).mockResolvedValue(mockResponse(true, mockXml));

            const stations = await client.getStations();
            expect(stations).toHaveLength(2);
            expect(stations[0]).toEqual({ id: 'TBS', name: 'TBS Radio' });
            expect(stations[1]).toEqual({ id: 'QRR', name: 'Bunka Hoso' });
        });
    });
});
