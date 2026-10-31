DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'audit_appointments'
          AND tgrelid = 'appointments'::regclass
    ) THEN
        CREATE TRIGGER audit_appointments
        AFTER INSERT OR UPDATE OR DELETE ON appointments
        FOR EACH ROW
        EXECUTE FUNCTION audit_record_changes();
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'audit_prescriptions'
          AND tgrelid = 'prescriptions'::regclass
    ) THEN
        CREATE TRIGGER audit_prescriptions
        AFTER INSERT OR UPDATE OR DELETE ON prescriptions
        FOR EACH ROW
        EXECUTE FUNCTION audit_record_changes();
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'audit_prescription_items'
          AND tgrelid = 'prescription_items'::regclass
    ) THEN
        CREATE TRIGGER audit_prescription_items
        AFTER INSERT OR UPDATE OR DELETE ON prescription_items
        FOR EACH ROW
        EXECUTE FUNCTION audit_record_changes();
    END IF;
END;
$$;
