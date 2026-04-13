"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import styles from "./projects-page.module.css";

type Project = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  platform?: string | null;
  currentVersion?: string | null;
};

export function ProjectsClient({ initialProjects }: { initialProjects: Project[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("");
  const [version, setVersion] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  return (
    <div className={styles.layout}>
      <section className={`panel ${styles.card}`}>
        <div className={styles.stack}>
          <div>
            <h2 className="section-title" style={{ fontSize: 16 }}>
              创建项目
            </h2>
            <p className="section-copy">新项目会自动初始化默认事件分类和一份基础打点方案，方便你直接开始编辑。</p>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>项目名称</label>
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：Screwdom 3D" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>平台</label>
            <input className={styles.input} value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="iOS / Android" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>当前版本</label>
            <input className={styles.input} value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.8" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>项目描述</label>
            <textarea className={styles.textarea} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="一句话描述这款游戏的核心玩法和当前分析目标。" />
          </div>

          {error ? <div style={{ color: "var(--red)", fontSize: 12 }}>{error}</div> : null}

          <button
            className="button-primary"
            disabled={isPending || !name}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const response = await fetch("/api/projects", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name,
                    platform,
                    currentVersion: version,
                    description
                  })
                });
                const data = await response.json();
                if (!response.ok) {
                  setError(data.error || "创建项目失败。");
                  return;
                }
                setProjects((current) => [data.item, ...current]);
                setName("");
                setPlatform("");
                setVersion("");
                setDescription("");
                router.refresh();
              })
            }
          >
            创建项目
          </button>
        </div>
      </section>

      <section className={`panel ${styles.card}`}>
        <div className={styles.stack}>
          <div>
            <h2 className="section-title" style={{ fontSize: 16 }}>
              我的项目
            </h2>
            <p className="section-copy">项目创建后可以直接进入方案设计和分析页面，后续再补成员协作与权限细分。</p>
          </div>

          <div className={styles.projectList}>
            {projects.length ? (
              projects.map((project) => (
                <div key={project.id} className={styles.projectCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <strong>{project.name}</strong>
                    <span className="pill">{project.currentVersion || "未设置版本"}</span>
                  </div>
                  <p className={styles.meta} style={{ marginTop: 8 }}>
                    {project.description || "暂未填写项目描述。"}
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <a className="button-secondary" href={`/plans?projectId=${project.id}`}>
                      查看方案
                    </a>
                    <a className="button-secondary" href={`/analytics?projectId=${project.id}`}>
                      运营分析
                    </a>
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={isPending && deletingId === project.id}
                      onClick={() => {
                        const confirmed = window.confirm(`确认删除项目「${project.name}」吗？该项目下的方案与分析数据会一起删除。`);
                        if (!confirmed) {
                          return;
                        }
                        startTransition(async () => {
                          setDeletingId(project.id);
                          setError(null);
                          const response = await fetch(`/api/projects/${project.id}`, {
                            method: "DELETE"
                          });
                          const data = await response.json().catch(() => ({}));
                          if (!response.ok) {
                            setError(data.error || "删除项目失败。");
                            setDeletingId(null);
                            return;
                          }
                          setProjects((current) => current.filter((item) => item.id !== project.id));
                          setDeletingId(null);
                          router.refresh();
                        });
                      }}
                    >
                      {isPending && deletingId === project.id ? "删除中..." : "删除项目"}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="section-copy">还没有项目。先在左侧创建第一个项目。</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
