-- ColdChain Pulse Data Integrity - Append-Only Triggers for PostgreSQL
-- Client: MedSwift Logistics Ltd.

-- 1. Prevent UPDATE or DELETE on telemetry_readings
CREATE OR REPLACE FUNCTION prevent_telemetry_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'TAMPER_ALERT: Telemetry readings are strictly append-only. UPDATE and DELETE operations are forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_telemetry_update_delete ON telemetry_readings;
CREATE TRIGGER trg_prevent_telemetry_update_delete
BEFORE UPDATE OR DELETE ON telemetry_readings
FOR EACH ROW
EXECUTE FUNCTION prevent_telemetry_modification();

-- 2. Prevent UPDATE or DELETE on chain_of_custody
CREATE OR REPLACE FUNCTION prevent_custody_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'TAMPER_ALERT: Chain of custody logs are strictly append-only. Corrections must be submitted as new records referencing supersedesId.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_custody_update_delete ON chain_of_custody;
CREATE TRIGGER trg_prevent_custody_update_delete
BEFORE UPDATE OR DELETE ON chain_of_custody
FOR EACH ROW
EXECUTE FUNCTION prevent_custody_modification();
