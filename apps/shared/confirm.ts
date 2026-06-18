// 共享确认弹窗 —— Promise 化的对话框，替代浏览器原生 confirm()
// 使用方式：
//   if (!await confirmDialog({ message: "..." , danger: true })) return;
//   // 用户已点击确定
//
// 行为：
//   - 在 document.body 挂一个 .confirm-backdrop，z-index 高于 toast/drawer
//   - 点 backdrop / 取消按钮 / Esc → resolve(false)
//   - 点确定按钮 / Enter → resolve(true)
//   - 弹窗存在期间，确定按钮 disabled；防止双击
//   - resolve 后立即清理 DOM

export interface ConfirmOptions {
  title?: string; // 默认 "请确认"
  message: string; // 必填
  okText?: string; // 默认 "确定"
  cancelText?: string; // 默认 "取消"
  danger?: boolean; // true 时确定按钮用 .danger 红色样式（删除场景必传）
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  const title = options.title ?? "请确认";
  const okText = options.okText ?? "确定";
  const cancelText = options.cancelText ?? "取消";
  const danger = options.danger === true;

  return new Promise<boolean>((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "confirm-backdrop";
    backdrop.setAttribute("role", "presentation");
    backdrop.innerHTML = `
      <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirmTitle" aria-describedby="confirmMsg">
        <h3 class="confirm-title" id="confirmTitle">${escapeHtml(title)}</h3>
        <p class="confirm-text" id="confirmMsg">${escapeHtml(options.message)}</p>
        <div class="confirm-actions">
          <button class="secondary" type="button" data-confirm-cancel>${escapeHtml(cancelText)}</button>
          <button class="${danger ? "danger" : ""}" type="button" data-confirm-ok>${escapeHtml(okText)}</button>
        </div>
      </div>`;

    document.body.appendChild(backdrop);

    const cancelBtn = backdrop.querySelector<HTMLButtonElement>("[data-confirm-cancel]")!;
    const okBtn = backdrop.querySelector<HTMLButtonElement>("[data-confirm-ok]")!;
    // 让取消按钮拿到初始焦点，避免误回车
    cancelBtn.focus();

    let settled = false;
    const cleanup = (result: boolean) => {
      if (settled) return;
      settled = true;
      document.removeEventListener("keydown", onKey, true);
      backdrop.remove();
      resolve(result);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cleanup(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        cleanup(true);
      }
    };
    document.addEventListener("keydown", onKey, true);

    // 拦截背景点击，遮罩外层才视为取消
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) cleanup(false);
    });
    cancelBtn.addEventListener("click", () => cleanup(false));
    okBtn.addEventListener("click", () => cleanup(true));
  });
}
