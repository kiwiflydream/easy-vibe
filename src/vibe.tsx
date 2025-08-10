import { ActionPanel, Action, Icon, List } from "@raycast/api";

const CLAUDE_VERSION = "1.0.72 (Claude Code)";

const ITEMS = [
  {
    id: "claude-version",
    icon: Icon.Code,
    title: "Claude Code Version",
    subtitle: CLAUDE_VERSION,
    accessory: "Current",
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
          accessories={[{ icon: Icon.Text, text: item.accessory }]}
          actions={
            <ActionPanel>
              <Action.CopyToClipboard content={item.subtitle} title="Copy Version" />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
