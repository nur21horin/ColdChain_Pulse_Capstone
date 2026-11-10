import { TelemetryService, IngestReadingDTO } from './telemetry.service';
import { CustodyService, CreateCustodyHandoffDTO } from './custody.service';
import { TelemetryReadingRecord, CustodyRecord } from '../types';

export interface BatchTelemetrySyncResult {
  totalProcessed: number;
  newInserted: number;
  duplicatesSkipped: number;
  readings: TelemetryReadingRecord[];
}

export interface BatchCustodySyncResult {
  totalProcessed: number;
  newInserted: number;
  duplicatesSkipped: number;
  records: CustodyRecord[];
}

export class OfflineSyncService {
  /**
   * Idempotent batch ingestion for queued telemetry records
   */
  public static async syncTelemetryBatch(
    batch: IngestReadingDTO[]
  ): Promise<BatchTelemetrySyncResult> {
    const results: TelemetryReadingRecord[] = [];
    let newInserted = 0;
    let duplicatesSkipped = 0;

    // Process in chronological order based on recordedAt
    const sorted = [...batch].sort((a, b) => {
      const timeA = a.recordedAt ? new Date(a.recordedAt).getTime() : 0;
      const timeB = b.recordedAt ? new Date(b.recordedAt).getTime() : 0;
      return timeA - timeB;
    });

    for (const item of sorted) {
      const outcome = await TelemetryService.ingestReading(item);
      results.push(outcome.reading);
      if (outcome.isDuplicate) {
        duplicatesSkipped++;
      } else {
        newInserted++;
      }
    }

    return {
      totalProcessed: batch.length,
      newInserted,
      duplicatesSkipped,
      readings: results
    };
  }

  /**
   * Idempotent batch ingestion for queued chain-of-custody records
   */
  public static async syncCustodyBatch(
    batch: CreateCustodyHandoffDTO[]
  ): Promise<BatchCustodySyncResult> {
    const results: CustodyRecord[] = [];
    let newInserted = 0;
    let duplicatesSkipped = 0;

    const sorted = [...batch].sort((a, b) => {
      const timeA = a.recordedAt ? new Date(a.recordedAt).getTime() : 0;
      const timeB = b.recordedAt ? new Date(b.recordedAt).getTime() : 0;
      return timeA - timeB;
    });

    for (const item of sorted) {
      const outcome = await CustodyService.recordHandoff(item);
      results.push(outcome.record);
      if (outcome.isDuplicate) {
        duplicatesSkipped++;
      } else {
        newInserted++;
      }
    }

    return {
      totalProcessed: batch.length,
      newInserted,
      duplicatesSkipped,
      records: results
    };
  }
}
