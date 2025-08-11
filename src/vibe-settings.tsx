import { ActionPanel, Action, Icon, List, showToast, Toast, Color, Form, useNavigation, LocalStorage } from "@raycast/api";
import { useState, useEffect } from "react";

type ToolId = "claude" | "gemini" | "qwen";

interface Settings {
  defaultVibeAgent: ToolId;
}

const DEFAULT_SETTINGS: Settings = {
  defaultVibeAgent: "claude",
};

const AGENT_OPTIONS = [
  { id: "claude" as ToolId, title: "Claude Code", description: "Anthropic's AI coding assistant" },
  { id: "gemini" as ToolId, title: "Gemini CLI", description: "Google's AI coding assistant" },
  { id: "qwen" as ToolId, title: "Qwen Code CLI", description: "Alibaba's AI coding assistant" },
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

  const handleSubmit = (values: { defaultVibeAgent: ToolId }) => {
    onSettingsChange({ ...settings, defaultVibeAgent: values.defaultVibeAgent });
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
          handleSubmit({ defaultVibeAgent: value as ToolId });
        }}
      >
        {AGENT_OPTIONS.map((agent) => (
          <Form.Dropdown.Item key={agent.id} title={agent.title} value={agent.id} />
        ))}
      </Form.Dropdown>
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

  const currentAgent = AGENT_OPTIONS.find((agent) => agent.id === settings.defaultVibeAgent);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search settings...">
      <List.Section title="General Settings">
        <List.Item
          key="default-agent"
          icon={Icon.Gear}
          title="Default Vibe Agent"
          subtitle={currentAgent?.title || "Claude Code"}
          accessories={[
            {
              tag: {
                value: currentAgent?.title || "Claude Code",
                color: Color.Blue,
              },
            },
          ]}
          actions={
            <ActionPanel>
              <Action.Push
                title="Change Default Agent"
                icon={Icon.Pencil}
                target={<DefaultAgentForm settings={settings} onSettingsChange={handleSettingsChange} />}
              />
              <Action.CopyToClipboard title="Copy Current Agent" content={currentAgent?.title || "Claude Code"} />
            </ActionPanel>
          }
        />
      </List.Section>

      <List.Section title="Available Agents">
        {AGENT_OPTIONS.map((agent) => (
          <List.Item
            key={agent.id}
            icon={agent.id === settings.defaultVibeAgent ? Icon.CheckCircle : Icon.Circle}
            title={agent.title}
            subtitle={agent.description}
            accessories={[
              {
                tag: {
                  value: agent.id === settings.defaultVibeAgent ? "Default" : "Available",
                  color: agent.id === settings.defaultVibeAgent ? Color.Green : Color.SecondaryText,
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
        ))}
      </List.Section>
    </List>
  );
}
