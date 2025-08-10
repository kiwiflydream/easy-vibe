"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Command;
const jsx_runtime_1 = require("react/jsx-runtime");
const api_1 = require("@raycast/api");
const child_process_1 = require("child_process");
const util_1 = require("util");
const react_1 = require("react");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
async function checkForUpdates() {
    try {
        const { stdout } = await execAsync("npm view @anthropic-ai/claude-code version");
        return stdout.trim();
    }
    catch (error) {
        console.error("Error checking for updates:", error);
        return "";
    }
}
async function installUpdate() {
    try {
        await (0, api_1.showToast)({ style: api_1.Toast.Style.Animated, title: "Updating Claude Code..." });
        await execAsync("npm install -g @anthropic-ai/claude-code");
        await (0, api_1.showToast)({ style: api_1.Toast.Style.Success, title: "Update completed successfully!" });
    }
    catch (error) {
        await (0, api_1.showToast)({ style: api_1.Toast.Style.Failure, title: "Update failed", message: error instanceof Error ? error.message : "Unknown error" });
    }
}
function compareVersions(current, latest) {
    if (!current || !latest)
        return "unknown";
    return current.trim() === latest.trim() ? "up-to-date" : "outdated";
}
async function getInstalledVersion() {
    try {
        const { stdout } = await execAsync("claude -v");
        const output = stdout.trim();
        const match = output.match(/\d+\.\d+\.\d+(?:[.-][a-zA-Z0-9]+)?/);
        return match ? match[0] : output;
    }
    catch (error) {
        console.error("Error getting installed Claude version:", error);
        return "";
    }
}
function Command() {
    const [installedVersion, setInstalledVersion] = (0, react_1.useState)("");
    const [latestVersion, setLatestVersion] = (0, react_1.useState)("");
    const [status, setStatus] = (0, react_1.useState)("unknown");
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    (0, react_1.useEffect)(() => {
        let isCancelled = false;
        (async () => {
            setIsLoading(true);
            const installed = await getInstalledVersion();
            if (isCancelled)
                return;
            setInstalledVersion(installed || "Not detected");
            const latest = await checkForUpdates();
            if (isCancelled)
                return;
            setLatestVersion(latest);
            setStatus(compareVersions(installed, latest));
            setIsLoading(false);
        })();
        return () => {
            isCancelled = true;
        };
    }, []);
    const accessoriesText = status === "up-to-date"
        ? "Latest"
        : status === "outdated"
            ? (latestVersion ? `Update Available: ${latestVersion}` : "Update Available")
            : "Unknown";
    const statusIcon = status === "up-to-date" ? api_1.Icon.Check : status === "outdated" ? api_1.Icon.ArrowClockwise : api_1.Icon.QuestionMark;
    return ((0, jsx_runtime_1.jsx)(api_1.List, { isLoading: isLoading, searchBarPlaceholder: "Claude Code", children: (0, jsx_runtime_1.jsx)(api_1.List.Item, { icon: api_1.Icon.Code, title: "Claude Code Version", subtitle: installedVersion || "", accessories: [{ icon: statusIcon, text: accessoriesText }], actions: (0, jsx_runtime_1.jsxs)(api_1.ActionPanel, { children: [(0, jsx_runtime_1.jsx)(api_1.Action.CopyToClipboard, { content: installedVersion || "", title: "Copy Version" }), status === "outdated" && ((0, jsx_runtime_1.jsx)(api_1.Action, { title: "Install Update", icon: api_1.Icon.Download, onAction: async () => {
                            await installUpdate();
                            const newInstalled = await getInstalledVersion();
                            setInstalledVersion(newInstalled || "Not detected");
                            const newStatus = compareVersions(newInstalled, latestVersion);
                            setStatus(newStatus);
                        } })), (0, jsx_runtime_1.jsx)(api_1.Action, { title: "Check for Updates", icon: api_1.Icon.Globe, onAction: async () => {
                            await (0, api_1.showToast)({ style: api_1.Toast.Style.Animated, title: "Checking for updates..." });
                            const latest = await checkForUpdates();
                            setLatestVersion(latest);
                            const newStatus = compareVersions(installedVersion, latest);
                            setStatus(newStatus);
                            await (0, api_1.showToast)({
                                style: newStatus === "up-to-date" ? api_1.Toast.Style.Success : api_1.Toast.Style.Failure,
                                title: newStatus === "up-to-date" ? "You're on the latest version" : (latest ? `Update available: ${latest}` : "Update info unavailable"),
                            });
                        } }), (0, jsx_runtime_1.jsx)(api_1.Action, { title: "Refresh Installed Version", icon: api_1.Icon.Repeat, onAction: async () => {
                            await (0, api_1.showToast)({ style: api_1.Toast.Style.Animated, title: "Detecting installed version..." });
                            const installed = await getInstalledVersion();
                            setInstalledVersion(installed || "Not detected");
                            setStatus(compareVersions(installed, latestVersion));
                            await (0, api_1.showToast)({ style: api_1.Toast.Style.Success, title: installed ? `Installed: ${installed}` : "Claude not detected" });
                        } })] }) }, "claude-version") }));
}
