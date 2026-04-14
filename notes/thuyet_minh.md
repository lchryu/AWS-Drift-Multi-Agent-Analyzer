🎤 SCRIPT DEMO (CLEAN VERSION – PRO STYLE)
🔥 1. Opening

Hello everyone, this is the demo of our project.

Our system is called a Drift Analyzer, which helps detect, analyze, and resolve infrastructure drift automatically.

🧠 2. System Overview

The analyzer operates in three main modes:

Ask mode
Classification mode
Agent mode

Each mode supports a different stage in the drift management process.

⚙️ 3. Ask Mode (Check trạng thái)

First, we use the Ask mode.

Here, we can type a command to check the status of a stack, for example, “my stack”.

The system returns key information such as:

Creation time
Last update
Current status
Recent activities

We can see that the drift status is currently in sync.

To verify this, we also check directly on AWS, and the result matches exactly.

🔄 4. Trigger Drift (tạo lỗi)

Now, we intentionally modify the system by changing the name of an EC2 instance to “Drift Demo”.

After refreshing AWS, we can see that the system detects this change.

The drift status is now updated to drifted.

🧪 5. Classification Mode (phân tích)

Next, we switch to Classification mode to analyze the drift.

The system classifies this case as low severity, because:

It only involves a tag change
It does not affect critical infrastructure components

At the same time, the AI explains:

The root cause of the drift
And provides recommended solutions
🤖 6. Agent Mode (tự động xử lý)

Finally, we use Agent mode to resolve the drift.

The system automatically:

Analyzes the issue
Proposes a solution
Builds a remediation plan

Internally, multiple agents collaborate to ensure accuracy.

The system can also verify and refine the output if needed.

As a result, the drift is successfully resolved through our analyzer.

💾 7. Extra Features

Each analysis or remediation session is saved as a separate conversation.

Users can:

Create new conversations
Rename them
Delete them

This helps keep everything organized.

In addition, the system supports daily notifications, so all drift-related updates can be automatically sent to the user.

🚀 8. Closing

In conclusion, our system provides:

Automatic drift detection
Intelligent analysis
And autonomous resolution

Thank you for listening.