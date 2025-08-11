import { ActionPanel, Action, Icon, List, showToast, Toast, Color } from "@raycast/api";
import { exec } from "child_process";
import { promisify } from "util";
import { useEffect, useState } from "react";

const execAsync = promisify(exec);

type ToolId = "claude" | "gemini" | "qwen";

type ToolConfig = {
  id: ToolId;
  title: string;
  npmPackage: string;
  command: string;
  updateType?: "cli" | "npmGlobal";
  updateCommand?: string;
};

const TOOLS: ToolConfig[] = [
  {
    id: "claude",
    title: "Claude Code Version",
    npmPackage: "@anthropic-ai/claude-code",
    command: "claude",
    updateType: "cli",
    updateCommand: "claude update",
  },
  {
    id: "gemini",
    title: "Gemini CLI Version",
    npmPackage: "@google/gemini-cli",
    command: "gemini",
    updateType: "npmGlobal",
  },
  {
    id: "qwen",
    title: "Qwen Code CLI Version",
    npmPackage: "@qwen-code/qwen-code",
    command: "qwen",
    updateType: "npmGlobal",
  },
];

async function getLatestVersionForPackage(npmPackage: string): Promise<string> {
  try {
    const { stdout, stderr } = await runInLoginShell(`npm view ${npmPackage} version`, "zsh");
    const text = `${stdout}\n${stderr}`.trim();
    const version = extractSemver(text) || text;
    return version;
  } catch (error) {
    console.error("Error getting latest version via npm:", error);
    return "";
  }
}

async function updateClaude() {
  try {
    await showToast({ style: Toast.Style.Animated, title: "Running claude update..." });
    const { stdout, stderr } = await runInLoginShell("claude update", "zsh");
    const text = `${stdout}\n${stderr}`.trim();
    await showToast({
      style: Toast.Style.Success,
      title: "Update completed",
      message: text ? text.split("\n").slice(-1)[0] : undefined,
    });
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Update failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function updateViaNpmGlobal(npmPackage: string) {
  try {
    await showToast({ style: Toast.Style.Animated, title: `Installing ${npmPackage} globally...` });
    const { stdout, stderr } = await runInLoginShell(`npm i -g ${npmPackage}`, "zsh");
    const text = `${stdout}\n${stderr}`.trim();
    await showToast({
      style: Toast.Style.Success,
      title: "Global install completed",
      message: text ? text.split("\n").slice(-1)[0] : undefined,
    });
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Global install failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function updateAllOutdatedTools(tools: ToolConfig[], currentStates: Record<ToolId, ToolState>): Promise<void> {
  const outdatedTools = tools.filter((tool) => currentStates[tool.id]?.status === "outdated");

  if (outdatedTools.length === 0) {
    await showToast({ style: Toast.Style.Success, title: "All tools are up to date" });
    return;
  }

  await showToast({
    style: Toast.Style.Animated,
    title: `Updating ${outdatedTools.length} tool${outdatedTools.length > 1 ? "s" : ""}...`,
  });

  const updateResults = await Promise.allSettled(
    outdatedTools.map(async (tool) => {
      if (tool.updateType === "cli" && tool.updateCommand) {
        await updateClaude();
      } else if (tool.updateType === "npmGlobal") {
        await updateViaNpmGlobal(tool.npmPackage);
      }
      return tool.id;
    }),
  );

  const updatedToolIds = updateResults
    .filter((result): result is PromiseFulfilledResult<ToolId> => result.status === "fulfilled")
    .map((result) => result.value);

  if (updatedToolIds.length > 0) {
    await showToast({
      style: Toast.Style.Success,
      title: `Updated ${updatedToolIds.length} tool${updatedToolIds.length > 1 ? "s" : ""}`,
    });
  }

  const failedCount = updateResults.filter((result) => result.status === "rejected").length;
  if (failedCount > 0) {
    await showToast({
      style: Toast.Style.Failure,
      title: `${failedCount} update${failedCount > 1 ? "s" : ""} failed`,
    });
  }
}

type VersionStatus = "up-to-date" | "outdated" | "unknown";

function compareVersions(current: string, latest: string): VersionStatus {
  if (!current || !latest) return "unknown";
  return current.trim() === latest.trim() ? "up-to-date" : "outdated";
}

async function runInLoginShell(
  command: string,
  shell: "zsh" | "bash" = "zsh",
): Promise<{ stdout: string; stderr: string }> {
  const quoted = command.replace(/"/g, '\\"');
  const shellProgram = shell === "zsh" ? "/bin/zsh" : "/bin/bash";
  const { stdout, stderr } = await execAsync(`${shellProgram} -lc "${quoted}"`);
  return { stdout: stdout?.toString() ?? "", stderr: stderr?.toString() ?? "" };
}

function extractSemver(text: string): string | null {
  const match = text.match(/\d+\.\d+\.\d+(?:[.-][a-zA-Z0-9]+)?/);
  return match ? match[0] : null;
}

async function getInstalledVersionForCommand(
  command: string,
  flags: string[] = ["-v", "--version", "version"],
): Promise<string> {
  for (const flag of flags) {
    try {
      const { stdout, stderr } = await runInLoginShell(`${command} ${flag}`, "zsh");
      const text = `${stdout}\n${stderr}`.trim();
      const version = extractSemver(text) || (text ? text : "");
      if (version) return version;
    } catch {
      // Try next flag
    }
  }
  return "";
}

type ToolState = {
  installedVersion: string;
  latestVersion: string;
  status: VersionStatus;
};

export default function Command() {
  const [toolStates, setToolStates] = useState<Record<ToolId, ToolState>>({
    claude: { installedVersion: "", latestVersion: "", status: "unknown" },
    gemini: { installedVersion: "", latestVersion: "", status: "unknown" },
    qwen: { installedVersion: "", latestVersion: "", status: "unknown" },
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isCancelled = false;
    (async () => {
      setIsLoading(true);
      const installedVersions = await Promise.all(TOOLS.map((t) => getInstalledVersionForCommand(t.command)));
      if (isCancelled) return;

      const latestVersions = await Promise.all(TOOLS.map((t) => getLatestVersionForPackage(t.npmPackage)));
      if (isCancelled) return;

      const nextStates: Record<ToolId, ToolState> = { ...toolStates };
      TOOLS.forEach((t, index) => {
        const installed = installedVersions[index];
        const latest = latestVersions[index];
        nextStates[t.id] = {
          installedVersion: installed || "Not detected",
          latestVersion: latest,
          status: compareVersions(installed, latest),
        };
      });
      setToolStates(nextStates);
      setIsLoading(false);
    })();
    return () => {
      isCancelled = true;
    };
  }, []);

  function getStatusTag(status: VersionStatus, latestVersion: string) {
    return status === "up-to-date"
      ? { value: "Latest", color: Color.Green }
      : status === "outdated"
        ? { value: latestVersion ? `Update ${latestVersion}` : "Update Available", color: Color.Orange }
        : { value: "Unknown", color: Color.SecondaryText };
  }

  const hasOutdatedTools = Object.values(toolStates).some((state) => state.status === "outdated");
  const outdatedToolsCount = Object.values(toolStates).filter((state) => state.status === "outdated").length;

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search AI CLI versions...">
      {hasOutdatedTools && (
        <List.Section title="Updates Available">
          <List.Item
            key="update-all"
            icon={Icon.ArrowClockwise}
            title={`Update All (${outdatedToolsCount} tool${outdatedToolsCount > 1 ? "s" : ""})`}
            subtitle="Update all outdated AI CLI tools"
            actions={
              <ActionPanel>
                <Action
                  title="Update All Outdated Tools"
                  icon={Icon.Download}
                  onAction={async () => {
                    await updateAllOutdatedTools(TOOLS, toolStates);
                    // Refresh all tool states after updates
                    const [installedVersions, latestVersions] = await Promise.all([
                      Promise.all(TOOLS.map((t) => getInstalledVersionForCommand(t.command))),
                      Promise.all(TOOLS.map((t) => getLatestVersionForPackage(t.npmPackage))),
                    ]);

                    const nextStates: Record<ToolId, ToolState> = { ...toolStates };
                    TOOLS.forEach((t, index) => {
                      const installed = installedVersions[index];
                      const latest = latestVersions[index];
                      nextStates[t.id] = {
                        installedVersion: installed || "Not detected",
                        latestVersion: latest,
                        status: compareVersions(installed, latest),
                      };
                    });
                    setToolStates(nextStates);
                  }}
                />
              </ActionPanel>
            }
          />
        </List.Section>
      )}
      <List.Section title={hasOutdatedTools ? "All Tools" : "AI CLI Tools"}>
        {TOOLS.map((tool) => {
          const state = toolStates[tool.id];
          const statusTag = getStatusTag(state?.status ?? "unknown", state?.latestVersion ?? "");
          return (
            <List.Item
              key={`${tool.id}-version`}
              icon={Icon.Code}
              title={tool.title}
              subtitle={state?.installedVersion || ""}
              accessories={[{ tag: statusTag }]}
              actions={
                <ActionPanel>
                  {state?.status === "outdated" ? (
                    <Action
                      title={
                        tool.updateType === "cli"
                          ? `Update Now (${tool.updateCommand})`
                          : `Update Now (npm i -g ${tool.npmPackage})`
                      }
                      icon={Icon.Download}
                      onAction={async () => {
                        if (tool.updateType === "cli" && tool.updateCommand) {
                          await updateClaude();
                        } else if (tool.updateType === "npmGlobal") {
                          await updateViaNpmGlobal(tool.npmPackage);
                        }
                        const [newInstalled, latest] = await Promise.all([
                          getInstalledVersionForCommand(tool.command),
                          getLatestVersionForPackage(tool.npmPackage),
                        ]);
                        setToolStates((prev) => ({
                          ...prev,
                          [tool.id]: {
                            installedVersion: newInstalled || "Not detected",
                            latestVersion: latest,
                            status: compareVersions(newInstalled, latest),
                          },
                        }));
                      }}
                    />
                  ) : (
                    <Action
                      title={
                        state?.status === "up-to-date" ? "Already on the Latest Version" : "Check Installed Version"
                      }
                      icon={Icon.Check}
                      onAction={async () => {
                        await showToast({
                          style: Toast.Style.Success,
                          title:
                            state?.status === "up-to-date"
                              ? "You're on the latest version"
                              : state?.installedVersion
                                ? `Installed: ${state.installedVersion}`
                                : `${tool.command} not detected`,
                        });
                      }}
                    />
                  )}
                  <Action.CopyToClipboard content={state?.installedVersion || ""} title="Copy to Clipboard" />
                  <Action
                    title="Check for Updates"
                    icon={Icon.Globe}
                    onAction={async () => {
                      await showToast({ style: Toast.Style.Animated, title: "Checking for updates..." });
                      const latest = await getLatestVersionForPackage(tool.npmPackage);
                      setToolStates((prev) => ({
                        ...prev,
                        [tool.id]: {
                          installedVersion: prev[tool.id].installedVersion,
                          latestVersion: latest,
                          status: compareVersions(prev[tool.id].installedVersion, latest),
                        },
                      }));
                      const newStatus = compareVersions(state?.installedVersion ?? "", latest);
                      await showToast({
                        style: newStatus === "up-to-date" ? Toast.Style.Success : Toast.Style.Failure,
                        title:
                          newStatus === "up-to-date"
                            ? "You're on the latest version"
                            : latest
                              ? `Update available: ${latest}`
                              : "Update info unavailable",
                      });
                    }}
                  />
                  <Action
                    title="Refresh Installed Version"
                    icon={Icon.Repeat}
                    onAction={async () => {
                      await showToast({ style: Toast.Style.Animated, title: "Detecting installed version..." });
                      const installed = await getInstalledVersionForCommand(tool.command);
                      setToolStates((prev) => ({
                        ...prev,
                        [tool.id]: {
                          installedVersion: installed || "Not detected",
                          latestVersion: prev[tool.id].latestVersion,
                          status: compareVersions(installed, prev[tool.id].latestVersion),
                        },
                      }));
                      await showToast({
                        style: Toast.Style.Success,
                        title: installed ? `Installed: ${installed}` : `${tool.command} not detected`,
                      });
                    }}
                  />
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
    </List>
  );
}
