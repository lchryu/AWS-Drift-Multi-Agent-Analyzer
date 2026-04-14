import { Readable } from "stream";
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from "@aws-sdk/client-bedrock-agentcore";
import { region } from "../clients/cloudFormationClient";

export async function callChatApiStreaming(
  userPrompt: string,
  sessionId: string,
  mode: "Ask" | "Classification" | "Agent" | "Plan" | "Multiagent",
  onChunk: (chunk: string | any) => void
) {
  const client = new BedrockAgentCoreClient({ region });
  console.log(mode)
  const debugStream = process.env.AGENT_STREAM_DEBUG === "1";
  const input = {
    runtimeSessionId: sessionId,
    agentRuntimeArn:
      "arn:aws:bedrock-agentcore:us-east-1:899013845518:runtime/agent-YvBk4j3akq",
    payload: new TextEncoder().encode(
      JSON.stringify({ prompt: userPrompt, mode: mode })
    ),
  };

  const command = new InvokeAgentRuntimeCommand(input);
  const resp = await client.send(command);
  if (!resp.response) {
    throw new Error("Missing AgentCore response stream");
  }

  // 🔑 Node.js stream
  const stream = resp.response as unknown as Readable;
  const decoder = new TextDecoder("utf-8");

  const safeJsonParse = (payload: string) => {
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  };

  const handleMessage = (message: any, rawPayload: string) => {
    if (
      message &&
      typeof message === "object" &&
      (message as any).type === "end" &&
      (message as any).usage
    ) {
      onChunk({
        __meta: "usage",
        usage: (message as any).usage,
      });
      return;
    }

    if (mode === "Ask" || mode === "Agent" || mode === "Plan" || mode === "Multiagent") {
      let textChunk: string;

      if (typeof message === "string") {
        textChunk = message;
      } else if ((message as any)?.outputText) {
        const first = (message as any).outputText[0];
        textChunk = first?.text ?? JSON.stringify(message);
      } else if ((message as any)?.content) {
        textChunk = (message as any).content;
      } else if (message != null) {
        textChunk = JSON.stringify(message);
      } else {
        textChunk = rawPayload;
      }

      onChunk(textChunk);
    } else {
      onChunk(message ?? rawPayload);
    }
  };

  let sseBuffer = "";
  let classificationResult: any = null;

  for await (const chunk of stream) {
    sseBuffer += decoder.decode(chunk, { stream: true });
    if (debugStream) {
      console.debug("[agent-stream] chunk", sseBuffer);
    }

    const frames = sseBuffer.split("\n\n");
    sseBuffer = frames.pop() ?? "";

    for (const frame of frames) {
      if (!frame.trim()) continue;
      const lines = frame.split("\n");
      const dataLines = lines.filter((line) => line.startsWith("data:"));
      if (dataLines.length === 0) continue;

      const payload = dataLines
        .map((line) => line.replace(/^data:\s?/, ""))
        .join("\n");
      if (debugStream) {
        console.debug("[agent-stream] payload", payload);
      }

      const parsed = safeJsonParse(payload);

      if (mode === "Classification") {
        if (parsed != null) {
          classificationResult = parsed;
        } else if (payload.trim()) {
          classificationResult = payload;
        }
        continue;
      }

      handleMessage(parsed ?? payload, payload);
    }
  }

  if (mode === "Classification") {
    if (classificationResult == null && sseBuffer.trim()) {
      const leftover = sseBuffer.replace(/^data:\s?/, "");
      classificationResult = safeJsonParse(leftover) ?? leftover;
    }

    if (classificationResult != null) {
      onChunk(classificationResult);
    } else {
      throw new Error("Classification response was empty or malformed.");
    }
    return;
  }
}
