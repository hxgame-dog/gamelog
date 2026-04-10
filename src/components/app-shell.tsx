import Link from "next/link";
import { ReactNode } from "react";

import { brand } from "@/config/brand";
import { getCurrentUser } from "@/lib/server/auth";

import { AuthMenuClient } from "./auth-menu-client";
import styles from "./app-shell.module.css";

type NavIconName = "overview" | "projects" | "plans" | "imports" | "analytics" | "reports" | "settings";

const navItems: Array<{ href: string; label: string; hint: string; icon: NavIconName }> = [
  { href: "/", label: "项目总览", hint: "Overview", icon: "overview" },
  { href: "/projects", label: "项目管理", hint: "Projects", icon: "projects" },
  { href: "/plans", label: "方案设计", hint: "Planning", icon: "plans" },
  { href: "/imports", label: "数据导入", hint: "Import", icon: "imports" },
  { href: "/analytics/onboarding", label: "运营分析", hint: "Analytics", icon: "analytics" },
  { href: "/reports", label: "AI 报告", hint: "Reports", icon: "reports" },
  { href: "/settings/ai", label: "AI 设置", hint: "Settings", icon: "settings" }
];

function NavIcon({ name }: { name: NavIconName }) {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  switch (name) {
    case "overview":
      return (
        <svg {...commonProps}>
          <path d="M4 12.5 12 4l8 8.5" />
          <path d="M6.5 10.5V20h11v-9.5" />
        </svg>
      );
    case "projects":
      return (
        <svg {...commonProps}>
          <rect x="4" y="5" width="16" height="14" rx="3" />
          <path d="M8 9h8M8 13h5" />
        </svg>
      );
    case "plans":
      return (
        <svg {...commonProps}>
          <path d="M7 4.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V6A1.5 1.5 0 0 1 7.5 4.5Z" />
          <path d="M13.5 4.5V9h4.5M9 12h6M9 15.5h6" />
        </svg>
      );
    case "imports":
      return (
        <svg {...commonProps}>
          <path d="M12 4v10" />
          <path d="m8.5 10.5 3.5 3.5 3.5-3.5" />
          <rect x="4.5" y="16" width="15" height="4" rx="2" />
        </svg>
      );
    case "analytics":
      return (
        <svg {...commonProps}>
          <path d="M5 19.5V10.5M12 19.5V5.5M19 19.5v-7" />
          <path d="M3.5 19.5h17" />
        </svg>
      );
    case "reports":
      return (
        <svg {...commonProps}>
          <path d="M6.5 5h8l3 3v10.5A1.5 1.5 0 0 1 16 20H6.5A1.5 1.5 0 0 1 5 18.5v-12A1.5 1.5 0 0 1 6.5 5Z" />
          <path d="M9 11h6M9 14.5h4" />
        </svg>
      );
    case "settings":
      return (
        <svg {...commonProps}>
          <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5Z" />
          <path d="M18.5 12a1.7 1.7 0 0 0 .04.39l1.46 1.13-1.5 2.6-1.76-.43a6.54 6.54 0 0 1-.68.39l-.26 1.78h-3l-.26-1.78a6.54 6.54 0 0 1-.68-.39l-1.76.43-1.5-2.6 1.46-1.13A1.7 1.7 0 0 0 5.5 12c0-.13.01-.26.04-.39L4.08 10.48l1.5-2.6 1.76.43c.21-.15.43-.28.68-.39l.26-1.78h3l.26 1.78c.25.11.47.24.68.39l1.76-.43 1.5 2.6-1.46 1.13c.03.13.04.26.04.39Z" />
        </svg>
      );
  }
}

export async function AppShell({
  children,
  currentPath
}: {
  children: ReactNode;
  currentPath: string;
}) {
  const user = await getCurrentUser();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className={styles.brand}>
          <div className={styles.brandHeader}>
            <div className={styles.logo}>{brand.shortName}</div>
            <h1 className="section-title" style={{ fontSize: 22 }}>
              {brand.name}
            </h1>
          </div>
          <p className={styles.subtitle}>{brand.description}</p>
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? currentPath === item.href
                : currentPath.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${active ? styles.active : ""}`}
              >
                <span className={styles.navIconWrap}>
                  <NavIcon name={item.icon} />
                </span>
                <span className={styles.navText}>
                  <span className={styles.navLabel}>{item.label}</span>
                  <span className={styles.navHint}>{item.hint}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        <AuthMenuClient user={user ? { name: user.name, email: user.email } : null} />
      </aside>

      <main className="content-shell">
        <div className="content fade-in">{children}</div>
      </main>
    </div>
  );
}
