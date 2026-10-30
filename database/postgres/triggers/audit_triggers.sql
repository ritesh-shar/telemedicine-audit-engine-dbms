-- Audit trigger for appointments
CREATE TRIGGER audit_appointments
AFTER INSERT OR UPDATE OR DELETE ON appointments
FOR EACH ROW
EXECUTE FUNCTION audit_record_changes();

-- Audit trigger for prescriptions
CREATE TRIGGER audit_prescriptions
AFTER INSERT OR UPDATE OR DELETE ON prescriptions
FOR EACH ROW
EXECUTE FUNCTION audit_record_changes();

-- Audit trigger for prescription items
CREATE TRIGGER audit_prescription_items
AFTER INSERT OR UPDATE OR DELETE ON prescription_items
FOR EACH ROW
EXECUTE FUNCTION audit_record_changes();
