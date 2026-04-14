import argparse
import csv
import json
import os
import shutil
import subprocess
import sys
import time
import traceback
from datetime import datetime, timezone

from main import build_graph

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


SUCCESS_INDICATORS = [
    "execution successful",
    "remediation completed",
    "drift resolved",
    "stack is in sync",
    "in_sync",
    "verification passed",
    "no drift detected",
]

FAILURE_INDICATORS = [
    "execution failed",
    "remediation failed",
    "drift detected",
    "drift not resolved",
    "drift remains",
    "verification failed",
]


def extract_text(result_obj):
    if result_obj is None:
        return ""
    if hasattr(result_obj, "result"):
        try:
            return str(result_obj.result)
        except Exception:
            return str(result_obj)
    return str(result_obj)


def evaluate_result(result):
    verify_result = result.results.get("verify")
    execute_result = result.results.get("execute")

    verify_text = extract_text(verify_result)
    execute_text = extract_text(execute_result)
    combined = f"{verify_text}\n{execute_text}".lower()

    has_success = any(indicator in combined for indicator in SUCCESS_INDICATORS)
    has_failure = any(indicator in combined for indicator in FAILURE_INDICATORS)

    if has_success and not has_failure:
        return "success", True, verify_text, execute_text
    if has_failure and not has_success:
        return "failure", False, verify_text, execute_text
    if has_success and has_failure:
        return "mixed", False, verify_text, execute_text
    return "unknown", False, verify_text, execute_text


def build_task(scenario):
    lines = [
        "Detect and remediate drift for CloudFormation stack MyStack in us-east-1.",
        "Scenario details:",
        f"- testId: {scenario.get('testId', '')}",
        f"- category: {scenario.get('category', '')}",
        f"- severity: {scenario.get('severity', '')}",
        f"- command: {scenario.get('command', '')}",
        f"- parameters: {json.dumps(scenario.get('parameters', {}), separators=(',', ':'))}",
        f"- description: {scenario.get('description', '')}",
    ]
    if "reversible" in scenario:
        lines.append(f"- reversible: {scenario.get('reversible')}")
    if "requiresStop" in scenario:
        lines.append(f"- requiresStop: {scenario.get('requiresStop')}")
    if "revertCommand" in scenario:
        lines.append(f"- revertCommand: {scenario.get('revertCommand')}")
    if "revertParameters" in scenario:
        lines.append(f"- revertParameters: {json.dumps(scenario.get('revertParameters', {}), separators=(',', ':'))}")
    return "\n".join(lines)


def load_scenarios(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("driftScenarios", [])


def ensure_parent_dir(path):
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)


def main():
    parser = argparse.ArgumentParser(description="Run agent graph against drift test cases and emit CSV report.")
    parser.add_argument(
        "--testcases",
        default=os.path.join(BASE_DIR, "..", "dynamic-drift-executor", "testcases", "drift-scenarios-89.json"),
        help="Path to drift scenarios JSON.",
    )
    parser.add_argument(
        "--out",
        default=os.path.join(BASE_DIR, "..", "dynamic-drift-executor", "output", "agentgraph_report.csv"),
        help="Output CSV path.",
    )
    parser.add_argument(
        "--apply-drift",
        action="store_true",
        default=True,
        help="Apply each drift scenario before running the agent graph.",
    )
    parser.add_argument(
        "--no-apply-drift",
        action="store_false",
        dest="apply_drift",
        help="Do not apply drift scenarios automatically.",
    )
    parser.add_argument(
        "--drift-cwd",
        default=os.path.join(BASE_DIR, "..", "dynamic-drift-executor"),
        help="Working directory for dynamic-drift-executor (contains package.json).",
    )
    parser.add_argument(
        "--drift-timeout",
        type=int,
        default=1800,
        help="Timeout in seconds for applying a drift scenario.",
    )
    parser.add_argument("--limit", type=int, default=0, help="Limit number of test cases (0 = no limit).")
    parser.add_argument("--start", type=int, default=0, help="Start index (0-based) in scenarios list.")

    args = parser.parse_args()

    # Auto-confirm mutative operations for all tools (use_aws, http_request, etc.)
    os.environ["BYPASS_TOOL_CONSENT"] = "true"

    drift_dir = None
    if args.apply_drift:
        if shutil.which("npm") is None:
            raise RuntimeError(
                "npm was not found in PATH. Install Node.js (includes npm) or run with --no-apply-drift."
            )
        drift_dir = os.path.abspath(args.drift_cwd)
        if not os.path.isdir(drift_dir):
            raise RuntimeError(f"drift-cwd not found: {drift_dir}")

    scenarios = load_scenarios(args.testcases)
    if args.start < 0 or args.start >= len(scenarios):
        raise ValueError(f"start index {args.start} is out of range (0..{len(scenarios)-1})")

    if args.limit and args.limit > 0:
        scenarios = scenarios[args.start : args.start + args.limit]
    else:
        scenarios = scenarios[args.start :]

    graph = build_graph()

    ensure_parent_dir(args.out)

    fieldnames = [
        "testId",
        "category",
        "severity",
        "command",
        "description",
        "status",
        "success",
        "error",
        "duration_ms",
        "executor_executions",
        "execution_order",
        "verify_excerpt",
        "execute_excerpt",
        "task",
        "timestamp_utc",
    ]

    total = 0
    success_count = 0
    error_count = 0

    with open(args.out, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()

        for scenario in scenarios:
            total += 1
            task = build_task(scenario)
            start_time = time.time()
            timestamp_utc = datetime.now(timezone.utc).isoformat()

            row = {
                "testId": scenario.get("testId", ""),
                "category": scenario.get("category", ""),
                "severity": scenario.get("severity", ""),
                "command": scenario.get("command", ""),
                "description": scenario.get("description", ""),
                "status": "",
                "success": "",
                "error": "",
                "duration_ms": "",
                "executor_executions": "",
                "execution_order": "",
                "verify_excerpt": "",
                "execute_excerpt": "",
                "task": task,
                "timestamp_utc": timestamp_utc,
            }

            try:
                if args.apply_drift:
                    drift_cmd = ["npm", "run", "drift", "--", "execute", scenario.get("testId", "")]
                    subprocess.run(
                        drift_cmd,
                        cwd=drift_dir,
                        check=True,
                        timeout=args.drift_timeout,
                    )

                result = graph(task)
                duration_ms = int((time.time() - start_time) * 1000)
                status, success, verify_text, execute_text = evaluate_result(result)
                executor_count = sum(
                    1 for node in result.execution_order if node.node_id == "execute"
                )

                row.update(
                    {
                        "status": status,
                        "success": str(success),
                        "duration_ms": str(duration_ms),
                        "executor_executions": str(executor_count),
                        "execution_order": ",".join([n.node_id for n in result.execution_order]),
                        "verify_excerpt": verify_text[:500],
                        "execute_excerpt": execute_text[:500],
                    }
                )

                if success:
                    success_count += 1
            except Exception as exc:
                duration_ms = int((time.time() - start_time) * 1000)
                error_count += 1
                error_details = traceback.format_exc()
                row.update(
                    {
                        "status": "error",
                        "success": "False",
                        "duration_ms": str(duration_ms),
                        "error": f"{type(exc).__name__}: {exc}\n{error_details}",
                    }
                )

            writer.writerow(row)

    success_rate = (success_count / total) if total else 0.0
    # Add a summary row for quick CSV consumption.
    writer_row = {
        "testId": "SUMMARY",
        "status": "summary",
        "success": f"{success_rate:.4f}",
        "error": "",
        "duration_ms": "",
        "executor_executions": "",
        "execution_order": "",
        "verify_excerpt": "",
        "execute_excerpt": "",
        "task": "",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    }
    with open(args.out, "a", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writerow(writer_row)
    print(f"Completed {total} test cases")
    print(f"Successes: {success_count}")
    print(f"Errors: {error_count}")
    print(f"Success rate: {success_rate:.2%}")
    print(f"Report written to: {args.out}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Failed to run tests: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(1)
