# Drift Analyzer for AWS CloudFormation
Drift Analyzer is a Visual Studio Code extension that helps you detect and monitor configuration drift in your AWS CloudFormation stacks directly from the editor.\
It integrates with the AWS SDK to list stacks, run drift detection, and display drift results in a dedicated Tree View panel - allowing developers and DevOps engineers to quickly identify differences between deployed resources and their templates without leaving VS Code.

## Features

- List all AWS CloudFormation stacks in your selected region  
- Group stacks by their current status (CREATE_COMPLETE, UPDATE_COMPLETE, etc.)  
- Run drift detection for selected stacks  
- Display detailed drift results including expected vs. actual resource properties  
- Open AWS resources directly in the AWS Console from VS Code

## ⚙️ Setup and Installation

### 🧩 Prerequisites

Before running the extension, make sure the following tools are installed and configured:

1. **AWS CLI**

   - Install the AWS Command Line Interface:

     ```bash
     pip install awscli
     ```

   - Configure your AWS credentials by running:

     ```bash
     aws configure
     ```

   - Verify:
      ```bash
      aws sts get-caller-identity
      ```

   - Ensure that you are successfully logged in to your AWS account.

2. **🟩 Node.js Runtime**

   - Install the latest **LTS version** of Node.js from [nodejs.org](https://nodejs.org/).
   - Verify the installation:

     ```bash
     node -v
     npm -v
     ```

---

### 🚀 Installation and Running

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Compile the project**

   ```bash
   npm run compile
   ```

3. **Run the extension**

   - Press **F5** in VS Code, **or**
   - Open the **Run and Debug** tab → click **Run Extension**.

## Extension Settings

This extension contributes the following setting:

- `myExtension.statusFilter`: A list of CloudFormation stack statuses to display (e.g., `CREATE_COMPLETE`, `UPDATE_COMPLETE`).

## Known Issues

* Running Run Drift Analyzer from the Command Palette may fail if:

   * AWS credentials are missing, expired, or not configured properly.
      To fix this, run aws configure or aws sso login to refresh credentials.

   * The command drift-analyzer.run is not registered correctly in package.json.

   * The CloudFormation client encounters permission or network issues.

   * The extension is activated before the Tree Data Provider is initialized, which may cause undefined or cannot read property errors.

* Stack list may not refresh if AWS credentials are expired.
   * Users should re-authenticate using the AWS CLI and reload the extension.

* Drift detection may time out for large stacks.
   * The CloudFormation drift detection operation can exceed the SDK’s default timeout (30 seconds). The extension may not currently poll for completion.

## Release Notes

### Alpha 0.1
Initial release of Drift Analyzer tool
- Added stack listing, drift detection, and AWS Console link support.

## Developer Notes

This extension was built using:
- TypeScript
- AWS SDK v3
- VS Code Extension API

## Credits

This extension was developed by a team of Swinburne University of Technology (Vietnam) students for Capstone Project A.