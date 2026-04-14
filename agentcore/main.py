from strands import Agent
from strands.multiagent import GraphBuilder
from strands_tools import http_request, use_aws
from strands.hooks import HookRegistry, HookProvider, BeforeToolCallEvent, BeforeInvocationEvent, AfterInvocationEvent, AfterToolCallEvent
from threading import Lock
from datetime import datetime
import requests

MAX_TOOL_CALLS = 3

# ── SearXNG Config ────────────────────────────────────────────────────────────
SEARXNG_URL  = "http://localhost:8080/search"   # swap to your AWS instance URL
AWS_DOCS_SITE = "site:docs.aws.amazon.com"
MAX_RESULTS  = 5


# ── SearXNG Tool ──────────────────────────────────────────────────────────────
def search_aws_docs(query: str) -> str:
    """
    Search AWS documentation via self-hosted SearXNG.
    Automatically restricts results to docs.aws.amazon.com only.
    
    Args:
        query: Search query string (e.g. "CloudFormation drift detection remediation")
    
    Returns:
        Formatted search results with title, URL, and snippet for each result.
    """
    restricted_query = f"{query} {AWS_DOCS_SITE}"
    try:
        resp = requests.get(
            SEARXNG_URL,
            params={"q": restricted_query, "format": "json", "categories": "general"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return f"Search failed: {e}"

    results = data.get("results", [])[:MAX_RESULTS]
    if not results:
        return "No results found on AWS documentation for that query."

    lines = []
    for i, r in enumerate(results, 1):
        title   = r.get("title", "No title")
        url     = r.get("url", "")
        snippet = r.get("content", "No snippet available")
        lines.append(f"[{i}] {title}\n    URL: {url}\n    {snippet}\n")

    return "\n".join(lines)


# ── Hook Classes ──────────────────────────────────────────────────────────────
class LimitToolCounts(HookProvider):
    """Limits the number of times tools can be called per agent invocation"""

    def __init__(self, max_tool_counts: dict[str, int]):
        self.max_tool_counts = max_tool_counts
        self.tool_counts = {}
        self._lock = Lock()

    def register_hooks(self, registry: HookRegistry) -> None:
        registry.add_callback(BeforeInvocationEvent, self.reset_counts)
        registry.add_callback(BeforeToolCallEvent, self.intercept_tool)

    def reset_counts(self, event: BeforeInvocationEvent) -> None:
        with self._lock:
            self.tool_counts = {}

    def intercept_tool(self, event: BeforeToolCallEvent) -> None:
        tool_name = event.tool_use["name"]
        with self._lock:
            max_tool_count = self.max_tool_counts.get(tool_name)
            tool_count = self.tool_counts.get(tool_name, 0) + 1
            self.tool_counts[tool_name] = tool_count

        if max_tool_count and tool_count > max_tool_count:
            event.cancel_tool = (
                f"Tool '{tool_name}' has been invoked too many times and is now being throttled. "
                f"DO NOT CALL THIS TOOL ANYMORE "
            )


class ContextLoggingHook(HookProvider):
    """Logs agent events with context information"""
    
    def __init__(self, log_level="INFO"):
        self.log_level = log_level
        self._lock = Lock()
    
    def register_hooks(self, registry: HookRegistry) -> None:
        registry.add_callback(BeforeInvocationEvent, self.log_invocation_start)
        registry.add_callback(AfterInvocationEvent, self.log_invocation_end)
        registry.add_callback(BeforeToolCallEvent, self.log_tool_call)
        registry.add_callback(AfterToolCallEvent, self.log_tool_result)
    
    def log_invocation_start(self, event: BeforeInvocationEvent) -> None:
        with self._lock:
            print(f"[{self.log_level}] Starting agent invocation")
    
    def log_invocation_end(self, event: AfterInvocationEvent) -> None:
        with self._lock:
            print(f"[{self.log_level}] Agent invocation completed")
    
    def log_tool_call(self, event: BeforeToolCallEvent) -> None:
        tool_name = event.tool_use.get("name", "unknown")
        with self._lock:
            print(f"[{self.log_level}] Calling tool: {tool_name}")
    
    def log_tool_result(self, event: AfterToolCallEvent) -> None:
        tool_name = event.tool_use.get("name", "unknown")
        with self._lock:
            print(f"[{self.log_level}] Tool {tool_name} completed")


# ── Condition Functions ────────────────────────────────────────────────────────
def needs_retry(state):
    verify_result = state.results.get("verify")
    if not verify_result:
        return False
    
    result_text = str(verify_result.result).lower()
    
    success_indicators = [
        "drift resolved",
        "drift is resolved",
        "stack is in sync",
        "in_sync"
    ]
    
    has_success = any(indicator in result_text for indicator in success_indicators)
    
    failure_indicators = [
        "drift detected",
        "drift not resolved",
        "drift remains"
    ]
    
    has_failure = any(indicator in result_text for indicator in failure_indicators)
    
    return has_failure and not has_success

def is_verified(state):
    execute_result = state.results.get("execute")
    if not execute_result:
        return False

    result_text = str(execute_result.result).lower()
    
    success_indicators = [
        "execution successful",
        "remediation completed",
        "drift resolved", "stack is in sync", "in_sync", 
        "verification passed", "no drift detected"
    ]
    
    failure_indicators = [
        "execution failed",
        "remediation failed",
        "drift detected", "drift not resolved", 
        "drift remains", "verification failed"
    ]
    
    has_success = any(indicator in result_text for indicator in success_indicators)
    has_failure = any(indicator in result_text for indicator in failure_indicators)
    
    return has_success and not has_failure


# ── Hooks ──────────────────────────────────────────────────────────────────────
limit_hook = LimitToolCounts(max_tool_counts={"http_request": 5, "use_aws": 5, "search_aws_docs": 5})
logging_hook = ContextLoggingHook(log_level="DEBUG")


# ── Agents ─────────────────────────────────────────────────────────────────────
researcher = Agent(
    name="researcher",
    system_prompt=(
        "You are a senior AWS infrastructure research specialist focused on CloudFormation IaC drift detection.\n\n"

        "YOUR RESPONSIBILITIES:\n"
        "1. Use the `use_aws` tool to inspect the drifted CloudFormation stack and identify:\n"
        "   - Which resources have drifted\n"
        "   - The exact property differences between expected (template) and actual (live) state\n"
        "   - Drift severity: MODIFIED, DELETED, or NOT_CHECKED\n"
        "2. Use the `search_aws_docs` tool to find official AWS documentation on:\n"
        "   - The specific drifted resource types (e.g. 'EC2 SecurityGroup drift remediation')\n"
        "   - Best practices for remediating this type of drift\n"
        "   - Any AWS-recommended procedures or runbooks\n"
        "3. Use `http_request` ONLY to fetch the full content of a specific AWS docs URL "
        "   returned by search_aws_docs. Do NOT use http_request to search the open web.\n\n"

        "OUTPUT FORMAT (strictly follow this structure):\n"
        "## Drift Summary\n"
        "- Stack name, region, drift status\n"
        "- List each drifted resource with: ResourceType | LogicalId | DriftStatus | PropertyDifferences\n\n"
        "## Root Cause Analysis\n"
        "- Why the drift likely occurred (manual change, automation, etc.)\n"
        "- Severity assessment (Low / Medium / High / Critical)\n\n"
        "## AWS Documentation References\n"
        "- List each relevant doc URL found with a one-line summary\n\n"
        "## Recommended Remediation Options\n"
        "- Provide 2-3 remediation options ranked by safety and AWS best practice alignment\n"
        "- Flag any option that involves downtime or data risk\n\n"

        "STRICT RULES:\n"
        "- NEVER use `use_aws` to make ANY changes to infrastructure — read-only operations only\n"
        "- NEVER guess or hallucinate resource properties — only report what the AWS API returns\n"
        "- If a search returns no results, try a more specific query before giving up\n"
        "- Always cite the AWS documentation URL for every remediation recommendation\n"
    ),
    tools=[http_request, use_aws, search_aws_docs],
    hooks=[limit_hook]
)

planner = Agent(
    name="planner",
    system_prompt=(
        "You are a senior AWS infrastructure remediation planner specializing in CloudFormation drift.\n\n"

        "YOUR RESPONSIBILITIES:\n"
        "You will receive a drift research report. Your job is to produce a precise, executable remediation plan.\n\n"

        "OUTPUT FORMAT (strictly follow this structure):\n"
        "## Remediation Plan\n"
        "- Stack: <stack name>\n"
        "- Region: <region>\n"
        "- Estimated Risk: Low / Medium / High\n"
        "- Estimated Downtime: <none / X minutes>\n\n"
        "## Pre-Conditions\n"
        "- List everything that must be true before execution begins\n"
        "- List required IAM permissions\n"
        "- List any backups or snapshots that must be taken first\n\n"
        "## Execution Steps\n"
        "Number each step. For every step include:\n"
        "  - Action: what to do\n"
        "  - Tool/Method: which AWS API call or CLI command\n"
        "  - Expected Result: what success looks like\n"
        "  - Rollback: what to do if this step fails\n\n"
        "## Post-Conditions\n"
        "- How to confirm the drift is fully resolved\n"
        "- What CloudFormation drift status should show after success\n\n"

        "STRICT RULES:\n"
        "- Every step must be atomic and independently verifiable\n"
        "- If a step has data-loss risk, mark it with [⚠️ DATA RISK]\n"
        "- If a step requires downtime, mark it with [⚠️ DOWNTIME]\n"
        "- Do NOT include any steps that were not supported by the research findings\n"
        "- The plan must be executable by the Executor agent using only the `use_aws` tool\n"
    ),
    tools=[]
)

executor = Agent(
    name="executor",
    system_prompt=(
        "You are a senior AWS infrastructure executor responsible for applying CloudFormation drift remediation.\n\n"

        "YOUR RESPONSIBILITIES:\n"
        "You will receive a remediation plan. Execute it step by step using the `use_aws` tool.\n\n"

        "EXECUTION RULES:\n"
        "- Execute steps in the exact order specified in the plan\n"
        "- After each step, verify the expected result before proceeding to the next\n"
        "- If a step fails, attempt the rollback defined in the plan — do NOT improvise\n"
        "- If this is a retry attempt, read the verifier's feedback carefully and "
        "  adjust only the steps that previously failed — do not redo successful steps\n"
        "- Document every action taken, including AWS API call used and response received\n\n"

        "OUTPUT FORMAT (strictly follow this structure):\n"
        "## Execution Log\n"
        "For each step:\n"
        "  Step N — <step name>\n"
        "  - Action taken: <what was done>\n"
        "  - AWS call: <API/CLI used>\n"
        "  - Result: SUCCESS / FAILED\n"
        "  - Response: <key fields from AWS response>\n\n"
        "## Execution Summary\n"
        "- Steps completed: X / Y\n"
        "- Steps failed: list any\n"
        "- Rollbacks performed: list any\n\n"

        "CRITICAL — end your response with EXACTLY one of these lines:\n"
        "- EXECUTION SUCCESSFUL\n"
        "- EXECUTION FAILED\n"
        "- REMEDIATION COMPLETED\n"
        "- REMEDIATION FAILED\n"
    ),
    tools=[use_aws],
)

verifier = Agent(
    name="verifier",
    system_prompt=(
        "You are a senior AWS infrastructure verifier responsible for confirming CloudFormation drift resolution.\n\n"

        "YOUR RESPONSIBILITIES:\n"
        "Use the `use_aws` tool to independently verify whether drift has been resolved. "
        "Do NOT rely on the executor's self-reported result — check the live AWS state yourself.\n\n"

        "VERIFICATION STEPS (always perform all of these):\n"
        "1. Re-run CloudFormation drift detection on the stack\n"
        "2. Wait for detection to complete, then retrieve the drift status\n"
        "3. Check each previously-drifted resource individually\n"
        "4. Confirm the live resource properties now match the CloudFormation template\n\n"

        "OUTPUT FORMAT (strictly follow this structure):\n"
        "## Verification Report\n"
        "- Stack: <name>\n"
        "- Verification timestamp: <ISO timestamp>\n"
        "- Overall drift status: IN_SYNC / DRIFTED / UNKNOWN\n\n"
        "## Resource-Level Results\n"
        "For each previously-drifted resource:\n"
        "  - ResourceType | LogicalId | Current Drift Status | Properties Verified\n\n"
        "## Structured Output\n"
        "  - drift_resolved: true / false\n"
        "  - status: success / failure / partial\n"
        "  - confidence_score: 0.0 to 1.0\n"
        "  - issues_found: <list remaining problems or 'none'>\n"
        "  - feedback_for_retry: <specific instructions for executor if retry needed, or 'n/a'>\n\n"

        "STRICT RULES:\n"
        "- NEVER use `use_aws` to make ANY changes to infrastructure — read-only only\n"
        "- NEVER trust the executor's output — always verify independently via AWS API\n"
        "- If drift detection is still running, wait and poll again before concluding\n"
        "- A confidence_score below 0.8 must be accompanied by a detailed explanation\n\n"

        "CRITICAL — end your response with EXACTLY one of these lines:\n"
        "- DRIFT RESOLVED\n"
        "- DRIFT NOT RESOLVED\n"
        "- STACK IS IN SYNC\n"
        "- DRIFT DETECTED\n"
    ),
    tools=[use_aws],
)

report_writer = Agent(
    name="report_writer",
    system_prompt=(
        "You are a technical report writer specializing in AWS infrastructure incident documentation.\n\n"

        "YOUR RESPONSIBILITIES:\n"
        "Produce a complete, professional drift remediation report using all outputs from the "
        "research, plan, execution, and verification stages.\n\n"

        "REPORT TEMPLATE (fill every section — do not skip any):\n\n"
        "==========================================================\n"
        "        AWS CLOUDFORMATION DRIFT REMEDIATION REPORT\n"
        "==========================================================\n"
        "Report ID     : <generate a unique ID: DRIFT-YYYYMMDD-XXXX>\n"
        "Generated At  : <ISO timestamp>\n"
        "Stack Name    : <stack name>\n"
        "Region        : <AWS region>\n"
        "Final Status  : RESOLVED / UNRESOLVED\n"
        "==========================================================\n\n"
        "1. EXECUTIVE SUMMARY\n"
        "   A 3-5 sentence plain-English summary of what drifted, what was done, and the outcome.\n\n"
        "2. DRIFT DETAILS\n"
        "   - Detection timestamp\n"
        "   - Resources affected (table: ResourceType | LogicalId | DriftStatus | Properties Changed)\n"
        "   - Root cause assessment\n"
        "   - Severity: Low / Medium / High / Critical\n\n"
        "3. REMEDIATION ACTIONS TAKEN\n"
        "   - Numbered list of every step executed\n"
        "   - Include AWS API calls used and outcomes\n"
        "   - Note any steps that failed and rollbacks performed\n\n"
        "4. RETRY HISTORY (if applicable)\n"
        "   - Number of retry attempts\n"
        "   - What failed each time and how it was adjusted\n\n"
        "5. VERIFICATION RESULTS\n"
        "   - Verification method used\n"
        "   - Per-resource final drift status\n"
        "   - Confidence score: X.X / 1.0\n"
        "   - Any remaining issues\n\n"
        "6. AWS DOCUMENTATION REFERENCES\n"
        "   - List all docs.aws.amazon.com URLs referenced during research\n\n"
        "7. RECOMMENDATIONS\n"
        "   - How to prevent this drift from recurring\n"
        "   - Suggested CloudFormation StackPolicy or AWS Config rules if applicable\n\n"
        "==========================================================\n"
        "END OF REPORT\n"
        "==========================================================\n\n"

        "STRICT RULES:\n"
        "- Never leave a section blank — write 'N/A' if not applicable\n"
        "- Use exact timestamps, resource IDs, and API responses from previous agents\n"
        "- Do NOT invent or estimate values that were not reported by other agents\n"
        "- The report must be readable by both technical engineers and non-technical stakeholders\n"
    ),
    tools=[],
    hooks=[logging_hook]
)


# ── Graph ──────────────────────────────────────────────────────────────────────
builder = GraphBuilder()

builder.add_node(researcher, "research")
builder.add_node(planner, "plan")
builder.add_node(executor, "execute")
builder.add_node(verifier, "verify")
builder.add_node(report_writer, "report")

builder.add_edge("research", "plan")
builder.add_edge("research", "execute")
builder.add_edge("plan", "execute")

builder.add_edge("execute", "verify")
builder.add_edge("verify", "execute", condition=needs_retry)
builder.add_edge("verify", "report", condition=is_verified)

builder.set_entry_point("research")

builder.set_execution_timeout(600)
builder.set_max_node_executions(15)
builder.reset_on_revisit(True)

graph = builder.build()

# ── Run ────────────────────────────────────────────────────────────────────────
print("Starting drift detection and remediation workflow...")
print("=" * 80)

result = graph("Detect and remediate drift for CloudFormation stack MyStack in us-east-1")

print("\n" + "=" * 80)
print("WORKFLOW RESULTS")
print("=" * 80)
print(f"\nStatus: {result.status}")
print(f"Execution order: {[node.node_id for node in result.execution_order]}")
print(f"Total executions: {len(result.execution_order)}")

executor_count = sum(1 for node in result.execution_order if node.node_id == "execute")
print(f"Executor executions (initial + retries): {executor_count}")

verify_result = result.results.get("verify")
execute_result = result.results.get("execute")
