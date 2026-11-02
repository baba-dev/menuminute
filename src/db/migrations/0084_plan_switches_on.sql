-- 0084: Turn the plan features on. The owner decided (pre-launch) that every plan switch ships enabled:
-- free order intake, hiding of dishes beyond the plan cap after the grace period, the automatic Ordering
-- trial, and the payment-retry grace. They stay owner-only settings, so any of them can still be switched
-- off with a single UPDATE (see docs/plans-and-limits.md). Caps and day counts keep their reviewed values.
-- Kitchen Pro is also a flat price for up to ten outlets: the catalog row is brought in line.
-- Forward-only.

ALTER TABLE app_private.plan_settings
  ALTER COLUMN free_intake_enabled SET DEFAULT true,
  ALTER COLUMN overflow_hiding_enabled SET DEFAULT true,
  ALTER COLUMN auto_trial_enabled SET DEFAULT true,
  ALTER COLUMN dunning_grace_enabled SET DEFAULT true;

UPDATE app_private.plan_settings
   SET free_intake_enabled=true,overflow_hiding_enabled=true,
       auto_trial_enabled=true,dunning_grace_enabled=true
 WHERE singleton;
