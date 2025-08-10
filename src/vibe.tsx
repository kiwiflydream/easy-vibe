import { ActionPanel, Action, Icon, List, showToast, Toast } from "@raycast/api";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const CURRENT_VERSION = "1.0.72";
const LATEST_VERSION = "1.0.72";

async function checkForUpdates() {
  try {
    const { stdout } = await execAsync("npm view @anthropic-ai/claude-code version");
    return stdout.trim();
  } catch (error) {
    console.error("Error checking for updates:", error);
    return CURRENT_VERSION;
  }
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

function compareVersions(current: string, latest: string): "up-to-date" | "outdated" {
  return current === latest ? "up-to-date" : "outdated";
}

const versionStatus = compareVersions(CURRENT_VERSION, LATEST_VERSION);

const ITEMS = [
  {
    id: "claude-version",
    icon: Icon.Code,
    title: "Claude Code Version",
    subtitle: CURRENT_VERSION,
    accessory: versionStatus === "up-to-date" ? "Latest" : "Update Available",
    status: versionStatus,
  },
];

export default function Command() {
  return (
    <List>
      {ITEMS.map((item) => (
        <List.Item
          key={item.id}
          icon={item.icon}
          title={item.title}
          subtitle={item.subtitle}
          accessories={[
            { 
              icon: item.status === "up-to-date" ? Icon.Check : Icon.ArrowClockwise, 
              text: item.accessory 
            }
          ]}
          actions={
            <ActionPanel>
              <Action.CopyToClipboard content={item.subtitle} title="Copy Version" />
              {item.status === "outdated" && (
                <Action
                  title="Install Update"
                  icon={Icon.Download}
                  onAction={installUpdate}
                />
              )}
              <Action
                title="Check for Updates"
                icon={Icon.Globe}
                onAction={async () => {
                  await showToast({ style: Toast.Style.Animated, title: "Checking for updates..." });
                  const latestVersion = await checkForUpdates();
                  const status = compareVersions(CURRENT_VERSION, latestVersion);
                  await showToast({ 
                    style: status === "up-to-date" ? Toast.Style.Success : Toast.Style.Failure, 
                    title: status === "up-to-date" ? "You're on the latest version" : `Update available: ${latestVersion}` 
                  });
                }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
