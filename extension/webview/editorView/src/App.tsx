import React, { useEffect, useState } from "react";
import type { ClassificationInfo } from "../../treeView/types/types";

type PropertyDiff = {
  PropertyPath?: string;
  ExpectedValue?: any;
  ActualValue?: any;
  DifferenceType?: string;
};

type ResourceDrift = {
  LogicalResourceId?: string;
  ResourceType?: string;
  PhysicalResourceId?: string;
  StackResourceDriftStatus?: string;
  PropertyDifferences?: PropertyDiff[];
};

type DriftResult = {
  stackDriftStatus?: string;
  driftedStackResourceCount?: number;
  resourceDrifts?: ResourceDrift[];
  classificationInfo?: ClassificationInfo;
};

declare global {
  interface Window {
    __DRIFT_DATA__?: { result: DriftResult };
  }
}

function mapDriftToSeverity(
  driftStatus?: string,
  propertyDifferences?: PropertyDiff[]
) {
  if (!driftStatus || driftStatus === "NOT_CHECKED")
    return { drift: "", severity: "Compliance" };
  if (driftStatus === "IN_SYNC")
    return { drift: "In Sync", severity: "Compliance" };
  if (driftStatus === "DELETED")
    return { drift: "Critical", severity: "Availability" };
  if (driftStatus === "MODIFIED") {
    if (!propertyDifferences || propertyDifferences.length === 0)
      return { drift: "Medium", severity: "Compliance" };
    const securityProps = [
      "PolicyDocument",
      "BucketPolicy",
      "AccessControl",
      "PublicAccessBlockConfiguration",
      "Policy",
      "Permissions",
    ];
    const hasSecurity = propertyDifferences.some((d) =>
      securityProps.some((p) => d.PropertyPath?.includes(p))
    );
    if (hasSecurity) return { drift: "Critical", severity: "Security" };
    const availabilityProps = [
      "InstanceId",
      "SubnetId",
      "AvailabilityZone",
      "VolumeId",
      "SubnetIds",
      "VpcId",
    ];
    const hasAvail = propertyDifferences.some((d) =>
      availabilityProps.some((p) => d.PropertyPath?.includes(p))
    );
    if (hasAvail) return { drift: "High", severity: "Availability" };
    if (propertyDifferences.length > 5)
      return { drift: "High", severity: "Compliance" };
    return { drift: "Medium", severity: "Compliance" };
  }
  return { drift: "Low", severity: "Compliance" };
}

const Badge: React.FC<{ level: string; children?: React.ReactNode }> = ({
  level,
  children,
}) => {
  const cls = level.toLowerCase();
  const style = {
    critical: "badge-critical",
    high: "badge-high",
    medium: "badge-medium",
    low: "badge-low",
    "in sync": "badge-in-sync",
  } as any;

  return (
    <span className={`badge ${style[cls] || "badge-default"}`}>{children}</span>
  );
};

export default function App() {
  const [result, setResult] = useState<DriftResult>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    // Try window global first (some callers may set `window.__DRIFT_DATA__`).
    const data = (window as any).__DRIFT_DATA__;
    if (data) {
      // Accept either { result } shape or a direct result
      const resolved = data.result ?? data;
      setResult(resolved || {});
      return;
    }

    // Fallback: read JSON blob injected as <script id="drift-data" type="application/json">...
    try {
      const el = document.getElementById("drift-data");
      if (el && el.textContent) {
        const parsed = JSON.parse(el.textContent);
        if (parsed) {
          // Parsed could be { stackName, result } or could be the result itself
          const resolved = parsed.result ?? parsed;
          // Normalize onto window for later consumers/debugging
          (window as any).__DRIFT_DATA__ = { result: resolved };
          setResult(resolved || {});
        }
      }
    } catch (e) {
      // ignore parse errors
      // expose error for debugging in devtools console
      console.error("Failed to parse drift-data JSON", e);
    }
  }, []);

  const classification: ClassificationInfo | undefined =
    (result as any)?.classificationInfo;

  return (
    <div className="container">
      <div className="header">
        <h1>Drift Detection</h1>
        <div className="header-info">
          <div>
            <strong>Severity:</strong>{" "}
            {classification ? (
              <Badge level={classification.severity}>{classification.severity}</Badge>
            ) : (
              "-"
            )}
          </div>
          <div>
            <strong>Explanation:</strong>{" "}
            {classification && classification.explanation
              ? classification.explanation.length > 140
                ? classification.explanation.slice(0, 140) + "..."
                : classification.explanation
              : "-"}
          </div>
        </div>
      </div>

      {classification ? (
        <div className="classification-section">
          <div className="results-title">Classification</div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Explanation</th>
                  <th>Causes</th>
                  <th>Solutions</th>
                  <th>Problems</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <Badge level={classification.severity}>{classification.severity}</Badge>
                  </td>
                  <td>{classification.explanation || "-"}</td>
                  <td>{classification.causes || "-"}</td>
                  <td>{classification.solutions || "-"}</td>
                  <td>{classification.problems || "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Only show classification info; drift/resource details are omitted when
          using stackInfo-only mode. */}
    </div>
  );
}
