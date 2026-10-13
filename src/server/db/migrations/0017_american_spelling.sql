-- Renamed in place, so playtests that already carry the value keep it.
ALTER TYPE "public"."playtest_status" RENAME VALUE 'cancelled' TO 'canceled';
