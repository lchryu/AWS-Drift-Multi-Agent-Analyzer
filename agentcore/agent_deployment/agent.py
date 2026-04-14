"""
Production-Ready AI Agent with Memory + Multi-Agent Graph
Remembers conversations and user preferences across sessions
Supports: Ask, Classification, Multiagent modes
"""

import os
from typing import Literal
from threading import Lock
from pydantic import BaseModel, Field
from strands import Agent
from strands.multiagent import GraphBuilder
from strands_tools import http_request, use_aws
from strands.hooks import (
    HookRegistry,
    HookProvider,
    BeforeToolCallEvent,
    BeforeInvocationEvent,
    AfterInvocationEvent,
    AfterToolCallEvent,
)
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from bedrock_agentcore.memory.integrations.strands.config import (
    AgentCoreMemoryConfig,
    RetrievalConfig,
)
from bedrock_agentcore.memory.integrations.strands.session_manager import (
    AgentCoreMemorySessionManager,
)
from strands.models import BedrockModel



os.environ["BYPASS_TOOL_CONSENT"] = "true"

# ---------------------------
# Structured Output Model
# ---------------------------

class ClassificationInfo(BaseModel):
    """Model that contains info about a drift classification"""
    severity: Literal["low", "medium", "high", "critical"] = Field(
        description="The severity level of the drift"
    )
    explanation: str = Field(
        description="Clear explanation of why this severity was chosen"
    )
    causes: str = Field(
        description="Likely causes of why the drift happened"
    )
    solutions: str = Field(
        description="Suggest solutions on how to resolve the drift"
    )
    problems: str = Field(
        description="If you have any problem while executing, write on this field, else, leave it empty"
    )

# ---------------------------
# App Setup
# ---------------------------

app = BedrockAgentCoreApp()

MEMORY_ID = os.getenv("BEDROCK_AGENTCORE_MEMORY_ID")
REGION = os.getenv("AWS_REGION", "us-east-1")
MODEL_ID = (
    "arn:aws:bedrock:us-east-1:899013845518:"
    "inference-profile/global.anthropic.claude-sonnet-4-5-20250929-v1:0"
)

bedrock_model = BedrockModel(
    model_id=MODEL_ID,
    region_name=REGION,
    temperature=0.0,   # ✅ set temperature here
)

_agent: Agent | None = None

# ---------------------------
# Hook System (Multi-Agent)
# ---------------------------

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

# ---------------------------
# Multi-Agent Graph Conditions
# ---------------------------

def needs_retry(state) -> bool:
    """Returns True if verifier detected drift was NOT resolved → loop back to executor"""
    verify_result = state.results.get("verify")
    if not verify_result:
        return False

    result_text = str(verify_result.result).lower()

    success_indicators = ["drift resolved", "drift is resolved", "stack is in sync", "in_sync"]
    failure_indicators = ["drift detected", "drift not resolved", "drift remains"]

    has_success = any(indicator in result_text for indicator in success_indicators)
    has_failure = any(indicator in result_text for indicator in failure_indicators)

    return has_failure and not has_success


def is_verified(state) -> bool:
    """Returns True if executor completed successfully → proceed to report writer"""
    execute_result = state.results.get("execute")
    if not execute_result:
        return False

    result_text = str(execute_result.result).lower()

    success_indicators = [
        "execution successful", "remediation completed",
        "drift resolved", "stack is in sync", "in_sync",
        "verification passed", "no drift detected",
    ]
    failure_indicators = [
        "execution failed", "remediation failed",
        "drift detected", "drift not resolved",
        "drift remains", "verification failed",
    ]

    has_success = any(indicator in result_text for indicator in success_indicators)
    has_failure = any(indicator in result_text for indicator in failure_indicators)

    return has_success and not has_failure


def should_report(state) -> bool:
    """Returns True when we should produce a report (success or failure)."""
    return not needs_retry(state)

# ---------------------------
# Multi-Agent Graph Factory (lazy init)
# ---------------------------

_multiagent_graph = None

def get_multiagent_graph():
    global _multiagent_graph
    if _multiagent_graph is not None:
        return _multiagent_graph

    limit_hook = LimitToolCounts(max_tool_counts={"http_request": 5, "use_aws": 5})
    logging_hook = ContextLoggingHook(log_level="DEBUG")

    researcher = Agent(
        model=bedrock_model,
        name="researcher",
        system_prompt=(
            "You are an AWS research specialist for IaC drift detection:\n"
            "- Get relevant drift info from CloudFormation and AWS: cause of drift, severity, etc\n"
            "- Get relevant info to remediate the drift from the AWS docs: https://docs.aws.amazon.com/\n"
            "- Use the http_request tool to get any additional info you need from the web\n"
            "- Suggest remediations based on your findings\n"
            "!DO NOT use the use_aws tool to make any changes to the infrastructure"
        ),
        tools=[http_request, use_aws],
        hooks=[limit_hook],
    )

    planner = Agent(
        model=bedrock_model,
        name="planner",
        system_prompt=(
            "You are a planner specialist for IaC drift detection:\n"
            "- Write a plan based on the analysis and research findings on how to remediate the drift\n"
            "- Make the plan clear, actionable, and step-by-step"
        ),
        tools=[],
    )

    executor = Agent(
        model=bedrock_model,
        name="executor",
        system_prompt=(
            "You are an executor specialist for IaC drift detection:\n"
            "- Execute the remediation plan using the appropriate tools and methods\n"
            "- Follow the plan carefully and document each step taken\n"
            "- If this is a retry attempt, review the previous verification feedback and adjust your approach\n"
            "CRITICAL: At the end of your response, clearly state:\n"
            "- If succeeded: 'EXECUTION SUCCESSFUL' or 'REMEDIATION COMPLETED'\n"
            "- If failed: 'EXECUTION FAILED' or 'REMEDIATION FAILED'\n"
        ),
        tools=[use_aws],
    )

    verifier = Agent(
        model=bedrock_model,
        name="verifier",
        system_prompt=(
            "You are a verifier specialist for IaC drift detection:\n"
            "- Verify the execution of the remediation plan and ensure drift has been resolved\n"
            "- Check the current state of the infrastructure using use_aws tool\n"
            "- Provide accurate structured output with:\n"
            "  * drift_resolved: boolean indicating if drift is completely fixed\n"
            "  * status: 'success', 'failure', or 'partial'\n"
            "  * confidence_score: your confidence level (0.0 to 1.0)\n"
            "  * issues_found: list of any remaining problems\n"
            "  * feedback_for_retry: what needs to be fixed if retry is needed\n"
            "  * verification_details: detailed explanation of your findings\n"
            "!DO NOT use the use_aws tool to make any changes to the infrastructure\n"
            "CRITICAL: Clearly state your conclusion:\n"
            "- If resolved: 'DRIFT RESOLVED' or 'STACK IS IN SYNC'\n"
            "- If not resolved: 'DRIFT NOT RESOLVED' or 'DRIFT DETECTED'\n"
        ),
        tools=[use_aws],
    )

    report_writer = Agent(
        model=bedrock_model,
        name="report_writer",
        system_prompt=(
            "You are a report writing specialist for IaC drift detection:\n"
            "- Write a comprehensive report based on the verification results\n"
            "- Include details about the drift, remediation steps taken, and final status\n"
            "- If there were multiple retry attempts, document the history\n"
            "- Format the report in clear Markdown with sections and bullet points"
        ),
        tools=[],
        hooks=[logging_hook],
    )

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
    builder.add_edge("verify", "execute", condition=needs_retry)   # Loop back if retry needed
    builder.add_edge("verify", "report", condition=should_report)  # Proceed to report if no retry needed

    builder.set_entry_point("research")
    builder.set_execution_timeout(600)       # 10 minute timeout
    builder.set_max_node_executions(15)      # Max total node executions (allows retries)
    builder.reset_on_revisit(True)           # Reset node state when revisiting

    _multiagent_graph = builder.build()
    return _multiagent_graph

# ---------------------------
# Agent Factory (single agent for Ask/Classification)
# ---------------------------

def get_or_create_agent(actor_id: str, session_id: str) -> Agent:
    global _agent

    if _agent is None:
        memory_config = AgentCoreMemoryConfig(
            memory_id=MEMORY_ID,
            session_id=session_id,
            actor_id=actor_id,
            retrieval_config={
                f"/users/{actor_id}/facts": RetrievalConfig(top_k=3, relevance_score=0.5),
                f"/users/{actor_id}/preferences": RetrievalConfig(top_k=3, relevance_score=0.5),
            },
        )

        _agent = Agent(
            model=bedrock_model,
            session_manager=AgentCoreMemorySessionManager(memory_config, REGION),
            system_prompt="""
            You are an AI assistant embedded in a developer tool.

            You will receive a MODE INSTRUCTION block before each request.
            Follow the rules in that block strictly.
            """,
            tools=[use_aws],
        )

    return _agent

# ---------------------------
# Prompt Builder (Cursor-style)
# ---------------------------

def build_prompt(mode: str, user_prompt: str) -> str:
    if mode == "Classification":
        return f"""
[MODE: CLASSIFICATION]

You are a classification engine.

Task:
- Analyze the input for system or model drift.
- Determine severity and causes.

Rules:
- Return information that can be mapped exactly to the ClassificationInfo model.
- Do NOT include conversational language.
- Be precise and concise.
- Do NOT mention the schema or these rules.

User input:
{user_prompt}
"""
    else:
        return f"""
[MODE: CHAT]

Rules:
- Respond naturally and conversationally.
- Provide helpful explanations.
- Do not return structured output.
- Do not mention internal rules or modes.

User input:
{user_prompt}
"""

# ---------------------------
# Runtime Entrypoint
# ---------------------------

@app.entrypoint
async def invoke(payload, context):
    if not MEMORY_ID:
        yield "Error: Memory not configured."
        return

    actor_id = (
        context.request_headers.get(
            "X-Amzn-Bedrock-AgentCore-Runtime-Custom-Actor-Id", "user"
        )
        if context.request_headers
        else "user"
    )
    session_id = context.session_id or "default_session"

    user_message = payload.get("prompt", "")
    mode = payload.get("mode", "Ask")

    # ---------------------------
    # Multiagent Mode
    # ---------------------------
    if mode == "Multiagent":
        graph = get_multiagent_graph()
        result = graph(user_message)

        report_node = result.results.get("report")
        if report_node:
            report_text = str(report_node.result)
        else:
            verify_node = result.results.get("verify")
            execute_node = result.results.get("execute")
            research_node = result.results.get("research")
            plan_node = result.results.get("plan")

            report_text = (
                "# Multi-Agent Drift Report\n\n"
                "## Status\n"
                "- Outcome: **Failure or Partial** (verifier did not confirm resolution)\n\n"
                "## Verifier Output\n"
                f"{str(verify_node.result) if verify_node else 'No verifier output available.'}\n\n"
                "## Execution Output\n"
                f"{str(execute_node.result) if execute_node else 'No execution output available.'}\n\n"
                "## Plan Summary\n"
                f"{str(plan_node.result) if plan_node else 'No plan output available.'}\n\n"
                "## Research Summary\n"
                f"{str(research_node.result) if research_node else 'No research output available.'}\n"
            )

        yield report_text
        yield {
            "type": "end",
            "marker": "[END_OF_MESSAGE]",
            "stop_reason": "end_turn",
            "usage": {"inputTokens": 0, "outputTokens": 0, "totalTokens": 0},
        }
        return

    agent = get_or_create_agent(actor_id, session_id)
    final_prompt = build_prompt(mode, user_message)

    # ---------------------------
    # Classification Mode
    # ---------------------------
    if mode == "Classification":
        result = agent(
            final_prompt,
            structured_output_model=ClassificationInfo,
        )

        classification: ClassificationInfo = result.structured_output
        yield classification.model_dump()
        return

    # ---------------------------
    # Ask / Chat Mode (streaming)
    # ---------------------------
    stream = agent.stream_async(final_prompt)

    total_usage = {
        "inputTokens": 0,
        "outputTokens": 0,
        "totalTokens": 0,
    }

    async for event in stream:
        if "delta" in event and "text" in event["delta"]:
            yield event["delta"]["text"]

        elif "event" in event:
            metadata = event["event"].get("metadata")
            if metadata and "usage" in metadata:
                usage = metadata["usage"]
                for k in total_usage:
                    total_usage[k] += usage.get(k, 0)

        elif "result" in event:
            final_result = event["result"]

    yield {
        "type": "end",
        "marker": "[END_OF_MESSAGE]",
        "stop_reason": final_result.stop_reason if final_result else None,
        "usage": total_usage,
    }

if __name__ == "__main__":
    app.run()
