import { RadikoClient } from '../radiko';

// Mock global fetch
global.fetch = jest.fn();

describe('RadikoClient', () => {
    let client: RadikoClient;

    beforeEach(() => {
        client = new RadikoClient();
        (global.fetch as jest.Mock).mockClear();
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

            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                text: async () => mockXml,
            });

            const programs = await client.getProgramSchedule('TBS', '20240201');

            expect(programs).toHaveLength(1);
            expect(programs[0]).toEqual({
                title: 'Test Program',
                start_time: '2024-02-01 12:00:00', // Formatted
                end_time: '2024-02-01 13:00:00',   // Formatted
                display_time: '12:00',
                station_id: 'TBS',
                performer: 'Test Performer',
                description: 'Test Description',
                status: 'future',
            });
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

            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                text: async () => mockXml,
            });

            const programs = await client.getProgramSchedule('TBS', '20240201');
            expect(programs).toEqual([]);
        });
    });

    describe('getStations', () => {
        it('should parse station list correctly', async () => {
            const mockXml = `
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
            `;

            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                text: async () => mockXml,
            });

            const stations = await client.getStations();
            expect(stations).toHaveLength(2);
            expect(stations[0].id).toBe('TBS');
            expect(stations[0].name).toBe('TBS Radio');
        });
    });
});
