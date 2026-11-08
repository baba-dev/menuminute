import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/android/release-plan.py"
spec = importlib.util.spec_from_file_location("android_release_plan", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PlayReleasePlanTests(unittest.TestCase):
    def test_web_only_push_skips_signing(self):
        result = module.plan_release("workflow_run", 5, "1.0", ["src/app/page.tsx", "docs/guide.md"])
        self.assertEqual(result, {"should_sign": "false", "version_code": "6", "version_name": "1.0.5"})

    def test_native_sources_trigger_signing(self):
        for changed in ["android/app/build.gradle.kts", ".github/workflows/android-release.yml", "scripts/android/release-plan.py"]:
            with self.subTest(changed=changed):
                self.assertEqual(module.plan_release("workflow_run", 5, "1.0", [changed])["should_sign"], "true")

    def test_manual_request_signs_even_without_native_diff(self):
        self.assertEqual(module.plan_release("workflow_dispatch", 7, "1.0", [])["should_sign"], "true")

    def test_version_codes_are_unique_across_new_runs_and_above_initial_bundle(self):
        codes = [int(module.plan_release("workflow_run", n, "1.0", ["android/app/build.gradle.kts"])["version_code"]) for n in range(1, 11)]
        self.assertEqual(codes, list(range(2, 12)))

    def test_rejects_invalid_input_and_play_limit(self):
        for event, number, version in [("push", 3, "1.0"), ("workflow_dispatch", 0, "1.0"), ("workflow_dispatch", 2_100_000_000, "1.0"), ("workflow_dispatch", 5, "1.0.x")]:
            with self.subTest(event=event, number=number, version=version):
                with self.assertRaises(ValueError):
                    module.plan_release(event, number, version, [])


if __name__ == "__main__":
    unittest.main()
