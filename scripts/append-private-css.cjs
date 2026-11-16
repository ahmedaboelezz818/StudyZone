
/* ============================================================
 * Private one-to-one messages (teamless)
 * ============================================================ */
.live-section-label-flex {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.live-icon-button-xs {
  width: 22px;
  height: 22px;
  font-size: 13px;
  color: var(--muted);
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  background: transparent;
  cursor: pointer;
  display: inline-grid;
  place-items: center;
  line-height: 1;
  transition: background var(--motion-duration-fast) ease, color var(--motion-duration-fast) ease;
}
.live-icon-button-xs:hover {
  background: rgba(var(--accent-rgb), 0.12);
  color: var(--accent);
}
.live-conv-empty-hint {
  margin: 2px 10px 6px;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.6;
}
