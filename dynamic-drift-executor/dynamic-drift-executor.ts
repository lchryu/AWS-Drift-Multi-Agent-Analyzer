// dynamic-drift-executor.ts
import { 
  EC2Client,
  AllocateAddressCommand,
  AssignPrivateIpAddressesCommand,
  AssociateAddressCommand,
  AssociateIamInstanceProfileCommand,
  AttachVolumeCommand,
  CreateImageCommand,
  CreateNetworkInterfaceCommand,
  CreatePlacementGroupCommand,
  CreateSecurityGroupCommand,
  CreateTagsCommand,
  CreateVolumeCommand,
  DescribeAddressesCommand,
  DescribeCapacityReservationsCommand,
  DescribeIamInstanceProfileAssociationsCommand,
  DescribeNetworkInterfacesCommand,
  DescribePlacementGroupsCommand,
  DescribeSecurityGroupsCommand,
  DescribeSubnetsCommand,
  DescribeVpcsCommand,
  DescribeVolumesCommand,
  DeleteTagsCommand,
  DetachNetworkInterfaceCommand,
  DetachVolumeCommand,
  DisassociateAddressCommand,
  DisassociateIamInstanceProfileCommand,
  AuthorizeSecurityGroupIngressCommand,
  ModifyInstanceAttributeCommand,
  ModifyInstanceCapacityReservationAttributesCommand,
  ModifyInstancePlacementCommand,
  ModifyInstanceMetadataOptionsCommand,
  ModifyInstanceCreditSpecificationCommand,
  ModifyVolumeCommand,
  MonitorInstancesCommand,
  UnmonitorInstancesCommand,
  TerminateInstancesCommand,
  StopInstancesCommand,
  StartInstancesCommand,
  DescribeInstancesCommand,
  DescribeTagsCommand
} from "@aws-sdk/client-ec2";
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Configuration
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCENARIOS_FILE = path.join(__dirname, "testcases", "drift-scenarios-89.json");
const DEFAULT_VARS_FILE = path.join(__dirname, "vars.json");

type VarsMap = Record<string, string | number | boolean>;

function loadVars(filePath: string): VarsMap {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`vars.json must contain an object of key/value pairs`);
  }
  return parsed as VarsMap;
}

const varsFromFile = loadVars(DEFAULT_VARS_FILE);
const REGION = (varsFromFile.REGION as string) || process.env.DRIFT_REGION || "us-east-1";
const INSTANCE_ID = (varsFromFile.INSTANCE_ID as string) || process.env.DRIFT_INSTANCE_ID || "i-015ae62cdfc6305d9";

const ec2Client = new EC2Client({ region: REGION });

// Command mapping - maps command names to actual AWS SDK command classes
const COMMAND_MAP: Record<string, any> = {
  AssignPrivateIpAddresses: AssignPrivateIpAddressesCommand,
  AssociateAddress: AssociateAddressCommand,
  AssociateIamInstanceProfile: AssociateIamInstanceProfileCommand,
  AttachVolume: AttachVolumeCommand,
  CreateImage: CreateImageCommand,
  CreateNetworkInterface: CreateNetworkInterfaceCommand,
  CreateTags: CreateTagsCommand,
  CreateVolume: CreateVolumeCommand,
  DeleteTags: DeleteTagsCommand,
  DetachNetworkInterface: DetachNetworkInterfaceCommand,
  DetachVolume: DetachVolumeCommand,
  DisassociateAddress: DisassociateAddressCommand,
  DisassociateIamInstanceProfile: DisassociateIamInstanceProfileCommand,
  ModifyInstanceAttribute: ModifyInstanceAttributeCommand,
  ModifyInstanceCapacityReservationAttributes: ModifyInstanceCapacityReservationAttributesCommand,
  ModifyInstancePlacement: ModifyInstancePlacementCommand,
  ModifyInstanceMetadataOptions: ModifyInstanceMetadataOptionsCommand,
  ModifyInstanceCreditSpecification: ModifyInstanceCreditSpecificationCommand,
  ModifyVolume: ModifyVolumeCommand,
  MonitorInstances: MonitorInstancesCommand,
  UnmonitorInstances: UnmonitorInstancesCommand,
  TerminateInstances: TerminateInstancesCommand,
  StopInstances: StopInstancesCommand,
  StartInstances: StartInstancesCommand
};

interface DriftScenario {
  testId: string;
  category: string;
  severity: string;
  command: string;
  parameters: any;
  description: string;
  requiresStop?: boolean;
  reversible?: boolean;
  revertCommand?: string;
  revertParameters?: any;
}

interface DriftScenariosConfig {
  driftScenarios: DriftScenario[];
}

/**
 * Get current instance state and metadata
 */
async function getInstanceMetadata(instanceId: string) {
  try {
    const command = new DescribeInstancesCommand({
      InstanceIds: [instanceId]
    });
    const response = await ec2Client.send(command);
    const instance = response.Reservations?.[0]?.Instances?.[0];
    
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }
    
    return {
      state: instance.State?.Name,
      instanceType: instance.InstanceType,
      tags: instance.Tags,
      name: instance.Tags?.find(t => t.Key === "Name")?.Value || "Unnamed"
    };
  } catch (error) {
    console.error("Error getting instance metadata:", error);
    throw error;
  }
}

/**
 * Replace placeholders in parameters with actual values
 */
function replaceVariables(obj: any, variables: Record<string, any>): any {
  if (typeof obj === 'string') {
    let result = obj;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(`\${${key}}`, String(value));
    }
    return result;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => replaceVariables(item, variables));
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceVariables(value, variables);
    }
    return result;
  }
  
  return obj;
}

function collectMissingPlaceholders(obj: any, variables: Record<string, any>, missing: Set<string>): void {
  if (typeof obj === "string") {
    const matches = obj.match(/\$\{([A-Z0-9_]+)\}/g);
    if (!matches) return;
    for (const raw of matches) {
      const key = raw.replace("${", "").replace("}", "");
      if (variables[key] === undefined && process.env[key] === undefined) {
        missing.add(key);
      }
    }
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item) => collectMissingPlaceholders(item, variables, missing));
    return;
  }
  if (typeof obj === "object" && obj !== null) {
    Object.values(obj).forEach((value) => collectMissingPlaceholders(value, variables, missing));
  }
}

function collectPlaceholders(obj: any, placeholders: Set<string>): void {
  if (typeof obj === "string") {
    const matches = obj.match(/\$\{([A-Z0-9_]+)\}/g);
    if (!matches) return;
    for (const raw of matches) {
      placeholders.add(raw.replace("${", "").replace("}", ""));
    }
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item) => collectPlaceholders(item, placeholders));
    return;
  }
  if (typeof obj === "object" && obj !== null) {
    Object.values(obj).forEach((value) => collectPlaceholders(value, placeholders));
  }
}

async function getInstance(instanceId: string) {
  const command = new DescribeInstancesCommand({ InstanceIds: [instanceId] });
  const response = await ec2Client.send(command);
  const instance = response.Reservations?.[0]?.Instances?.[0];
  if (!instance) {
    throw new Error(`Instance ${instanceId} not found`);
  }
  return instance;
}

/**
 * Stop instance if required
 */
async function stopInstanceIfNeeded(instanceId: string, requiresStop: boolean): Promise<boolean> {
  if (!requiresStop) return false;
  
  console.log("   ⏸️  Stopping instance (required for this change)...");
  
  const metadata = await getInstanceMetadata(instanceId);
  if (metadata.state === 'stopped') {
    console.log("   ℹ️  Instance already stopped");
    return false;
  }
  
  const command = new StopInstancesCommand({ InstanceIds: [instanceId] });
  await ec2Client.send(command);
  
  // Wait for instance to stop
  console.log("   ⏳ Waiting for instance to stop...");
  let attempts = 0;
  while (attempts < 60) { // Max 5 minutes
    const metadata = await getInstanceMetadata(instanceId);
    if (metadata.state === 'stopped') {
      console.log("   ✅ Instance stopped");
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    attempts++;
  }
  
  throw new Error("Timeout waiting for instance to stop");
}

/**
 * Start instance if it was stopped
 */
async function startInstance(instanceId: string) {
  console.log("   ▶️  Starting instance...");
  const command = new StartInstancesCommand({ InstanceIds: [instanceId] });
  await ec2Client.send(command);
  
  console.log("   ⏳ Waiting for instance to start...");
  let attempts = 0;
  while (attempts < 60) {
    const metadata = await getInstanceMetadata(instanceId);
    if (metadata.state === 'running') {
      console.log("   ✅ Instance running");
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;
  }
  
  throw new Error("Timeout waiting for instance to start");
}

/**
 * Execute a drift scenario
 */
async function executeDriftScenario(scenario: DriftScenario, instanceId: string): Promise<void> {
  console.log("\n" + "=".repeat(70));
  console.log(`🎯 Executing: ${scenario.testId} - ${scenario.category}`);
  console.log("=".repeat(70));
  console.log(`📝 Description: ${scenario.description}`);
  console.log(`⚠️  Severity: ${scenario.severity}`);
  console.log(`🔧 Command: ${scenario.command}`);
  
  try {
    // Get current metadata for variable replacement
    const metadata = await getInstanceMetadata(instanceId);
    const variables = {
      INSTANCE_ID: instanceId,
      TIMESTAMP: Date.now(),
      ORIGINAL_NAME: metadata.name,
      ORIGINAL_ENVIRONMENT: metadata.tags?.find(t => t.Key === "Environment")?.Value || "Production",
      ...varsFromFile
    };
    
    // Stop instance if needed
    const wasStopped = await stopInstanceIfNeeded(instanceId, scenario.requiresStop || false);
    
    const missing = new Set<string>();
    collectMissingPlaceholders(scenario.parameters, variables, missing);
    if (missing.size > 0) {
      throw new Error(
        `Missing variables for scenario ${scenario.testId}: ${Array.from(missing).join(", ")}. ` +
        `Define them in ${DEFAULT_VARS_FILE} or as environment variables.`
      );
    }

    // Replace variables in parameters
    const processedParams = replaceVariables(scenario.parameters, variables);
    
    console.log(`\n📋 Parameters:`, JSON.stringify(processedParams, null, 2));
    
    // Get the command class
    const CommandClass = COMMAND_MAP[scenario.command];
    if (!CommandClass) {
      throw new Error(`Unknown command: ${scenario.command}`);
    }
    
    // Create and execute command
    console.log("\n🚀 Executing command...");
    const command = new CommandClass(processedParams);
    const response = await ec2Client.send(command);
    
    console.log("✅ Command executed successfully!");
    
    // Start instance if it was stopped
    if (wasStopped) {
      await startInstance(instanceId);
    }
    
    // Wait a bit for changes to propagate
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log("\n📊 Expected Drift:");
    console.log(`   Category: ${scenario.category}`);
    console.log(`   Severity: ${scenario.severity}`);
    console.log(`   Reversible: ${scenario.reversible ? 'Yes' : 'No'}`);
    
    console.log("\n" + "=".repeat(70));
    console.log("✨ Scenario completed successfully!");
    console.log("=".repeat(70));
    
  } catch (error: any) {
    console.error("\n❌ ERROR:", error.message);
    throw error;
  }
}

/**
 * Execute multiple scenarios
 */
async function executeMultipleScenarios(testIds: string[]): Promise<void> {
  console.log("\n🎬 Starting Drift Execution Session");
  console.log("=".repeat(70));
  console.log(`Region: ${REGION}`);
  console.log(`Instance ID: ${INSTANCE_ID}`);
  console.log(`Scenarios to execute: ${testIds.length}`);
  
  // Load scenarios
  const scenariosData = fs.readFileSync(SCENARIOS_FILE, 'utf-8');
  const config: DriftScenariosConfig = JSON.parse(scenariosData);
  
  const results: { testId: string; status: string; error?: string }[] = [];
  
  for (const testId of testIds) {
    const scenario = config.driftScenarios.find(s => s.testId === testId);
    
    if (!scenario) {
      console.log(`\n⚠️  Scenario ${testId} not found in config file`);
      results.push({ testId, status: 'NOT_FOUND' });
      continue;
    }
    
    try {
      await executeDriftScenario(scenario, INSTANCE_ID);
      results.push({ testId, status: 'SUCCESS' });
    } catch (error: any) {
      console.error(`\n❌ Failed to execute ${testId}: ${error.message}`);
      results.push({ testId, status: 'FAILED', error: error.message });
    }
    
    // Wait between scenarios
    if (testIds.indexOf(testId) < testIds.length - 1) {
      console.log("\n⏳ Waiting 5 seconds before next scenario...\n");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  // Print summary
  console.log("\n" + "=".repeat(70));
  console.log("📊 EXECUTION SUMMARY");
  console.log("=".repeat(70));
  console.log(`Total scenarios: ${testIds.length}`);
  console.log(`✅ Successful: ${results.filter(r => r.status === 'SUCCESS').length}`);
  console.log(`❌ Failed: ${results.filter(r => r.status === 'FAILED').length}`);
  console.log(`⚠️  Not found: ${results.filter(r => r.status === 'NOT_FOUND').length}`);
  
  console.log("\n📋 Detailed Results:");
  results.forEach(r => {
    const icon = r.status === 'SUCCESS' ? '✅' : r.status === 'FAILED' ? '❌' : '⚠️';
    console.log(`   ${icon} ${r.testId}: ${r.status}${r.error ? ` (${r.error})` : ''}`);
  });
  
  console.log("\n💡 Next Steps:");
  console.log("   1. Open your VS Code Drift Analyzer extension");
  console.log("   2. Run drift detection on your CloudFormation stack");
  console.log("   3. Verify that all executed drifts are detected");
  console.log("=".repeat(70));
}

async function generateVarsFile(outputPath: string, createResources: boolean): Promise<void> {
  console.log("\n🔍 Generating vars.json from AWS environment...");
  const instance = await getInstance(INSTANCE_ID);

  const vpcId = instance.VpcId;
  const subnetId = instance.SubnetId;
  const az = instance.Placement?.AvailabilityZone;
  const sgIds = (instance.SecurityGroups || [])
    .map(sg => sg.GroupId)
    .filter((id): id is string => Boolean(id));

  const primaryEni = instance.NetworkInterfaces?.[0];
  const rootDeviceName = instance.RootDeviceName;
  const rootVolumeId = instance.BlockDeviceMappings
    ?.find(m => m.DeviceName === rootDeviceName)?.Ebs?.VolumeId;
  const attachedVolumeId = instance.BlockDeviceMappings
    ?.find(m => m.Ebs?.VolumeId && m.Ebs?.VolumeId !== rootVolumeId)?.Ebs?.VolumeId;

  let additionalVolumeId: string | undefined;
  if (az) {
    const vols = await ec2Client.send(new DescribeVolumesCommand({
      Filters: [
        { Name: "availability-zone", Values: [az] },
        { Name: "status", Values: ["available"] }
      ]
    }));
    additionalVolumeId = vols.Volumes?.[0]?.VolumeId;
  }

  let eniId = primaryEni?.NetworkInterfaceId;
  let eniAttachmentId = primaryEni?.Attachment?.AttachmentId;
  if (!eniId) {
    const eniResp = await ec2Client.send(new DescribeNetworkInterfacesCommand({
      Filters: [{ Name: "attachment.instance-id", Values: [INSTANCE_ID] }]
    }));
    const eni = eniResp.NetworkInterfaces?.[0];
    eniId = eni?.NetworkInterfaceId;
    eniAttachmentId = eni?.Attachment?.AttachmentId;
  }

  let allSecurityGroups: { GroupId?: string; IpPermissions?: any[] }[] = [];
  let resolvedVpcId = vpcId;
  if (!resolvedVpcId) {
    const vpcResp = await ec2Client.send(new DescribeVpcsCommand({}));
    resolvedVpcId = vpcResp.Vpcs?.[0]?.VpcId;
  }
  if (resolvedVpcId) {
    const sgResp = await ec2Client.send(new DescribeSecurityGroupsCommand({
      Filters: [{ Name: "vpc-id", Values: [resolvedVpcId] }]
    }));
    allSecurityGroups = sgResp.SecurityGroups || [];
  }

  const isOpenToWorld = (perm: any, port?: number) => {
    const cidrOpen = (perm.IpRanges || []).some((r: any) => r.CidrIp === "0.0.0.0/0");
    const cidrOpenV6 = (perm.Ipv6Ranges || []).some((r: any) => r.CidrIpv6 === "::/0");
    if (!cidrOpen && !cidrOpenV6) return false;
    if (perm.IpProtocol === "-1") return true;
    if (port === undefined) return false;
    const from = perm.FromPort ?? -1;
    const to = perm.ToPort ?? -1;
    return from <= port && port <= to;
  };

  const findOpenSg = (port?: number) => {
    for (const sg of allSecurityGroups) {
      for (const perm of sg.IpPermissions || []) {
        if (isOpenToWorld(perm, port)) {
          return sg.GroupId;
        }
      }
    }
    return undefined;
  };

  let openSg = findOpenSg(22);
  let rdpSg = findOpenSg(3389);
  let allPortsSg = findOpenSg(undefined);

  let differentSgId: string | undefined;
  if (sgIds.length >= 2) {
    differentSgId = sgIds[1];
  } else {
    differentSgId = allSecurityGroups.find(sg => sg.GroupId && !sgIds.includes(sg.GroupId))?.GroupId;
  }

  let differentSubnetId: string | undefined;
  if (vpcId) {
    const subnets = await ec2Client.send(new DescribeSubnetsCommand({
      Filters: [{ Name: "vpc-id", Values: [vpcId] }]
    }));
    differentSubnetId = subnets.Subnets?.find(s => s.SubnetId && s.SubnetId !== subnetId)?.SubnetId;
  }

  const iamAssoc = await ec2Client.send(new DescribeIamInstanceProfileAssociationsCommand({
    Filters: [{ Name: "instance-id", Values: [INSTANCE_ID] }]
  }));
  const iamAssociationId = iamAssoc.IamInstanceProfileAssociations?.[0]?.AssociationId;
  const adminProfileArn = iamAssoc.IamInstanceProfileAssociations?.[0]?.IamInstanceProfile?.Arn;

  const addrResp = await ec2Client.send(new DescribeAddressesCommand({
    Filters: [{ Name: "instance-id", Values: [INSTANCE_ID] }]
  }));
  let eipAllocationId = addrResp.Addresses?.[0]?.AllocationId;
  let eipAssociationId = addrResp.Addresses?.[0]?.AssociationId;
  if (!eipAllocationId) {
    const anyAddr = await ec2Client.send(new DescribeAddressesCommand({}));
    eipAllocationId = anyAddr.Addresses?.[0]?.AllocationId;
    eipAssociationId = anyAddr.Addresses?.[0]?.AssociationId;
  }

  const placementResp = await ec2Client.send(new DescribePlacementGroupsCommand({}));
  const placementGroups = placementResp.PlacementGroups || [];
  let placementGroupName = placementGroups[0]?.GroupName;
  let differentPlacementGroup = placementGroups[1]?.GroupName;

  const capacityResp = await ec2Client.send(new DescribeCapacityReservationsCommand({}));
  const reservationId = capacityResp.CapacityReservations?.[0]?.CapacityReservationId;

  const created: string[] = [];
  if (createResources) {
    const suffix = Date.now();
    if (!openSg && resolvedVpcId) {
      const res = await ec2Client.send(new CreateSecurityGroupCommand({
        GroupName: `drift-open-22-${suffix}`,
        Description: "Drift test SG: SSH open to 0.0.0.0/0",
        VpcId: resolvedVpcId
      }));
      openSg = res.GroupId;
      if (openSg) {
        await ec2Client.send(new AuthorizeSecurityGroupIngressCommand({
          GroupId: openSg,
          IpPermissions: [{
            IpProtocol: "tcp",
            FromPort: 22,
            ToPort: 22,
            IpRanges: [{ CidrIp: "0.0.0.0/0" }]
          }]
        }));
        created.push("OPEN_SECURITY_GROUP");
      }
    }

    if (!rdpSg && resolvedVpcId) {
      const res = await ec2Client.send(new CreateSecurityGroupCommand({
        GroupName: `drift-open-3389-${suffix}`,
        Description: "Drift test SG: RDP open to 0.0.0.0/0",
        VpcId: resolvedVpcId
      }));
      rdpSg = res.GroupId;
      if (rdpSg) {
        await ec2Client.send(new AuthorizeSecurityGroupIngressCommand({
          GroupId: rdpSg,
          IpPermissions: [{
            IpProtocol: "tcp",
            FromPort: 3389,
            ToPort: 3389,
            IpRanges: [{ CidrIp: "0.0.0.0/0" }]
          }]
        }));
        created.push("RDP_OPEN_SG");
      }
    }

    if (!allPortsSg && resolvedVpcId) {
      const res = await ec2Client.send(new CreateSecurityGroupCommand({
        GroupName: `drift-open-all-${suffix}`,
        Description: "Drift test SG: all ports open to 0.0.0.0/0",
        VpcId: resolvedVpcId
      }));
      allPortsSg = res.GroupId;
      if (allPortsSg) {
        await ec2Client.send(new AuthorizeSecurityGroupIngressCommand({
          GroupId: allPortsSg,
          IpPermissions: [{
            IpProtocol: "-1",
            IpRanges: [{ CidrIp: "0.0.0.0/0" }]
          }]
        }));
        created.push("ALL_PORTS_OPEN_SG");
      }
    }

    if (!differentSgId && resolvedVpcId) {
      const res = await ec2Client.send(new CreateSecurityGroupCommand({
        GroupName: `drift-secondary-sg-${suffix}`,
        Description: "Drift test SG: secondary group",
        VpcId: resolvedVpcId
      }));
      differentSgId = res.GroupId;
      if (differentSgId) {
        created.push("DIFFERENT_SG_ID");
      }
    }

    if (!placementGroupName) {
      await ec2Client.send(new CreatePlacementGroupCommand({
        GroupName: `drift-pg-${suffix}`,
        Strategy: "cluster"
      }));
      placementGroupName = `drift-pg-${suffix}`;
      created.push("PLACEMENT_GROUP_NAME");
    }

    if (!differentPlacementGroup) {
      await ec2Client.send(new CreatePlacementGroupCommand({
        GroupName: `drift-pg-alt-${suffix}`,
        Strategy: "spread"
      }));
      differentPlacementGroup = `drift-pg-alt-${suffix}`;
      created.push("DIFFERENT_PLACEMENT_GROUP");
    }

    if (!additionalVolumeId && az) {
      const vol = await ec2Client.send(new CreateVolumeCommand({
        AvailabilityZone: az,
        Size: 10,
        VolumeType: "gp3"
      }));
      additionalVolumeId = vol.VolumeId;
      if (additionalVolumeId) {
        created.push("ADDITIONAL_VOLUME_ID");
      }
    }

    if (!eipAllocationId) {
      const alloc = await ec2Client.send(new AllocateAddressCommand({ Domain: "vpc" }));
      eipAllocationId = alloc.AllocationId;
      created.push("EIP_ALLOCATION_ID");
      if (eipAllocationId) {
        const assoc = await ec2Client.send(new AssociateAddressCommand({
          AllocationId: eipAllocationId,
          InstanceId: INSTANCE_ID
        }));
        eipAssociationId = assoc.AssociationId;
        if (eipAssociationId) {
          created.push("EIP_ASSOCIATION_ID");
        }
      }
    }
  }

  const vars: VarsMap = {
    REGION,
    INSTANCE_ID
  };
  if (az) vars.AZ = az;
  if (rootVolumeId) vars.ROOT_VOLUME_ID = rootVolumeId;
  if (attachedVolumeId) vars.ATTACHED_VOLUME_ID = attachedVolumeId;
  if (additionalVolumeId) vars.ADDITIONAL_VOLUME_ID = additionalVolumeId;
  if (eniId) vars.ENI_ID = eniId;
  if (eniAttachmentId) vars.ENI_ATTACHMENT_ID = eniAttachmentId;
  if (subnetId) vars.SUBNET_ID = subnetId;
  if (differentSubnetId) vars.DIFFERENT_SUBNET = differentSubnetId;
  if (sgIds[0]) vars.SECURITY_GROUP = sgIds[0];
  if (sgIds[0]) vars.SG_1 = sgIds[0];
  if (sgIds[1]) vars.SG_2 = sgIds[1];
  if (!vars.SG_2 && differentSgId) vars.SG_2 = differentSgId;
  if (differentSgId) vars.DIFFERENT_SG_ID = differentSgId;
  if (openSg) vars.OPEN_SECURITY_GROUP = openSg;
  if (rdpSg) vars.RDP_OPEN_SG = rdpSg;
  if (allPortsSg) vars.ALL_PORTS_OPEN_SG = allPortsSg;
  if (iamAssociationId) vars.IAM_ASSOCIATION_ID = iamAssociationId;
  if (adminProfileArn) vars.ADMIN_PROFILE_ARN = adminProfileArn;
  if (eipAllocationId) vars.EIP_ALLOCATION_ID = eipAllocationId;
  if (eipAssociationId) vars.EIP_ASSOCIATION_ID = eipAssociationId;
  if (placementGroupName) vars.PLACEMENT_GROUP_NAME = placementGroupName;
  if (differentPlacementGroup) vars.DIFFERENT_PLACEMENT_GROUP = differentPlacementGroup;
  if (reservationId) vars.RESERVATION_ID = reservationId;

  const scenariosData = fs.readFileSync(SCENARIOS_FILE, "utf-8");
  const config: DriftScenariosConfig = JSON.parse(scenariosData);
  const placeholders = new Set<string>();
  config.driftScenarios.forEach(s => collectPlaceholders(s, placeholders));

  const missing = Array.from(placeholders).filter(k => vars[k] === undefined).sort();

  const output = {
    ...vars,
    __created: created,
    __missing: missing
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ Wrote ${outputPath}`);
  if (missing.length > 0) {
    console.log("\n⚠️  Missing variables (please fill these in vars.json):");
    missing.forEach(k => console.log(`   - ${k}`));
  } else {
    console.log("\n✅ All required variables resolved.");
  }
}

/**
 * List all available scenarios
 */
function listScenarios(): void {
  const scenariosData = fs.readFileSync(SCENARIOS_FILE, 'utf-8');
  const config: DriftScenariosConfig = JSON.parse(scenariosData);
  
  console.log("\n📋 Available Drift Scenarios");
  console.log("=".repeat(70));
  
  const bySeverity: Record<string, DriftScenario[]> = {
    High: [],
    Moderate: [],
    Low: []
  };
  
  config.driftScenarios.forEach(s => {
    bySeverity[s.severity]?.push(s);
  });
  
  for (const [severity, scenarios] of Object.entries(bySeverity)) {
    const icon = severity === 'High' ? '🔴' : severity === 'Moderate' ? '🟡' : '🟢';
    console.log(`\n${icon} ${severity} Severity (${scenarios.length} scenarios):`);
    scenarios.forEach(s => {
      console.log(`   ${s.testId}: ${s.category}`);
      console.log(`      → ${s.description}`);
    });
  }
  
  console.log("\n=".repeat(70));
  console.log(`Total scenarios: ${config.driftScenarios.length}`);
}

// CLI Interface
const args = process.argv.slice(2);
const command = args[0];

if (command === 'list') {
  listScenarios();
} else if (command === 'generate-vars') {
  const outputPath = DEFAULT_VARS_FILE;
  const createResources = args.includes("--create");
  generateVarsFile(outputPath, createResources).catch(console.error);
} else if (command === 'execute') {
  const testIds = args.slice(1);
  if (testIds.length === 0) {
    console.log("Usage: npm run execute -- execute HIGH-001 HIGH-002 LOW-001");
    console.log("Or:    npm run execute -- execute all");
    process.exit(1);
  }
  
  if (testIds[0] === 'all') {
    const scenariosData = fs.readFileSync(SCENARIOS_FILE, 'utf-8');
    const config: DriftScenariosConfig = JSON.parse(scenariosData);
    const allIds = config.driftScenarios.map(s => s.testId);
    executeMultipleScenarios(allIds).catch(console.error);
  } else {
    executeMultipleScenarios(testIds).catch(console.error);
  }
} else {
  console.log("\n🎯 Dynamic Drift Executor");
  console.log("=".repeat(70));
  console.log("\nUsage:");
  console.log("  npm run drift -- list                    # List all scenarios");
  console.log("  npm run drift -- generate-vars           # Auto-generate vars.json");
  console.log("  npm run drift -- generate-vars --create  # Auto-generate and create missing resources");
  console.log("  npm run drift -- execute HIGH-001        # Execute one scenario");
  console.log("  npm run drift -- execute HIGH-001 LOW-001 # Execute multiple");
  console.log("  npm run drift -- execute all             # Execute all scenarios");
  console.log("\n=".repeat(70));
}
