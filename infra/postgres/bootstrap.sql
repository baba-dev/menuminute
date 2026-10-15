-- Run as the database administrator BEFORE db:migrate. Set login password separately through a
-- secret-bearing administrator session; never store it in SQL, shell history or releases.
CREATE ROLE menuminute_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
-- Database/schema objects are owned by a separate migration account. Do not grant that role to app.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
