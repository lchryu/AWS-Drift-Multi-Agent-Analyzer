import {
  ListStackResourcesCommand,
  ListStacksCommand,
  ListStacksCommandOutput,
  StackStatus,
  StackSummary,
  DetectStackDriftCommand,
  DescribeStackDriftDetectionStatusCommand,
  DescribeStackResourceDriftsCommand,
  StackResourceDrift,
} from "@aws-sdk/client-cloudformation";
import { cloudformationClient } from "../clients/cloudFormationClient";
import { tryCatch } from "../utils/tryCatch";
import { statusFilter } from "../types/constants";

export async function listAllStacks() {
  const stacks: StackSummary[] = [];
  let nextToken: string | undefined = undefined;

  do {
    const promise: Promise<ListStacksCommandOutput> = cloudformationClient.send(
      new ListStacksCommand({
        NextToken: nextToken,
        StackStatusFilter: statusFilter as StackStatus[],
      })
    );

    const { data: response, error } = await tryCatch(promise);

    if (error) return error;

    stacks.push(...(response.StackSummaries ?? []));
    nextToken = response.NextToken;
  } while (nextToken);

  console.log("Stacks:");
  for (const s of stacks) {
    console.log(`- ${s.StackName} (${s.StackStatus})`);
  }

  return stacks;
}

export async function listStackResources(stackName: string) {
  const { data: res, error } = await tryCatch(
    cloudformationClient.send(
      new ListStackResourcesCommand({ StackName: stackName })
    )
  );
  if (error) return error;

  console.log(`Resources in ${stackName}:`);
  console.dir(res.StackResourceSummaries, { depth: null });
  return res;
}

export async function detectStackDrift(stackName: string) {
  const { data: result, error } = await tryCatch(
    cloudformationClient.send(
      new DetectStackDriftCommand({ StackName: stackName })
    )
  );

  if (error) return error;

  return {
    driftDetectionId: result.StackDriftDetectionId,
  };
}

export async function describeStackDriftDetectionStatus(
  driftDetectionId: string
) {
  const { data: result, error } = await tryCatch(
    cloudformationClient.send(
      new DescribeStackDriftDetectionStatusCommand({
        StackDriftDetectionId: driftDetectionId,
      })
    )
  );

  if (error) return error;

  return {
    stackDriftStatus: result.StackDriftStatus || "UNKNOWN",
    detectionStatus: result.DetectionStatus || "UNKNOWN",
    driftedStackResourceCount: result.DriftedStackResourceCount,
  };
}

export async function getStackResourceDrifts(stackName: string) {
  const { data: result, error } = await tryCatch(
    cloudformationClient.send(
      new DescribeStackResourceDriftsCommand({
        StackName: stackName,
      })
    )
  );

  if (error) return error;

  return result.StackResourceDrifts || [];
}

export async function runDriftDetection(stackName: string) {
  // Start drift detection
  const driftDetectionResult = await detectStackDrift(stackName);
  if (driftDetectionResult instanceof Error) {
    return driftDetectionResult;
  }
  if (!driftDetectionResult.driftDetectionId) {
    return new Error("Drift detection ID is undefined");
  }

  // Wait for drift detection to complete
  let attempts = 0;
  const maxAttempts = 30; // 30 seconds timeout
  let driftStatus: {
    stackDriftStatus: string;
    detectionStatus: string;
    driftedStackResourceCount?: number;
  };

  do {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

    const statusResult = await describeStackDriftDetectionStatus(
      driftDetectionResult.driftDetectionId
    );

    if (statusResult instanceof Error) {
      return statusResult;
    }

    driftStatus = statusResult;
    attempts++;

    // Check if detection is complete
    if (
      driftStatus.stackDriftStatus === "IN_SYNC" ||
      driftStatus.stackDriftStatus === "DRIFTED"
    ) {
      break;
    }

    if (attempts >= maxAttempts) {
      return new Error("Drift detection timeout - operation took too long");
    }
  } while (
    driftStatus.detectionStatus === "DETECTION_IN_PROGRESS" ||
    driftStatus.detectionStatus === "DETECTION_FAILED"
  );

  // Get resource drifts if stack has drifted
  let resourceDrifts: StackResourceDrift[] = [];
  if (driftStatus.stackDriftStatus === "DRIFTED") {
    const driftsResult = await getStackResourceDrifts(stackName);
    if (driftsResult instanceof Error) {
      console.warn("Failed to get resource drifts:", driftsResult.message);
    } else {
      resourceDrifts = driftsResult;
    }
  }

  // Return the final results
  return {
    stackDriftStatus: driftStatus.stackDriftStatus,
    detectionStatus: driftStatus.detectionStatus,
    driftedStackResourceCount: driftStatus.driftedStackResourceCount,
    resourceDrifts: resourceDrifts,
  };
}
