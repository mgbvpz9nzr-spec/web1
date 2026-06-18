export type ApiOptions = RequestInit & { bodyJson?: unknown };

const RAW_BASE = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
export const API_BASE_URL = RAW_BASE && RAW_BASE.length > 0 ? RAW_BASE.replace(/\/$/, "") : "";

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { bodyJson, headers, ...rest } = options;
  const body = bodyJson === undefined ? rest.body : JSON.stringify(bodyJson);
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...rest,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(headers ?? {})
    },
    body
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error("登录已失效，请重新登录");
  if (!res.ok) throw new Error(data.error ?? `请求失败（${res.status}）`);
  return data as T;
}

export type UploadResult = { url: string; name: string; size: number; type: string };

export async function uploadFile(file: File | Blob, filename?: string): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file, filename);
  const res = await fetch(`${API_BASE_URL}/api/uploads`, {
    method: "POST",
    credentials: "include",
    body: form
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `上传失败（${res.status}）`);
  return data as UploadResult;
}

export async function requestCode(phone: string) {
  return api<{ ok: boolean; devCode?: string; message?: string }>("/api/auth/request-code", {
    method: "POST",
    bodyJson: { phone }
  });
}

export async function loginWithOtp(phone: string, code: string) {
  return api<{ user: { role: string; name: string }; redirectTo: string }>("/api/auth/login", {
    method: "POST",
    bodyJson: { phone, code, method: "otp" }
  });
}

export async function loginWithPassword(phone: string, password: string) {
  return api<{ user: { role: string; name: string }; redirectTo: string }>("/api/auth/login", {
    method: "POST",
    bodyJson: { phone, password, method: "password" }
  });
}

export async function logout() {
  return api<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}

export async function registerClinic() {
  return api<{ ok: boolean }>("/api/clinics/lookup", { method: "GET" });
}

export type ClinicLookup = {
  clinics: Array<{ id: string; name: string; province: string; city: string; district: string; address: string; phone: string }>;
};

export async function lookupClinics(params: { city?: string; q?: string }) {
  const sp = new URLSearchParams();
  if (params.city) sp.set("city", params.city);
  if (params.q) sp.set("q", params.q);
  return api<ClinicLookup>(`/api/clinics/lookup?${sp}`);
}

export async function registerPatient(input: {
  phone: string;
  code: string;
  name: string;
  clinicId: string;
  age?: number;
  password?: string;
}) {
  return api<{ user: any; patient: any; inviteCode: string; redirectTo: string }>("/api/patient/register", {
    method: "POST",
    bodyJson: input
  });
}

export function money(value: unknown) {
  return `¥${Number(value ?? 0).toLocaleString()}`;
}

// ===== AI 一键生成（门店端） =====

export type ArticleCopy = {
  title?: string;
  category?: string;
  summary?: string;
  content: string;
};

export type MarketingPostCopy = {
  title?: string;
  subtitle?: string;
  introText: string;
  bodyText?: string;
  benefits?: string;
  activityInfo?: string;
  notes?: string;
};

export async function generateArticleCopy(input: {
  prompt: string;
  title?: string;
  category?: string;
  summary?: string;
}) {
  return api<{ copy: ArticleCopy }>("/api/clinic/ai/generate-article", {
    method: "POST",
    bodyJson: input
  });
}

export async function generateMarketingPostCopy(input: {
  prompt: string;
  type: "ANNOUNCEMENT" | "PROMOTION" | "ACTIVITY";
}) {
  return api<{ copy: MarketingPostCopy }>("/api/clinic/ai/generate-marketing-post", {
    method: "POST",
    bodyJson: input
  });
}

// ===== 点击防抖 / 加载态 =====
// 防止按钮在异步请求未完成时被重复点击，避免重复提交 / 多次触发副作用
// - 立即把按钮设为 disabled，重复点击直接被浏览器忽略
// - 同时检查 disabled 作为兜底，防止"短时间内 setTimeout 还原后又来一次"等竞态
// - 对 <button> 自动替换文字为"处理中…"，完成后还原
const LOADING_TEXT = "处理中…";

export type LoadableElement = HTMLButtonElement | HTMLInputElement | HTMLAnchorElement;

function isLoadable(el: Element | null | undefined): el is LoadableElement {
  if (!el) return false;
  return el.tagName === "BUTTON" || el.tagName === "INPUT" || el.tagName === "A";
}

function readLabel(el: LoadableElement): string | null {
  if (el.tagName === "INPUT") {
    const type = (el as HTMLInputElement).type;
    if (type === "submit" || type === "button") return (el as HTMLInputElement).value;
    return null;
  }
  return (el as HTMLElement).textContent;
}

function writeLabel(el: LoadableElement, text: string | null) {
  if (text === null) return;
  if (el.tagName === "INPUT") {
    (el as HTMLInputElement).value = text;
  } else {
    (el as HTMLElement).textContent = text;
  }
}

/**
 * 在 fn 执行期间禁用 trigger；返回的 Promise 与 fn 同时 resolve/reject。
 * - trigger 已经被禁用（说明上一次还在飞）则直接忽略本次调用
 * - 完成后无论成功失败都会恢复原状
 */
export async function withLoading<T extends Element>(
  trigger: T | null | undefined,
  fn: () => Promise<unknown>
): Promise<void> {
  if (trigger && (trigger as any).disabled) return;
  const el = isLoadable(trigger) ? trigger : null;
  const originalLabel = el ? readLabel(el) : null;
  if (trigger) (trigger as any).disabled = true;
  if (el) writeLabel(el, LOADING_TEXT);
  try {
    await fn();
  } finally {
    if (trigger) (trigger as any).disabled = false;
    // 只在 handler 没主动改写 label 时还原成 originalLabel。
    // 避免「转草稿 → 发布」被 finally 退回到「转草稿」。
    if (el && readLabel(el) === LOADING_TEXT) writeLabel(el, originalLabel);
  }
}

/**
 * 包装表单 submit：自动找到 submit 按钮并加加载态；找不到则裸跑 fn。
 * 调用方应先 event.preventDefault()。
 */
export async function withFormLoading(
  form: HTMLFormElement,
  fn: () => Promise<unknown>
): Promise<void> {
  const submit = form.querySelector<HTMLButtonElement | HTMLInputElement>(
    'button[type="submit"], input[type="submit"]'
  );
  if (submit) {
    await withLoading(submit, fn);
  } else {
    await fn();
  }
}
