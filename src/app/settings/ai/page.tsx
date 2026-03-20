import { AppShell } from "@/components/app-shell";
import { AiSettingsClient } from "@/components/ai-settings-client";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/server/auth";
import { getAiConfig } from "@/lib/server/ai-config";

export default async function AiSettingsPage() {
  await requireAdmin();
  const config = await getAiConfig();

  return (
    <AppShell currentPath="/settings/ai">
      <PageHeader
        title="AI 设置"
        copy="管理平台统一使用的 Gemini 凭据、默认模型和模型检测结果。完成这里的配置后，打点生成、方案诊断和 AI 报告都可以走真实调用链路。"
      />
      <AiSettingsClient initialConfig={config} />
    </AppShell>
  );
}
