import { ActionPanel, Action, Icon, List, showToast, Toast, Color } from "@raycast/api";
import { exec } from "child_process";
import { promisify } from "util";
import { useEffect, useState } from "react";
import * as https from "https";

const execAsync = promisify(exec);

async function getLatestVersion(): Promise<string> {
  const shells: Array<"zsh" | "bash"> = ["zsh", "bash"];
  const commands = [
    "npm view @anthropic-ai/claude-code version",
    "npm view @anthropic-ai/claude-code version --silent",
    "npm view @anthropic-ai/claude-code version --json",
    // explicit npm paths on macOS
    "/opt/homebrew/bin/npm view @anthropic-ai/claude-code version",
    "/usr/local/bin/npm view @anthropic-ai/claude-code version",
  ];
  for (const shell of shells) {
    for (const cmd of commands) {
      try {
        const { stdout } = await runInLoginShell(cmd, shell);
        const out = stdout.trim();
        if (!out) continue;
        // If it's JSON, parse; otherwise return raw trimmed
        if (out.startsWith("\"") || out.startsWith("{")) {
          try {
            const parsed = JSON.parse(out);
            if (typeof parsed === "string") return parsed.trim();
            if (parsed && typeof parsed.version === "string") return parsed.version.trim();
          } catch {
            // fallthrough to plain text
          }
        }
        return out;
      } catch (_) {
        // try next
      }
    }
  }
  // Fallback to querying registry via curl
  try {
    const { stdout } = await runInLoginShell(
      'curl -s https://registry.npmjs.org/%40anthropic-ai%2Fclaude-code/latest'
    );
    const text = stdout.trim();
    if (text) {
      const data = JSON.parse(text);
      const version = (data && data.version) || "";
      if (typeof version === "string" && version) return version.trim();
    }
  } catch (_) {
    // ignore
  }
  // Fallback to querying registry via Node https (no external tools)
  try {
    const version = await new Promise<string>((resolve) => {
      const req = https.get("https://registry.npmjs.org/%40anthropic-ai%2Fclaude-code/latest", (res) => {
        if (!res || res.statusCode !== 200) {
          resolve("");
          return;
        }
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            const v = typeof parsed?.version === "string" ? parsed.version.trim() : "";
            resolve(v);
          } catch {
            resolve("");
          }
        });
      });
      req.on("error", () => resolve(""));
      req.end();
    });
    if (version) return version;
  } catch (_) {
    // ignore
  }
  return "";
}

async function installUpdate() {
  try {
    await showToast({ style: Toast.Style.Animated, title: "Updating Claude Code..." });
    await execAsync("npm install -g @anthropic-ai/claude-code");
    await showToast({ style: Toast.Style.Success, title: "Update completed successfully!" });
  } catch (error) {
    await showToast({ style: Toast.Style.Failure, title: "Update failed", message: error instanceof Error ? error.message : "Unknown error" });
  }
}

type VersionStatus = "up-to-date" | "outdated" | "unknown";

function compareVersions(current: string, latest: string): VersionStatus {
  if (!current || !latest) return "unknown";
  return current.trim() === latest.trim() ? "up-to-date" : "outdated";
}

async function runInLoginShell(command: string, shell: "bash" | "zsh" = "bash"): Promise<{ stdout: string; stderr: string }> {
  const quoted = command.replace(/"/g, '\\"');
  const shellProgram = shell === "zsh" ? "/bin/zsh" : "/bin/bash";
  const { stdout, stderr } = await execAsync(`${shellProgram} -lc "${quoted}"`);
  return { stdout: stdout?.toString() ?? "", stderr: stderr?.toString() ?? "" };
}

function extractSemver(text: string): string | null {
  const match = text.match(/\d+\.\d+\.\d+(?:[.-][a-zA-Z0-9]+)?/);
  return match ? match[0] : null;
}

async function getInstalledVersion(): Promise<string> {
  const shells: Array<"bash" | "zsh"> = ["zsh", "bash"];
  const candidates = [
    "claude -v",
    "claude --version",
    "claude-code -v",
    "claude-code --version",
    // explicit paths commonly used on macOS
    "/opt/homebrew/bin/claude -v",
    "/usr/local/bin/claude -v",
  ];

  for (const shell of shells) {
    for (const cmd of candidates) {
      try {
        const { stdout, stderr } = await runInLoginShell(cmd, shell);
        const text = `${stdout}\n${stderr}`.trim();
        const version = extractSemver(text) || (text ? text : null);
        if (version) return version;
      } catch (error) {
        // try next candidate
      }
    }
  }

  // Try to locate via which/command -v and then execute
  for (const shell of shells) {
    try {
      const { stdout } = await runInLoginShell('command -v claude || which claude', shell);
      const path = stdout.trim();
      if (path) {
        const { stdout: vStdout, stderr: vStderr } = await runInLoginShell(`"${path}" -v`, shell);
        const text = `${vStdout}\n${vStderr}`.trim();
        const version = extractSemver(text) || (text ? text : null);
        if (version) return version;
      }
    } catch (error) {
      // ignore
    }
  }

  // Fallback: query npm global list
  for (const shell of shells) {
    try {
      const { stdout } = await runInLoginShell("npm ls -g @anthropic-ai/claude-code --depth=0 --json", shell);
      const parsed = JSON.parse(stdout || "{}");
      const version: string | undefined = parsed?.dependencies?.["@anthropic-ai/claude-code"]?.version;
      if (version) return version;
    } catch (error) {
      // try next fallback
    }
  }

  // Fallback: read package.json directly using npm prefix -g
  for (const shell of shells) {
    try {
      const { stdout: prefixStdout } = await runInLoginShell("npm prefix -g", shell);
      const prefix = prefixStdout.trim();
      if (prefix) {
        const cmd = `node -e "const p=process.argv[1];const path=require('path');try{const pkg=require(path.join(p,'node_modules','@anthropic-ai','claude-code','package.json'));console.log(pkg.version||'');}catch(e){process.exit(1)}" "${prefix}"`;
        const { stdout: nodeStdout } = await runInLoginShell(cmd, shell);
        const ver = nodeStdout.trim();
        if (ver) return ver;
      }
    } catch (error) {
      // ignore
    }
  }

  return "";
}

export default function Command() {
  const [installedVersion, setInstalledVersion] = useState<string>("");
  const [latestVersion, setLatestVersion] = useState<string>("");
  const [status, setStatus] = useState<VersionStatus>("unknown");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isCancelled = false;
    (async () => {
      setIsLoading(true);
      const installed = await getInstalledVersion();
      if (isCancelled) return;
      setInstalledVersion(installed || "Not detected");

      const latest = await getLatestVersion();
      if (isCancelled) return;
      setLatestVersion(latest);

      setStatus(compareVersions(installed, latest));
      setIsLoading(false);
    })();
    return () => {
      isCancelled = true;
    };
  }, []);

  const statusTag =
    status === "up-to-date"
      ? { value: "Latest", color: Color.Green }
      : status === "outdated"
      ? { value: latestVersion ? `Update ${latestVersion}` : "Update Available", color: Color.Orange }
      : { value: "Unknown", color: Color.SecondaryText };

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Claude Code">
      <List.Item
        key="claude-version"
        icon={Icon.Code}
        title="Claude Code Version"
        subtitle={installedVersion || ""}
        accessories={[{ tag: statusTag }]}
        actions={
          <ActionPanel>
            <Action.CopyToClipboard content={installedVersion || ""} title="Copy Version" />
            {status === "outdated" && (
              <Action
                title="Install Update"
                icon={Icon.Download}
                onAction={async () => {
                  await installUpdate();
                  const [newInstalled, latest] = await Promise.all([
                    getInstalledVersion(),
                    getLatestVersion(),
                  ]);
                  setInstalledVersion(newInstalled || "Not detected");
                  setLatestVersion(latest);
                  const newStatus = compareVersions(newInstalled, latest);
                  setStatus(newStatus);
                }}
              />
            )}
            <Action
              title="Check for Updates"
              icon={Icon.Globe}
              onAction={async () => {
                await showToast({ style: Toast.Style.Animated, title: "Checking for updates..." });
                const latest = await getLatestVersion();
                setLatestVersion(latest);
                const newStatus = compareVersions(installedVersion, latest);
                setStatus(newStatus);
                await showToast({
                  style: newStatus === "up-to-date" ? Toast.Style.Success : Toast.Style.Failure,
                  title: newStatus === "up-to-date" ? "You're on the latest version" : (latest ? `Update available: ${latest}` : "Update info unavailable"),
                });
              }}
            />
            <Action
              title="Refresh Installed Version"
              icon={Icon.Repeat}
              onAction={async () => {
                await showToast({ style: Toast.Style.Animated, title: "Detecting installed version..." });
                const installed = await getInstalledVersion();
                setInstalledVersion(installed || "Not detected");
                setStatus(compareVersions(installed, latestVersion));
                await showToast({ style: Toast.Style.Success, title: installed ? `Installed: ${installed}` : "Claude not detected" });
              }}
            />
          </ActionPanel>
        }
      />
    </List>
  );
}
