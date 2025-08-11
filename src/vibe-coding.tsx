import { showToast, Toast, LocalStorage } from "@raycast/api";
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
    // Try to get the current directory from the frontmost Finder window
    const { stdout } = await execAsync(`osascript -e '
      tell application "Finder"
        if exists (front window) then
          set currentFolder to (target of front window) as alias
          return POSIX path of currentFolder
        else
          return (home directory) as text
        end if
      end tell
    '`);
    
    const result = stdout.trim();
    if (result && result !== "missing value" && result !== "/" && result !== ".") {
      return result;
    }

    // Fallback to user's home directory
    const { stdout: homeDir } = await runInLoginShell("echo $HOME", "zsh");
    return homeDir.trim() || "/Users/" + (process.env.USER || "unknown");
  } catch (error) {
    console.error("Error getting current directory:", error);
    return process.cwd() || "/unknown";
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

export default async function Command() {
  try {
    const settings = await loadSettings();
    const defaultAgent = settings.defaultVibeAgent;
    const agentCommand = AGENT_COMMANDS[defaultAgent];
    
    await launchAgentInTerminal(agentCommand);
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to launch AI agent",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
