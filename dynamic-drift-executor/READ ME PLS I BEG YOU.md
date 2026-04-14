# 🚀 Dynamic EC2 Drift Executor
# !!! NOT RECOMMENDED TO RUN ALL TESTCASE SINCE THE CASES CONTAIN INSTANCE DELETING OR SOME SHIT LIKE THAT !!!

A **configuration-driven** system to simulate EC2 drift scenarios for testing CloudFormation drift detection. Just edit the JSON file to add new scenarios!

## 🎯 How It Works


```
drift-scenarios.json → Dynamic Executor → AWS EC2 API → Drift Created!
(Configuration)        (Reads & Executes)   (Changes)      (Detected)
```

### The Magic:
1. **Define scenarios in JSON** - No code changes needed
2. **Run executor** - It reads JSON and executes commands
3. **Test in VS Code** - Your extension detects the drift

## 📋 File Structure

```
.
├── drift-scenarios.json           # ← EDIT THIS to add scenarios
├── dynamic-drift-executor.ts      # The dynamic executor (don't edit)
├── ec2-drift-simulator.ts         # Original simple test
├── package.json                   # Dependencies
└── README-DYNAMIC.md             # This file
```

## 🎬 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure
Edit `dynamic-drift-executor.ts`:
```typescript
const REGION = "us-east-1"; // Your AWS region
const INSTANCE_ID = "i-02921d7c833739352"; // OUR EC2 instance ID
```

### 3. List Available Scenarios
```bash
npm run drift -- list
```

Output:
```
📋 Available Drift Scenarios
======================================================================

🔴 High Severity (5 scenarios):
   HIGH-001: EC2 Instance Deleted
      → Terminate EC2 instance
   HIGH-002: Termination Protection Off
      → Disable termination protection
   ...

🟡 Moderate Severity (2 scenarios):
   MOD-001: Instance Size/Type Changed
      → Change instance type to t3.small
   ...

🟢 Low Severity (3 scenarios):
   LOW-001: Instance Name Tag Changed
      → Modify instance name tag
   ...

Total scenarios: 10
```

### 4. Execute Scenarios

**Single scenario:**
```bash
npm run drift -- execute LOW-001
```

**Multiple scenarios:**
```bash
npm run drift -- execute HIGH-002 LOW-001 LOW-002
```

**All scenarios:**
```bash
npm run drift -- execute all
```

## 📝 JSON Configuration Format

Each scenario in `drift-scenarios.json` has this structure:

```json
{
  "testId": "HIGH-002",
  "category": "Termination Protection Off",
  "severity": "High",
  "command": "ModifyInstanceAttribute",
  "parameters": {
    "InstanceId": "${INSTANCE_ID}",
    "DisableApiTermination": {
      "Value": false
    }
  },
  "description": "Disable termination protection",
  "reversible": true,
  "revertCommand": "ModifyInstanceAttribute",
  "revertParameters": {
    "InstanceId": "${INSTANCE_ID}",
    "DisableApiTermination": {
      "Value": true
    }
  }
}
```

### Field Explanations:

| Field | Description | Required |
|-------|-------------|----------|
| `testId` | Unique identifier (e.g., HIGH-001) | ✅ Yes |
| `category` | Drift category from your risk table | ✅ Yes |
| `severity` | High, Moderate, or Low | ✅ Yes |
| `command` | AWS SDK command name | ✅ Yes |
| `parameters` | Command parameters | ✅ Yes |
| `description` | Human-readable description | ✅ Yes |
| `requiresStop` | If instance must be stopped first | ❌ No |
| `reversible` | Can this be reverted? | ❌ No |
| `revertCommand` | Command to undo changes | ❌ No |
| `revertParameters` | Parameters for revert | ❌ No |

### Available Variables:

You can use these placeholders in parameters:
- `${INSTANCE_ID}` - The target instance ID
- `${TIMESTAMP}` - Current timestamp
- `${ORIGINAL_NAME}` - Original instance name
- `${ORIGINAL_ENVIRONMENT}` - Original environment tag

## 🔧 Supported Commands

The executor supports these AWS EC2 commands:

| Command | Use Case |
|---------|----------|
| `CreateTags` | Add/modify tags |
| `DeleteTags` | Remove tags |
| `ModifyInstanceAttribute` | Change instance properties |
| `ModifyInstanceMetadataOptions` | Change IMDS settings |
| `ModifyInstanceCreditSpecification` | Change CPU credits |
| `MonitorInstances` | Enable detailed monitoring |
| `UnmonitorInstances` | Disable detailed monitoring |
| `StopInstances` | Stop instance |
| `StartInstances` | Start instance |
| `TerminateInstances` | Terminate instance (⚠️ dangerous!) |

## ✅ Example: Add a New Scenario

Let's add a scenario to change instance monitoring:

**1. Open `drift-scenarios.json`**

**2. Add this to the `driftScenarios` array:**
```json
{
  "testId": "HIGH-006",
  "category": "Detailed Monitoring Disabled",
  "severity": "High",
  "command": "UnmonitorInstances",
  "parameters": {
    "InstanceIds": ["${INSTANCE_ID}"]
  },
  "description": "Disable CloudWatch detailed monitoring",
  "reversible": true,
  "revertCommand": "MonitorInstances",
  "revertParameters": {
    "InstanceIds": ["${INSTANCE_ID}"]
  }
}
```

**3. Save the file**

**4. Run it:**
```bash
npm run drift -- execute HIGH-006
```

**That's it!** No code changes needed! 🎉

## 📊 Example Output

```
🎬 Starting Drift Execution Session
======================================================================
Region: us-east-1
Instance ID: i-1234567890abcdef0
Scenarios to execute: 2

======================================================================
🎯 Executing: HIGH-002 - Termination Protection Off
======================================================================
📝 Description: Disable termination protection
⚠️  Severity: High
🔧 Command: ModifyInstanceAttribute

📋 Parameters: {
  "InstanceId": "i-1234567890abcdef0",
  "DisableApiTermination": {
    "Value": false
  }
}

🚀 Executing command...
✅ Command executed successfully!

📊 Expected Drift:
   Category: Termination Protection Off
   Severity: High
   Reversible: Yes

======================================================================
✨ Scenario completed successfully!
======================================================================

⏳ Waiting 5 seconds before next scenario...

======================================================================
🎯 Executing: LOW-001 - Instance Name Tag Changed
======================================================================
...

======================================================================
📊 EXECUTION SUMMARY
======================================================================
Total scenarios: 2
✅ Successful: 2
❌ Failed: 0
⚠️  Not found: 0

📋 Detailed Results:
   ✅ HIGH-002: SUCCESS
   ✅ LOW-001: SUCCESS

💡 Next Steps:
   1. Open your VS Code Drift Analyzer extension
   2. Run drift detection on your CloudFormation stack
   3. Verify that all executed drifts are detected
======================================================================
```

## 🎓 How to Create 150 Test Cases

Now that you have the dynamic system:

1. **Use your EC2 risk table** (40 categories)
2. **Create 3-4 variations per category** in the JSON
3. **Each variation = 1 test case**

Example variations for "Tag Changed":
```json
{
  "testId": "LOW-001",
  "category": "Instance Name Tag Changed",
  "parameters": {
    "Tags": [{"Key": "Name", "Value": "NewName"}]
  }
},
{
  "testId": "LOW-002",
  "category": "Instance Name Tag Changed",
  "parameters": {
    "Tags": [{"Key": "Name", "Value": ""}]  // Empty name
  }
},
{
  "testId": "LOW-003",
  "category": "Instance Name Tag Changed",
  "parameters": {
    "Tags": [{"Key": "Name", "Value": "VeryLongNameWith150Characters..."}]
  }
}
```

## ⚠️ Safety Features

- **Instance state management**: Automatically stops/starts when needed
- **Error handling**: Catches and reports errors clearly
- **Reversible operations**: Most scenarios can be undone
- **Summary report**: Shows what succeeded/failed

## 🚨 Important Notes

1. **Test on non-production instances first!**
2. Some operations are **irreversible** (like termination)
3. Operations marked `requiresStop: true` will stop your instance
4. Make sure your AWS credentials have necessary permissions

## 📚 Next Steps

1. ✅ Test with LOW-001 (safe tag change)
2. ✅ Verify drift detection works
3. ✅ Add more scenarios from your EC2 risk table
4. ✅ Create 150 test cases by adding variations
5. ✅ Automate testing in your CI/CD pipeline

## 💡 Pro Tips

- Start with LOW severity scenarios for testing
- Test reversible scenarios first
- Use a dedicated test instance
- Back up your instance before running HIGH severity tests
- Check AWS CloudFormation console after running scenarios

---

**Ready to create your 150 test cases?** Just keep adding scenarios to `drift-scenarios.json`! 🚀


