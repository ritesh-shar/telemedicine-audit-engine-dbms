# PostgreSQL development seed data

## Seed doctor accounts

The doctor dataset is in
[`database/postgres/seeds/020_doctors.sql`](../database/postgres/seeds/020_doctors.sql).
It creates 20 doctor accounts across 10 specializations and is safe to rerun.

From WSL, run:

```bash
cd /mnt/c/Users/rithi/telemedicine-audit-engine-dbms

export DATABASE_URL='postgresql://postgres:<your-password>@127.0.0.1:5432/telemedicine_db'

psql "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f database/postgres/seeds/020_doctors.sql
```

All seeded doctors use:

```text
Password: DoctorPass123!
```

Example login:

```text
Email: aisha.khan@telemed.test
Password: DoctorPass123!
```

Do not use these development credentials in production.
