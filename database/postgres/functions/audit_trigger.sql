CREATE OR REPLACE FUNCTION audit_record_changes()
RETURNS TRIGGER AS $$
DECLARE
    record_data JSONB;
    record_id UUID;
    current_user_id UUID;
    pk_column TEXT;
BEGIN
    -- Determine the primary key column
    pk_column := CASE TG_TABLE_NAME
        WHEN 'appointments' THEN 'appointment_id'
        WHEN 'prescriptions' THEN 'prescription_id'
        WHEN 'prescription_items' THEN 'item_id'
    END;

    -- Get the affected record
    IF TG_OP = 'DELETE' THEN
        record_data := to_jsonb(OLD);
    ELSE
        record_data := to_jsonb(NEW);
    END IF;

    record_id := (record_data ->> pk_column)::UUID;

    current_user_id := NULLIF(
        current_setting('app.current_user_id', TRUE), ''
    )::UUID;

    INSERT INTO auditlog (
        user_id, action, entity_type, entity_id,
        old_data, new_data
    )
    VALUES (
        current_user_id,
        TG_OP,
        TG_TABLE_NAME,
        record_id,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE')
             THEN to_jsonb(OLD) END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE')
             THEN to_jsonb(NEW) END
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
