import { ActionPanel, Action, Icon, List, showToast, Toast, Color, confirmAlert, LocalStorage } from "@raycast/api";
import { useState, useEffect } from "react";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

type ToolId = "claude" | "gemini" | "qwen" | "yolo";
type PackageManagerId = "npm" | "pnpm" | "yarn";

interface Settings {
  defaultVibeAgent: ToolId;
  packageManager: PackageManagerId;
  yoloEnabled: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  defaultVibeAgent: "claude",
  packageManager: "npm",
  yoloEnabled: false,
};

const AGENT_COMMANDS: Record<ToolId, string> = {
  claude: "claude",
  gemini: "gemini",
  qwen: "qwen",
  yolo: "yolo",
};

const AGENT_DESCRIPTIONS: Record<ToolId, string> = {
  claude: "Anthropic's AI coding assistant",
  gemini: "Google's AI coding assistant",
  qwen: "Alibaba's AI coding assistant",
  yolo: "You Only Look Once - AI assistant",
};

async function loadSettings(): Promise<Settings> {
  try {
    const storedSettings = await LocalStorage.getItem<string>("easy-vibe-settings");
    if (storedSettings) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) };
    }
  } catch (error) {
    console.error("Error loading settings:", error);
  }
  return DEFAULT_SETTINGS;
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

async function getCurrentDirectory(): Promise<string> {
  try {
    const { stdout } = await runInLoginShell("pwd", "zsh");
    return stdout.trim();
  } catch (error) {
    console.error("Error getting current directory:", error);
    return "/unknown";
  }
}

async function launchAgentInTerminal(agentCommand: string): Promise<void> {
  try {
    const currentDir = await getCurrentDirectory();

    // Use AppleScript to open Terminal and run the command
    const appleScript = `
      tell application "Terminal"
        activate
        do script "cd '${currentDir}' && ${agentCommand}"
      end tell
    `;

    const { stderr } = await execAsync(`osascript -e '${appleScript}'`);

    if (stderr) {
      console.warn("AppleScript warning:", stderr);
    }

    await showToast({
      style: Toast.Style.Success,
      title: "Terminal launched",
      message: `${agentCommand} started in ${currentDir}`,
    });
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to launch terminal",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export default function Command() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [currentDirectory, setCurrentDirectory] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeData = async () => {
      try {
        const [loadedSettings, currentDir] = await Promise.all([loadSettings(), getCurrentDirectory()]);
        setSettings(loadedSettings);
        setCurrentDirectory(currentDir);
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to load data",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, []);

  const defaultAgent = settings.defaultVibeAgent;
  const agentCommand = AGENT_COMMANDS[defaultAgent];
  const agentDescription = AGENT_DESCRIPTIONS[defaultAgent];

  const handleLaunchAgent = async () => {
    if (
      await confirmAlert({
        title: "Launch AI Agent",
        message: `Start ${agentCommand} in ${currentDirectory}?`,
        primaryAction: {
          title: "Launch",
          style: Action.Style.Default,
        },
      })
    ) {
      await launchAgentInTerminal(agentCommand);
    }
  };

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Launch AI coding assistant...">
      <List.Section title="Quick Launch">
        <List.Item
          key="launch-default"
          icon={Icon.Terminal}
          title={`Launch ${agentCommand}`}
          subtitle={agentDescription}
          accessories={[
            {
              tag: {
                value: "Default",
                color: Color.Green,
              },
            },
          ]}
          actions={
            <ActionPanel>
              <Action title="Launch in Terminal" icon={Icon.Play} onAction={handleLaunchAgent} />
              <Action.CopyToClipboard title="Copy Command" content={agentCommand} />
              <Action.CopyToClipboard title="Copy Current Directory" content={currentDirectory} />
              <Action.OpenInBrowser
                title="Change Default Agent"
                url="raycast://extensions/easy-vibe/vibe-settings"
                icon={Icon.Gear}
              />
            </ActionPanel>
          }
        />
      </List.Section>

      <List.Section title="Current Directory">
        <List.Item
          key="current-dir"
          icon={Icon.Folder}
          title={currentDirectory}
          subtitle="Working directory for AI agent"
          actions={
            <ActionPanel>
              <Action.CopyToClipboard title="Copy Path" content={currentDirectory} />
              <Action
                title="Reveal in Finder"
                icon={Icon.Eye}
                onAction={async () => {
                  try {
                    await execAsync(`open "${currentDirectory}"`);
                    await showToast({
                      style: Toast.Style.Success,
                      title: "Directory revealed in Finder",
                    });
                  } catch (error) {
                    await showToast({
                      style: Toast.Style.Failure,
                      title: "Failed to reveal directory",
                      message: error instanceof Error ? error.message : "Unknown error",
                    });
                  }
                }}
              />
            </ActionPanel>
          }
        />
      </List.Section>

      </List>
  );
}
