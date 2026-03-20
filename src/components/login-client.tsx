"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { brand } from "@/config/brand";

import styles from "./login-page.module.css";

export function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className={styles.wrap}>
      <section className={`panel ${styles.card}`}>
        <div className={styles.stack}>
          <div>
            <h1 className="section-title" style={{ fontSize: 24 }}>
              登录 {brand.name}
            </h1>
            <p className="section-copy">
              首个登录账号会自动成为管理员，你可以随后创建项目、配置 Gemini，并开始搭建打点方案。
            </p>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>邮箱</label>
            <input className={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>密码</label>
            <input className={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 6 位" />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>姓名（首次登录可选）</label>
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：Felix" />
          </div>

          {error ? <div className={`${styles.message} ${styles.error}`}>{error}</div> : null}

          <button
            className="button-primary"
            disabled={isPending || !email || !password}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const response = await fetch("/api/auth/login", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email, password, name })
                });
                const data = await response.json();
                if (!response.ok) {
                  setError(data.error || "登录失败。");
                  return;
                }
                router.replace("/");
                router.refresh();
              })
            }
          >
            登录并进入工作台
          </button>

          <p className={styles.helper}>
            如果当前数据库里还没有账号，首次登录会自动创建管理员用户。未配置 Neon 时会回退到本地内存模式。
          </p>
        </div>
      </section>
    </div>
  );
}
