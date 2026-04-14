import { readFileSync } from "fs";
import {
  CloudFormationClient,
  CreateStackCommand,
  DeleteStackCommand,
  DescribeStackDriftDetectionStatusCommand,
  DescribeStackResourceDriftsCommand,
  DescribeStacksCommand,
  DetectStackDriftCommand,
  ListStackRefactorsCommand,
  ListStackResourcesCommand,
  ListStacksCommand,
  ListStacksCommandOutput,
  StackDriftStatus,
  StackResourceDriftStatus,
} from "@aws-sdk/client-cloudformation";

const client = new CloudFormationClient({});

async function deployStack() {
  const templateBody = readFileSync("lab1a.yaml", "utf8");

  await client.send(
    new CreateStackCommand({
      StackName: "MyStack",
      TemplateBody: templateBody,
      Capabilities: ["CAPABILITY_NAMED_IAM"],
    })
  );

  console.log("Stack creation initiated");
}

async function deleteStack() {
  await client.send(
    new DeleteStackCommand({
      StackName: "MyStack",
    })
  );

  console.log("Stack deletion initiated");
}

async function listAllStacks() {
  const stacks: any[] = [];
  let nextToken: string | undefined = undefined;

  do {
    const response: ListStacksCommandOutput = await client.send(
      new ListStacksCommand({
        NextToken: nextToken,
        StackStatusFilter: [
          "CREATE_COMPLETE",
          "UPDATE_COMPLETE",
          "DELETE_COMPLETE",
        ],
      })
    );

    stacks.push(...(response.StackSummaries ?? []));
    nextToken = response.NextToken;
  } while (nextToken);

  console.log("Stacks:");
  for (const s of stacks) {
    console.log(`- ${s.StackName} (${s.StackStatus})`);
  }

  return stacks;
}

async function listStackResources(stackName: string) {
  const res = await client.send(
    new ListStackResourcesCommand({ StackName: stackName })
  );

  console.log(`Resources in ${stackName}:`);
  console.dir(res.StackResourceSummaries, { depth: null });
}

export async function detectDrift(
  stackName: string
): Promise<StackDriftStatus> {
  // 1. Start drift detection
  const detectResp = await client.send(
    new DetectStackDriftCommand({ StackName: stackName })
  );

  const detectionId = detectResp.StackDriftDetectionId;
  if (!detectionId) throw new Error("Failed to start drift detection.");

  console.log(`Started drift detection: ${detectionId}`);

  // 2. Poll until detection is complete
  let status = "DETECTION_IN_PROGRESS";
  let stackDriftStatus: StackDriftStatus | undefined;
  let describeResp;
  while (status === "DETECTION_IN_PROGRESS") {
    await new Promise((r) => setTimeout(r, 5000)); // 5s delay between polls

    describeResp = await client.send(
      new DescribeStackDriftDetectionStatusCommand({
        StackDriftDetectionId: detectionId,
      })
    );

    status = describeResp.DetectionStatus!;
    stackDriftStatus = describeResp.StackDriftStatus;

    console.log(`Detection status: ${status}`);
  }

  console.log(describeResp);

  if (status === "DETECTION_FAILED") {
    throw new Error("Stack drift detection failed.");
  }

  console.log(`Final drift status: ${stackDriftStatus}`);
  return stackDriftStatus!;
}

// deployStack();
// (async () => {
//   const stacks = await listAllStacks();
//   console.log(stacks);
// })();
// deleteStack();

// (async () => {
//   const stacks = await listStackResources(
//     "arn:aws:cloudformation:us-east-1:899013845518:stack/MyStack/ea4056e0-a358-11f0-86cc-12d01354bde1"
//   );
// })();

export async function listDriftedResources(stackName: string) {
  const resp = await client.send(
    new DescribeStackResourceDriftsCommand({
      StackName: stackName,
      StackResourceDriftStatusFilters: [StackResourceDriftStatus.MODIFIED],
    })
  );

  return resp.StackResourceDrifts || [];
}

(async () => {
  try {
    const driftedResources = await listDriftedResources(
      "arn:aws:cloudformation:us-east-1:899013845518:stack/MyStack/ef8a2970-a455-11f0-8098-0e5deec76029"
    );

    console.log(driftedResources);
  } catch (err) {
    console.error("Error listing drifted resources:", err);
  }
})();

// (async () => {
//   try {
//     const driftStatus = await detectDrift(
//       "arn:aws:cloudformation:us-east-1:899013845518:stack/MyStack/ef8a2970-a455-11f0-8098-0e5deec76029"
//     );
//     console.log("Stack Drift Status:", driftStatus);
//   } catch (err) {
//     console.error("Error detecting drift:", err);
//   }
// })();
