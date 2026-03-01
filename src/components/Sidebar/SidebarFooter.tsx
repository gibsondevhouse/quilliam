"use client";

/** Anchored footer with avatar, username, plan badge, and model selector stub. */
export function SidebarFooter() {
  return (
    <div className="oc-sidebar-footer">
      {/* Avatar (initials placeholder) */}
      <div className="oc-sidebar-avatar" aria-hidden>
        Q
      </div>

      {/* User info */}
      <div className="oc-sidebar-user-info">
        <span className="oc-sidebar-username">Local User</span>
        <span className="oc-sidebar-plan-badge">Local</span>
      </div>

      {/* Footer icon actions */}
      <div className="oc-sidebar-footer-actions">
        <button
          className="oc-sidebar-icon-btn"
          title="Settings"
          aria-label="Open settings"
          style={{ fontSize: 13 }}
        >
          ⚙
        </button>
      </div>
    </div>
  );
}
