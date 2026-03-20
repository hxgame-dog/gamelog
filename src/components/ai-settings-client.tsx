"use client";

import { useState, useTransition } from "react";

import styles from "./settings-page.module.css";

export type AiConfigResponse = {
  provider: "GEMINI";
  storageMode: "database" | "memory";
  status: string;
  keyConfigured: boolean;
  maskedApiKey: string | null;
  defaultModel: string | null;
  lastVerifiedAt: string | null;
  updatedAt: string | null;
  availableModels: Array<{
    modelName: string;
    displayName?: string | null;
    isAvailable: boolean;
    isDefault: boolean;
    supportedActions: string[];
    detectedAt: string;
  }>;
};

const emptyState: AiConfigResponse = {
  provider: "GEMINI",
  storageMode: "memory",
  status: "NOT_CONFIGURED",
  keyConfigured: false,
  maskedApiKey: null,
  defaultModel: null,
  lastVerifiedAt: null,
  updatedAt: null,
  availableModels: []
};

export function AiSettingsClient({ initialConfig = emptyState }: { initialConfig?: AiConfigResponse }) {
  const [config, setConfig] = useState<AiConfigResponse>(initialConfig);
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState(initialConfig.defaultModel ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSave() {
    startTransition(async () => {
      setMessage(null);
      setError(null);

      const response = await fetch("/api/ai/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          apiKey,
          defaultModel: defaultModel || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "保存失败。");
        return;
      }

      setConfig(data);
      setApiKey("");
      setDefaultModel(data.defaultModel ?? "");
      setMessage("Gemini 配置已保存。");
    });
  }

  async function handleDetectModels() {
    startTransition(async () => {
      setMessage(null);
      setError(null);

      const response = await fetch("/api/ai/config/detect-models", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          apiKey: apiKey || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "模型检测失败。");
        return;
      }

      setConfig(data);
      setDefaultModel(data.defaultModel ?? "");
      setMessage(`已检测到 ${data.availableModels.length} 个可用 Gemini 模型。`);
    });
  }

  async function handleDelete() {
    startTransition(async () => {
      setMessage(null);
      setError(null);

      const response = await fetch("/api/ai/config", {
        method: "DELETE"
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "删除失败。");
        return;
      }

      setConfig(data);
      setApiKey("");
      setDefaultModel("");
      setMessage("已删除已保存的 Gemini Key 和模型记录。");
    });
  }

  return (
    <div className={styles.layout}>
      <section className={`panel ${styles.card}`}>
        <div className={styles.stack}>
          <div>
            <h2 className="section-title" style={{ fontSize: 16 }}>
              Gemini 配置
            </h2>
            <p className="section-copy">
              保存平台统一使用的 Gemini API Key，并检测当前可用模型。检测结果会保存为默认调用候选。
            </p>
          </div>

          <div className={`${styles.banner} ${config.storageMode === "memory" ? styles.bannerWarn : ""}`}>
            {config.storageMode === "memory"
              ? "当前是本地内存模式：Key 只保存在当前进程内存里，不会写入数据库，重启服务后会丢失。适合预览，不适合正式使用。"
              : "当前是数据库模式：Key 会以加密后的形式保存到 Neon，通过服务端调用 Gemini，不会下发到前端。"}
          </div>

          <div className={styles.row}>
            <label className={styles.label}>Gemini API Key</label>
            <input
              className={styles.input}
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={config.maskedApiKey ?? "粘贴你的 Gemini API Key"}
            />
            <p className={styles.helper}>
              当前保存状态：{config.keyConfigured ? `已配置 (${config.maskedApiKey})` : "未配置"}
            </p>
          </div>

          <div className={styles.row}>
            <label className={styles.label}>默认模型</label>
            <select
              className={styles.select}
              value={defaultModel}
              onChange={(event) => setDefaultModel(event.target.value)}
            >
              <option value="">自动选择推荐模型</option>
              {config.availableModels.map((model) => (
                <option key={model.modelName} value={model.modelName}>
                  {model.displayName || model.modelName}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.actions}>
            <button className="button-primary" onClick={handleSave} disabled={isPending || !apiKey}>
              保存配置
            </button>
            <button className="button-secondary" onClick={handleDetectModels} disabled={isPending}>
              检测可用模型
            </button>
            <button
              className="button-secondary"
              onClick={handleDelete}
              disabled={isPending || !config.keyConfigured}
            >
              删除已保存 Key
            </button>
          </div>

          {message ? <div className={styles.message}>{message}</div> : null}
          {error ? <div className={`${styles.message} ${styles.error}`}>{error}</div> : null}
        </div>
      </section>

      <section className={styles.stack}>
        <div className={`panel ${styles.card}`}>
          <h2 className="section-title" style={{ fontSize: 16 }}>
            当前状态
          </h2>
          <div className={styles.statusGrid} style={{ marginTop: 12 }}>
            <div className={styles.statusCard}>
              <div className={styles.statusLabel}>存储模式</div>
              <div className={styles.statusValue}>{config.storageMode === "database" ? "Neon / Prisma" : "本地内存回退"}</div>
            </div>
            <div className={styles.statusCard}>
              <div className={styles.statusLabel}>配置状态</div>
              <div className={styles.statusValue}>{config.status}</div>
            </div>
            <div className={styles.statusCard}>
              <div className={styles.statusLabel}>默认模型</div>
              <div className={styles.statusValue}>{config.defaultModel ?? "未设置"}</div>
            </div>
            <div className={styles.statusCard}>
              <div className={styles.statusLabel}>上次验证</div>
              <div className={styles.statusValue}>
                {config.lastVerifiedAt ? new Date(config.lastVerifiedAt).toLocaleString() : "尚未验证"}
              </div>
            </div>
          </div>
        </div>

        <div className={`panel ${styles.card}`}>
          <h2 className="section-title" style={{ fontSize: 16 }}>
            可用模型
          </h2>
          <div className={styles.modelList} style={{ marginTop: 12 }}>
            {config.availableModels.length ? (
              config.availableModels.map((model) => (
                <div key={model.modelName} className={styles.modelCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong>{model.displayName || model.modelName}</strong>
                    {model.isDefault ? <span className="pill">默认</span> : null}
                  </div>
                  <p className={styles.helper} style={{ marginTop: 8 }}>
                    模型 ID：{model.modelName}
                  </p>
                  <p className={styles.helper}>能力：{model.supportedActions.join(", ") || "generateContent"}</p>
                </div>
              ))
            ) : (
              <p className={styles.helper}>还没有检测到可用模型。保存 API Key 后点击“检测可用模型”。</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
