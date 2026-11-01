-- One-use TOTP time steps for administrator and owner step-up.
-- Separate from native Better Auth challenge state to preserve login/enrollment.
CREATE TABLE auth_totp_consumed (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_step bigint NOT NULL CHECK(last_step >= 0)
);
REVOKE ALL ON auth_totp_consumed FROM PUBLIC, menuminute_app, menuminute_worker;
GRANT SELECT, INSERT, UPDATE ON auth_totp_consumed TO menuminute_app;
