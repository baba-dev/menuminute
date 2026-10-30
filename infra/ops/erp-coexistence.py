#!/usr/bin/env python3
"""Bounded, read-only ERP/MenuMinute coexistence measurement on the shared VPS.

Does not generate orders, restart services, query secrets, or touch ERP files.
Compare a QUIET baseline to a separately owner-approved representative service
period; the summary is evidence, not a capacity/SLO certification.
"""
import argparse
import datetime as dt
import json
import math
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request


def cpu_jiffies():
    with open("/proc/stat", encoding="ascii") as stream:
        parts = stream.readline().split()
    if parts[0] != "cpu" or len(parts) < 8:
        raise RuntimeError("cannot read CPU counters")
    values = [int(value) for value in parts[1:]]
    return sum(values), sum(values[index] for index in (3, 4))


def memory_available_mib():
    with open("/proc/meminfo", encoding="ascii") as stream:
        for line in stream:
            if line.startswith("MemAvailable:"):
                return round(int(line.split()[1]) / 1024, 1)
    raise RuntimeError("cannot read MemAvailable")


def cgroup_stats(unit):
    # Unit property query only; never read environment, ProcessArgs or journal.
    result = subprocess.run(
        ["systemctl", "show", unit, "--property=MemoryCurrent,CPUUsageNSec,TasksCurrent"],
        text=True, capture_output=True, check=False, timeout=5,
    )
    if result.returncode:
        return {"memory_mib": None, "cpu_ns": None, "tasks": None}
    fields = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)

    def number(name):
        value = fields.get(name, "")
        return int(value) if value.isdigit() and int(value) < (1 << 63) else None

    memory = number("MemoryCurrent")
    return {"memory_mib": round(memory / 1048576, 1) if memory is not None else None,
            "cpu_ns": number("CPUUsageNSec"), "tasks": number("TasksCurrent")}


def probe(url):
    started = time.monotonic()
    try:
        # Hardcoded loopback endpoints: the operator cannot direct this at a public host.
        request = urllib.request.Request(url, headers={"Cache-Control": "no-cache"})
        with urllib.request.urlopen(request, timeout=5) as response:
            status = response.status
            # Never print or persist application response bodies.
            response.read(64)
    except urllib.error.HTTPError as error:
        status = error.code
    except (urllib.error.URLError, TimeoutError, OSError):
        status = None
    return {"status": status, "latency_ms": round((time.monotonic() - started) * 1000, 1)}


def percentile(values, q):
    if not values:
        return None
    data = sorted(values)
    rank = (len(data) - 1) * q
    lo, hi = math.floor(rank), math.ceil(rank)
    return round(data[lo] + (data[hi] - data[lo]) * (rank - lo), 1)


def summary(samples, label):
    erp = [x["erp"] for x in samples]
    mm = [x["menuminute"] for x in samples]
    latency = lambda values: {"p50_ms": percentile([x["latency_ms"] for x in values], 0.50),
                               "p95_ms": percentile([x["latency_ms"] for x in values], 0.95),
                               "max_ms": max(x["latency_ms"] for x in values)}
    failures = lambda values: sum(not isinstance(x["status"], int) or x["status"] < 200 or x["status"] >= 400
                                  for x in values)
    cpu = [x["host_cpu_pct"] for x in samples if x["host_cpu_pct"] is not None]
    return {
        "label": label, "sample_count": len(samples),
        "observed_from_utc": samples[0]["observed_at_utc"],
        "observed_to_utc": samples[-1]["observed_at_utc"],
        "erp": {**latency(erp), "failed_http_probes": failures(erp)},
        "menuminute": {**latency(mm), "failed_http_probes": failures(mm)},
        "host": {"avg_cpu_pct": round(sum(cpu) / len(cpu), 1) if cpu else None,
                 "max_cpu_pct": max(cpu) if cpu else None,
                 "min_memory_available_mib": min(x["memory_available_mib"] for x in samples),
                 "min_root_free_gib": min(x["root_free_gib"] for x in samples)},
        "systemd": {u: {"peak_memory_mib": max((x["units"][u]["memory_mib"] for x in samples
                                                 if x["units"][u]["memory_mib"] is not None), default=None),
                         "peak_tasks": max((x["units"][u]["tasks"] for x in samples
                                            if x["units"][u]["tasks"] is not None), default=None)}
                    for u in ("menuminute-web.service", "menuminute-worker.service")},
        "non_destructive": True, "representative_load_or_slo_signed_off": False,
    }


def collect(samples, interval, label):
    output = []
    previous = cpu_jiffies()
    for index in range(samples):
        time.sleep(interval)
        present = cpu_jiffies()
        total, idle = present[0] - previous[0], present[1] - previous[1]
        previous = present
        load = round(100 * (total - idle) / total, 1) if total > 0 else None
        rec = {
            "observed_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
            "host_cpu_pct": load,
            "memory_available_mib": memory_available_mib(),
            "root_free_gib": round(shutil.disk_usage("/").free / (1024 ** 3), 2),
            "erp": probe("http://127.0.0.1:3000/"),
            "menuminute": probe("http://127.0.0.1:3100/api/health/ready"),
            "units": {u: cgroup_stats(u) for u in
                      ("menuminute-web.service", "menuminute-worker.service")},
        }
        output.append(rec)
    return summary(output, label)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", type=int, default=12)
    parser.add_argument("--interval", type=float, default=5)
    parser.add_argument("--label", choices=("quiet-baseline", "normal-service", "approved-load"),
                        default="quiet-baseline")
    args = parser.parse_args()
    if not 2 <= args.samples <= 120 or not 1 <= args.interval <= 60:
        parser.error("samples must be 2–120; interval must be 1–60 seconds")
    try:
        result = collect(args.samples, args.interval, args.label)
    except (OSError, RuntimeError, ValueError, subprocess.TimeoutExpired):
        print(json.dumps({"status": "fail", "reason": "host_measurement_unavailable"}))
        return 1
    result["status"] = "pass" if (result["erp"]["failed_http_probes"] == 0 and
                                  result["menuminute"]["failed_http_probes"] == 0) else "fail"
    print(json.dumps(result, sort_keys=True, indent=2))
    return 0 if result["status"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())
