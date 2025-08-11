import { ActionPanel, Action, Icon, List, showToast, Toast, Color, Form, useNavigation, LocalStorage } from "@raycast/api";
import { useState, useEffect } from "react";

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

const AGENT_OPTIONS = [
  { id: "claude" as ToolId, title: "Claude Code", description: "Anthropic's AI coding assistant" },
  { id: "gemini" as ToolId, title: "Gemini CLI", description: "Google's AI coding assistant" },
  { id: "qwen" as ToolId, title: "Qwen Code CLI", description: "Alibaba's AI coding assistant" },
  { id: "yolo" as ToolId, title: "YOLO", description: "You Only Look Once - AI assistant" },
];

const PACKAGE_MANAGER_OPTIONS = [
  { id: "npm" as PackageManagerId, title: "npm", description: "Node Package Manager" },
  { id: "pnpm" as PackageManagerId, title: "pnpm", description: "Fast, disk space efficient package manager" },
  { id: "yarn" as PackageManagerId, title: "Yarn", description: "Fast, reliable, and secure dependency management" },
];

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

async function saveSettings(settings: Settings): Promise<void> {
  try {
    await LocalStorage.setItem("easy-vibe-settings", JSON.stringify(settings));
  } catch (error) {
    console.error("Error saving settings:", error);
    throw error;
  }
}

function DefaultAgentForm({
  settings,
  onSettingsChange,
}: {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
}) {
  const { pop } = useNavigation();

  const handleSubmit = (values: { defaultVibeAgent: ToolId; packageManager: PackageManagerId; yoloEnabled: boolean }) => {
    onSettingsChange({ 
      ...settings, 
      defaultVibeAgent: values.defaultVibeAgent, 
      packageManager: values.packageManager,
      yoloEnabled: values.yoloEnabled
    });
    pop();
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Settings" icon={Icon.Check} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        id="defaultVibeAgent"
        title="Default Vibe Agent"
        value={settings.defaultVibeAgent}
        onChange={(value) => {
          // Allow immediate preview of changes
          handleSubmit({ 
            defaultVibeAgent: value as ToolId, 
            packageManager: settings.packageManager,
            yoloEnabled: settings.yoloEnabled
          });
        }}
      >
        {AGENT_OPTIONS.map((agent) => (
          <Form.Dropdown.Item key={agent.id} title={agent.title} value={agent.id} />
        ))}
      </Form.Dropdown>
      
      <Form.Dropdown
        id="packageManager"
        title="Package Manager"
        value={settings.packageManager}
        onChange={(value) => {
          // Allow immediate preview of changes
          handleSubmit({ 
            defaultVibeAgent: settings.defaultVibeAgent, 
            packageManager: value as PackageManagerId,
            yoloEnabled: settings.yoloEnabled
          });
        }}
      >
        {PACKAGE_MANAGER_OPTIONS.map((pm) => (
          <Form.Dropdown.Item key={pm.id} title={pm.title} value={pm.id} />
        ))}
      </Form.Dropdown>
      
      <Form.Checkbox
        id="yoloEnabled"
        label="Enable YOLO Agent"
        value={settings.yoloEnabled}
        onChange={(value) => {
          // Allow immediate preview of changes
          handleSubmit({ 
            defaultVibeAgent: settings.defaultVibeAgent, 
            packageManager: settings.packageManager,
            yoloEnabled: value
          });
        }}
      />
    </Form>
  );
}

export default function Command() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeSettings = async () => {
      try {
        const loadedSettings = await loadSettings();
        setSettings(loadedSettings);
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to load settings",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializeSettings();
  }, []);

  const handleSettingsChange = async (newSettings: Settings) => {
    try {
      await saveSettings(newSettings);
      setSettings(newSettings);
      await showToast({
        style: Toast.Style.Success,
        title: "Settings saved",
        message: "Default vibe agent updated successfully",
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to save settings",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search settings...">

      <List.Section title="Available Agents">
        {AGENT_OPTIONS.map((agent) => {
          // Show YOLO agent only if enabled, or if it's currently the default agent
          if (agent.id === "yolo" && !settings.yoloEnabled && agent.id !== settings.defaultVibeAgent) {
            return null;
          }
          
          const isDefault = agent.id === settings.defaultVibeAgent;
          
          return (
            <List.Item
              key={agent.id}
              icon={isDefault ? Icon.CheckCircle : Icon.Circle}
              title={agent.title}
              subtitle={agent.description}
              accessories={[
                {
                  tag: {
                    value: isDefault ? "Default" : "Available",
                    color: isDefault ? Color.Green : Color.SecondaryText,
                  },
                },
              ]}
              actions={
                <ActionPanel>
                  <Action
                    title="Set as Default"
                    icon={Icon.Star}
                    onAction={async () => {
                      if (agent.id !== settings.defaultVibeAgent) {
                        await handleSettingsChange({ ...settings, defaultVibeAgent: agent.id });
                      }
                    }}
                  />
                  <Action.CopyToClipboard title="Copy Agent Name" content={agent.title} />
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>

      <List.Section title="Package Managers">
        {PACKAGE_MANAGER_OPTIONS.map((pm) => {
          const isDefault = pm.id === settings.packageManager;
          
          return (
            <List.Item
              key={pm.id}
              icon={isDefault ? Icon.CheckCircle : Icon.Circle}
              title={pm.title}
              subtitle={pm.description}
              accessories={[
                {
                  tag: {
                    value: isDefault ? "Default" : "Available",
                    color: isDefault ? Color.Green : Color.SecondaryText,
                  },
                },
              ]}
              actions={
                <ActionPanel>
                  <Action
                    title="Set as Default"
                    icon={Icon.Star}
                    onAction={async () => {
                      if (pm.id !== settings.packageManager) {
                        await handleSettingsChange({ ...settings, packageManager: pm.id });
                      }
                    }}
                  />
                  <Action.CopyToClipboard title="Copy Package Manager Name" content={pm.title} />
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>

      <List.Section title="Agent Config">
        <List.Item
          key="yolo-toggle"
          icon={Icon.Bolt}
          title="YOLO Agent"
          subtitle={settings.yoloEnabled ? "Enabled - YOLO agent is available for selection" : "Disabled - YOLO agent is hidden"}
          accessories={[
            {
              tag: {
                value: settings.yoloEnabled ? "Enabled" : "Disabled",
                color: settings.yoloEnabled ? Color.Green : Color.Red,
              },
            },
          ]}
          actions={
            <ActionPanel>
              <Action
                title={settings.yoloEnabled ? "Disable YOLO Agent" : "Enable YOLO Agent"}
                icon={settings.yoloEnabled ? Icon.XMarkCircle : Icon.CheckCircle}
                onAction={async () => {
                  await handleSettingsChange({ ...settings, yoloEnabled: !settings.yoloEnabled });
                }}
              />
              <Action.CopyToClipboard 
                title="Copy YOLO Status" 
                content={settings.yoloEnabled ? "Enabled" : "Disabled"} 
              />
            </ActionPanel>
          }
        />
      </List.Section>
    </List>
  );
}
