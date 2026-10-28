-- 0033: Allow fast ordinary signup, sign-in, and owner onboarding without MFA.
-- SECURITY: Never alter MFA requirements on existing organizations automatically.
-- Explicitly enrolled accounts continue to use TOTP and backup-code verification;
-- high-risk privileged actions still require fresh MFA step-up where prescribed.
ALTER TABLE public.organizations ALTER COLUMN mfa_required SET DEFAULT false;
