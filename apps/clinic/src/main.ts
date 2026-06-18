import "../../shared/styles.css";
import "./clinic.css";
import { API_BASE_URL, api, generateArticleCopy, generateMarketingPostCopy, loginWithPassword, logout, money, uploadFile, withFormLoading, withLoading } from "../../shared/api";
import { confirmDialog } from "../../shared/confirm";

type Dashboard = {
  clinic?: any;
  role: string;
  currentUser?: { id: string; name: string; role: string; menuPermissions?: string[] };
  metrics: Record<string, number>;
  patients: any[];
  appointments: any[];
  enrollments: any[];
  followUps: any[];
  purchases: any[];
  operationTasks: any[];
  taskProgress: any[];
  drugKits: any[];
  campaigns: any[];
  campaignTemplates: any[];
  articles: any[];
  articleTemplates: any[];
  clinicArticles: any[];
  marketingPostTemplates: any[];
  clinicMarketingPosts: any[];
  marketingPushes: any[];
  taskTemplates: any[];
  treatments: any[];
  treatmentTemplates: any[];
  taskSummary?: { total: number; done: number; dueToday: number; overdue: number; byPriority: Record<string, number> };
  inviteStats?: { total: number; registered: number; attended: number; rewarded: number };
  sharePoster?: { id: string | null; title: string; hasImage: boolean; updatedAt: string | null };
};

const root = document.querySelector<HTMLDivElement>("#app")!;
type InviteItem = {
  id: string;
  inviteCode?: string | null;
  source?: "CODE" | "PHONE";
  status: string;
  createdAt: string;
  inviter: { name: string; phone: string } | null;
  inviterUser: { name: string; inviteCode: string | null } | null;
  invitee: { name: string; phone: string } | null;
};

type PosterTemplateData = {
  bgImageBase64?: string;
  logoBase64?: string;
  photoBase64?: string;
  productBase64?: string;
  title: string;
  subtitle?: string;
  contact?: string;
  slogan?: string;
  inviteCodeVisible?: boolean;
};

const EMPTY_POSTER_TEMPLATE: PosterTemplateData = {
  title: "邀请海报",
  subtitle: "扫码加入我们",
  contact: "",
  slogan: "",
  inviteCodeVisible: false
};

let state: {
  data?: Dashboard;
  active: string;
  workspaceTabs: Array<{ key: string; label: string; patientId?: string }>;
  sidebarScrollTop: number;
  workspaceScrollLeft: number;
  message?: string;
  error?: string;
  notifOpen: boolean;
  notifications: any[];
  unread: number;
  activeNotification?: any;
  invites: InviteItem[];
  posterImageBase64: string | null;
  posterMode: "template" | "simple";
  posterTemplate: PosterTemplateData | null;
  posterDraft: PosterTemplateData;
  toasts: { id: number; text: string; kind: "info" | "success" | "error" | "warn" }[];
  taskFilter: { status: "all" | "PENDING" | "DONE"; priority: "all" | "URGENT" | "HIGH" | "NORMAL" | "LOW" };
  taskNoteDraft: Record<string, string>;
  treatmentPatientId: string;
  treatmentDraftPatientId: string;
  cervicalPlans: any[];
  cervicalPlanDraft?: any;
  cervicalAgentLoading: boolean;
  knowledgeSearchResults?: any[];
  knowledgeSearchLoading?: boolean;
  knowledgeSearchContext?: any;
  knowledgeSearchAnswer?: any;
  knowledgeSearchView?: "input" | "overview" | "path" | "evidence";
  knowledgeSearchSelectedPatientId?: string;
  knowledgeSearchQueryText?: string;
  knowledgeSearchLocalAttachments?: Array<{ url: string; name: string; type: string; size: number }>;
  knowledgeSearchHistoryFiles?: Array<{ id: string; url: string; name: string; type: string; size: number; createdAt?: string; content?: string; authorName?: string; authorRole?: string }>;
  knowledgeSearchSelectedHistoryUrls?: string[];
  knowledgeSearchHistoryLoading?: boolean;
  medicalQaAnswer?: any;
  medicalQaLoading?: boolean;
  patientDetailCache: Record<string, {
    menstrual?: { records: any[]; state: any; assessment: any; config?: any | null; cycleProbability?: any | null; patient: { id: string; name: string } };
    symptoms?: { items: any[]; total: number; patient: { id: string; name: string } };
    notes?: { records: any[]; patient: { id: string; name: string } };
    aiChat?: { messages: Array<{ role: string; content: string; createdAt?: string }>; date: string | null; patient: { id: string; name: string } };
    plans?: any[];
    activeSubTab: "menstrual" | "symptom" | "records" | "aiChat" | "plans";
    expandedRecordId?: string | null;
    loading: boolean;
  }>;
} = {
  active: "desk",
  workspaceTabs: [{ key: "desk", label: "今日工作台" }],
  sidebarScrollTop: 0,
  workspaceScrollLeft: 0,
  notifOpen: false,
  notifications: [],
  unread: 0,
  invites: [],
  posterImageBase64: null,
  posterMode: "template",
  posterTemplate: null,
  posterDraft: { ...EMPTY_POSTER_TEMPLATE },
  toasts: [],
  taskFilter: { status: "all", priority: "all" },
  taskNoteDraft: {},
  treatmentPatientId: "",
  treatmentDraftPatientId: "",
  cervicalPlans: [],
  cervicalAgentLoading: false,
  knowledgeSearchResults: [],
  knowledgeSearchLoading: false,
  knowledgeSearchView: "input",
  knowledgeSearchSelectedPatientId: "",
  knowledgeSearchQueryText: "",
  knowledgeSearchLocalAttachments: [],
  knowledgeSearchHistoryFiles: [],
  knowledgeSearchSelectedHistoryUrls: [],
  knowledgeSearchHistoryLoading: false,
  medicalQaLoading: false,
  patientDetailCache: {}
};

let toastSeq = 0;
// 通知中心点外关闭：bindActions 每次 render 都会执行，用 flag 防止重复注册 document click
let notifOutsideClickBound = false;
function showToast(text: string, kind: "info" | "success" | "error" | "warn" = "info", ttlMs = 3000) {
  const id = ++toastSeq;
  state.toasts = [...state.toasts, { id, text, kind }];
  renderToastWrap(); // 只更新 toast，不触发整页重绘
  window.setTimeout(() => {
    state.toasts = state.toasts.filter((t) => t.id !== id);
    renderToastWrap();
  }, ttlMs);
}

function renderToastWrap() {
  let wrap = document.querySelector<HTMLDivElement>(".toast-wrap");
  if (state.toasts.length === 0) {
    if (wrap) wrap.remove();
    return;
  }
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  wrap.innerHTML = state.toasts
    .map((t) => `<div class="toast toast--${t.kind}">${html(t.text)}</div>`)
    .join("");
}

// ============================================================================
// 海报模板：canvas 渲染工具
// ============================================================================

const POSTER_W = 750;
const POSTER_H = 1333; // 9:16 适配手机

function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = src;
  });
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  if (!text) return y;
  const chars = Array.from(text);
  let line = "";
  let curY = y;
  for (const ch of chars) {
    const testLine = line + ch;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, curY);
      line = ch;
      curY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, curY);
  return curY;
}

async function drawPosterOnCanvas(canvas: HTMLCanvasElement, tpl: PosterTemplateData) {
  canvas.width = POSTER_W;
  canvas.height = POSTER_H;
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // 1) 背景：图 or 渐变
  if (tpl.bgImageBase64) {
    try {
      const img = await loadImageEl(tpl.bgImageBase64);
      const scale = Math.max(POSTER_W / img.naturalWidth, POSTER_H / img.naturalHeight);
      const x = (POSTER_W - img.naturalWidth * scale) / 2;
      const y = (POSTER_H - img.naturalHeight * scale) / 2;
      ctx.drawImage(img, x, y, img.naturalWidth * scale, img.naturalHeight * scale);
      // 蒙层，让文字更清晰
      const g = ctx.createLinearGradient(0, 0, 0, POSTER_H);
      g.addColorStop(0, "rgba(255,255,255,0.05)");
      g.addColorStop(0.5, "rgba(255,255,255,0.45)");
      g.addColorStop(1, "rgba(255,255,255,0.85)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, POSTER_W, POSTER_H);
    } catch {
      drawPosterGradient(ctx);
    }
  } else {
    drawPosterGradient(ctx);
  }

  // 2) Logo（右上角圆形）
  if (tpl.logoBase64) {
    try {
      const img = await loadImageEl(tpl.logoBase64);
      const sz = 110;
      const cx = POSTER_W - sz / 2 - 40;
      const cy = sz / 2 + 40;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, sz / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, cx - sz / 2, cy - sz / 2, sz, sz);
      ctx.restore();
      // 边框
      ctx.beginPath();
      ctx.arc(cx, cy, sz / 2, 0, Math.PI * 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.stroke();
    } catch {
      // ignore
    }
  }

  // 3) 主标题
  ctx.fillStyle = "#111827";
  ctx.font = "bold 72px 'PingFang SC','Microsoft YaHei',sans-serif";
  wrapCanvasText(ctx, tpl.title || "诊所邀请海报", POSTER_W / 2, 220, POSTER_W - 100, 84);

  // 4) 副标题
  if (tpl.subtitle) {
    ctx.fillStyle = "#6b7280";
    ctx.font = "32px 'PingFang SC','Microsoft YaHei',sans-serif";
    wrapCanvasText(ctx, tpl.subtitle, POSTER_W / 2, 320, POSTER_W - 100, 44);
  }

  // 5) 照片（圆角卡片）
  if (tpl.photoBase64) {
    try {
      const img = await loadImageEl(tpl.photoBase64);
      const pW = 600, pH = 420;
      const x = (POSTER_W - pW) / 2;
      const y = 420;
      roundedRectPath(ctx, x, y, pW, pH, 20);
      ctx.clip();
      const scale = Math.min(pW / img.naturalWidth, pH / img.naturalHeight);
      const ix = x + (pW - img.naturalWidth * scale) / 2;
      const iy = y + (pH - img.naturalHeight * scale) / 2;
      ctx.drawImage(img, ix, iy, img.naturalWidth * scale, img.naturalHeight * scale);
      ctx.restore();
    } catch {
      // ignore
    }
  }

  // 6) 营销语
  let cursorY = 900;
  if (tpl.slogan) {
    ctx.fillStyle = "#be185d";
    ctx.font = "italic 30px 'PingFang SC','Microsoft YaHei',sans-serif";
    cursorY = wrapCanvasText(ctx, tpl.slogan, POSTER_W / 2, cursorY, POSTER_W - 120, 42);
    cursorY += 28;
  }

  // 7) 产品图（可选，放在营销语和联系方式之间）
  if (tpl.productBase64) {
    try {
      const img = await loadImageEl(tpl.productBase64);
      const pW = 480, pH = 200;
      const x = (POSTER_W - pW) / 2;
      const y = cursorY;
      roundedRectPath(ctx, x, y, pW, pH, 14);
      ctx.clip();
      const scale = Math.min(pW / img.naturalWidth, pH / img.naturalHeight);
      const ix = x + (pW - img.naturalWidth * scale) / 2;
      const iy = y + (pH - img.naturalHeight * scale) / 2;
      ctx.drawImage(img, ix, iy, img.naturalWidth * scale, img.naturalHeight * scale);
      ctx.restore();
      cursorY = y + pH + 24;
    } catch {
      // ignore
    }
  }

  // 8) 联系方式
  if (tpl.contact) {
    ctx.fillStyle = "#374151";
    ctx.font = "26px 'PingFang SC','Microsoft YaHei',sans-serif";
    wrapCanvasText(ctx, tpl.contact, POSTER_W / 2, cursorY, POSTER_W - 100, 38);
  }

  // 9) 底部装饰 + 邀请码可见标识
  if (tpl.inviteCodeVisible) {
    ctx.fillStyle = "rgba(190,24,93,0.92)";
    ctx.fillRect(0, POSTER_H - 90, POSTER_W, 90);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 32px 'PingFang SC','Microsoft YaHei',sans-serif";
    ctx.fillText("扫码邀请 · 一码通用", POSTER_W / 2, POSTER_H - 35);
  }
}

function drawPosterGradient(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, POSTER_H);
  g.addColorStop(0, "#fce7f3");
  g.addColorStop(0.5, "#fff7ed");
  g.addColorStop(1, "#fef3c7");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);
}

async function redrawPosterPreview() {
  const canvas = document.querySelector<HTMLCanvasElement>("#posterCanvas");
  if (!canvas) return;
  try {
    await drawPosterOnCanvas(canvas, state.posterDraft);
  } catch (err) {
    console.warn("poster redraw failed", err);
  }
}

function renderPosterImageField(fileId: string, key: keyof PosterTemplateData, tpl: PosterTemplateData, label: string) {
  const hasImage = !!tpl[key];
  return `<label>${label}
    <div class="poster-file-row">
      <input class="field" type="file" id="${fileId}" accept="image/png,image/jpeg" />
      <button type="button" class="secondary poster-clear-btn" id="clear-${fileId}" data-fileid="${fileId}" data-key="${String(key)}">✕</button>
    </div>
    <span class="poster-file-hint" id="hint-${fileId}" style="${hasImage ? "" : "display:none"}">已上传图片</span>
  </label>`;
}

/**
 * 文章 / 营销稿的图片字段：本地选文件后上传到服务端，隐藏 input 仅保存持久化 URL。
 *
 * - fileId:  <input type="file"> 的 id
 * - hiddenName: <input type="hidden"> 的 name（与表单字段名保持一致：imageUrl / coverImageUrl ...）
 * - currentValue: 编辑现有草稿时，data.imageUrl 之类的初始值（可能是 data URL 或外链）
 */
function renderImageField(fileId: string, hiddenName: string, label: string, required: boolean, currentValue?: string) {
  const hasValue = !!currentValue;
  return `<label>${label}${required ? "" : "（可选）"}
    <input class="field" type="file" id="${fileId}" data-image-input data-hidden-name="${hiddenName}" accept="image/png,image/jpeg" ${required ? "required" : ""} />
    <input type="hidden" name="${hiddenName}" value="${html(currentValue ?? "")}" />
    <div class="uploaded-image-preview" id="preview-${fileId}" style="${hasValue ? "" : "display:none"}">${hasValue ? `<img src="${html(currentValue!)}" alt="${html(label)}预览" />` : ""}<span class="poster-file-hint" id="hint-${fileId}">${hasValue ? "已保存图片" : ""}</span></div>
    <small class="muted" style="display:block;margin-top:4px;line-height:1.5">建议使用 16:9 横版长条形图片（如 1080×608、1920×1080），其他比例会被裁切，显示不完全。</small>
  </label>`;
}

function renderSimplePosterUpload(data: Dashboard) {
  const poster = data.sharePoster;
  const hasImage = poster?.hasImage || !!state.posterImageBase64;
  const update = poster?.updatedAt ? new Date(poster.updatedAt).toLocaleString() : "—";
  return `
    <p class="muted">直接上传一张完整海报图片（JPG/PNG，最大 5MB），一键替换，无需编辑。上传后在患者端「个人中心 · 邀请有礼」显示。</p>
    <div class="invite-poster-card">
      <div class="invite-poster-preview${hasImage ? "" : " invite-poster-preview--empty"}" id="simplePosterPreview">
        ${hasImage
          ? `<img id="simplePosterImg" src="${html(state.posterImageBase64 ?? "")}" alt="海报预览" />`
          : `<div>暂无海报<br><small>上传 JPG / PNG<br>最大 5 MB</small></div>`}
      </div>
      <div>
          <label style="margin-bottom:8px;display:block">选择图片<input class="field" type="file" id="simplePosterFile" accept="image/png,image/jpeg" style="margin-top:8px" /></label>
        <div class="grid grid-2" style="margin-top:12px">
          <button class="primary" id="simplePosterSaveBtn">${hasImage ? "替换海报" : "上传海报"}</button>
          <button class="secondary" id="simplePosterArchiveBtn" ${hasImage ? "" : "disabled"}>删除</button>
        </div>
        ${hasImage ? `<p class="muted" style="margin-top:8px">最近更新：${update}${poster?.id ? "（ID " + html(poster.id) + "）" : ""}</p>` : ""}
      </div>
    </div>`;
}

function renderPosterEditor(data: Dashboard) {
  const isManager = true; // 诊所端统一为医生，所有人权限一致
  const tpl = state.posterDraft;
  const hasTemplate = !!state.posterTemplate;
  const legacyOnly = !hasTemplate && !!state.posterImageBase64;
  return `
    <div class="invite-poster-card">
      <div class="invite-poster-preview">
        <canvas id="posterCanvas" width="${POSTER_W}" height="${POSTER_H}" style="width:100%;height:auto;display:block;background:#fff"></canvas>
      </div>
      <div>
        ${legacyOnly ? `<div class="poster-legacy-banner">⚠️ 这是旧版纯图海报（无模板数据），无法在模板编辑器中编辑。请重新上传启用模板。</div>` : ""}
        <div class="form-grid">
          <label>主标题<input class="field" id="peTitle" placeholder="如：清愫美诊所" value="${html(tpl.title ?? "")}" maxlength="40" ${isManager ? "" : "disabled"} /></label>
          <label>副标题<input class="field" id="peSubtitle" placeholder="一句话卖点" value="${html(tpl.subtitle ?? "")}" maxlength="60" ${isManager ? "" : "disabled"} /></label>
          <label>营销语<input class="field" id="peSlogan" placeholder="如：邀请有礼，新客首单 8 折" value="${html(tpl.slogan ?? "")}" maxlength="80" ${isManager ? "" : "disabled"} /></label>
          <label>联系方式<input class="field" id="peContact" placeholder="地址 / 电话 / 营业时间" value="${html(tpl.contact ?? "")}" maxlength="120" ${isManager ? "" : "disabled"} /></label>
        </div>
        <div class="form-grid" style="margin-top:12px">
          ${renderPosterImageField("peBgFile", "bgImageBase64", tpl, "背景图（无则用渐变）")}
          ${renderPosterImageField("peLogoFile", "logoBase64", tpl, "诊所 Logo（右上角）")}
          ${renderPosterImageField("pePhotoFile", "photoBase64", tpl, "诊所 / 医生照片")}
          ${renderPosterImageField("peProductFile", "productBase64", tpl, "产品 / 服务图（可选）")}
        </div>
        <label class="poster-toggle" ${isManager ? "" : "style='opacity:0.5;pointer-events:none'"}>
          <input type="checkbox" id="peInviteCodeVisible" ${tpl.inviteCodeVisible ? "checked" : ""} ${isManager ? "" : "disabled"} />
          <span>在海报底部加「扫码邀请」横幅</span>
        </label>
        <div class="grid grid-2" style="margin-top:14px">
          <button class="primary" id="peSaveBtn" ${isManager ? "" : "disabled"}>保存海报</button>
          <button class="secondary" id="peArchiveBtn" ${isManager && (hasTemplate || state.posterImageBase64) ? "" : "disabled"}>删除海报</button>
        </div>
        <p class="muted" style="margin-top:8px">保存后患者在「个人中心 · 邀请有礼」看到的就是这张图。</p>
      </div>
    </div>`;
}

function html(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
}

// 轻量级 markdown → HTML 渲染器，专为医生端 LLM 输出设计。
// 思路：先按行扫描识别块级结构（标题、列表、引用、代码块、分隔线、段落），
// 再在块内做行内处理（粗体、斜体、行内代码、引用标注、链接）。
// 所有文本都先经 html() 转义，避免注入。
function renderMarkdown(value: unknown): string {
  const source = String(value ?? "").replace(/\r\n?/g, "\n");
  if (!source.trim()) return "";

  const lines = source.split("\n");
  const out: string[] = [];
  let i = 0;

  const inline = (text: string): string => {
    let t = text;
    // 行内代码：先处理，避免内部 markdown 字符被替换
    const codeStash: string[] = [];
    t = t.replace(/`([^`]+)`/g, (_, code: string) => {
      codeStash.push(code);
      return `\u0000${codeStash.length - 1}\u0000`;
    });
    // 粗体（**text** 或 __text__），必须在斜体前处理
    t = t.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
    // 斜体（*text* 或 _text_）
    t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
    t = t.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
    // [来源:N] 引用标注，渲染为带样式的角标
    t = t.replace(/\[来源:(\d+)\]/g, '<span class="md-citation">[来源:$1]</span>');
    // 链接 [text](url) —— 仅允许 http(s) 协议
    t = t.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    // 还原行内代码
    t = t.replace(/\u0000(\d+)\u0000/g, (_, idx: string) => `<code>${codeStash[Number(idx)]}</code>`);
    return t;
  };

  const flushParagraph = (buf: string[]) => {
    if (buf.length === 0) return;
    const joined = buf.join(" ").trim();
    if (joined) out.push(`<p>${inline(joined)}</p>`);
    buf.length = 0;
  };

  const paragraphBuf: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 空行：段落/列表分隔
    if (!trimmed) {
      flushParagraph(paragraphBuf);
      closeList();
      i += 1;
      continue;
    }

    // 围栏代码块 ```
    if (trimmed.startsWith("```")) {
      flushParagraph(paragraphBuf);
      closeList();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1; // 跳过结束的 ```
      out.push(`<pre><code>${html(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    // 标题 #/##/###/####
    const heading = /^(#{1,4})\s+(.+?)\s*#*\s*$/.exec(trimmed);
    if (heading) {
      flushParagraph(paragraphBuf);
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    // 水平线 --- *** ___
    if (/^([-*_])\s*\1\s*\1[\s\S]*$/.test(trimmed) && /[-*_]/.test(trimmed) && trimmed.length >= 3) {
      flushParagraph(paragraphBuf);
      closeList();
      out.push("<hr/>");
      i += 1;
      continue;
    }

    // 引用 > text
    if (trimmed.startsWith(">")) {
      flushParagraph(paragraphBuf);
      closeList();
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      out.push(`<blockquote>${inline(quoteLines.join(" "))}</blockquote>`);
      continue;
    }

    // 有序列表 1. text
    const orderedItem = /^\d+[.)]\s+(.+)$/.exec(trimmed);
    if (orderedItem) {
      flushParagraph(paragraphBuf);
      if (listType !== "ol") {
        closeList();
        out.push("<ol>");
        listType = "ol";
      }
      out.push(`<li>${inline(orderedItem[1])}</li>`);
      i += 1;
      continue;
    }

    // 无序列表 - text 或 * text
    const bulletItem = /^[-*+]\s+(.+)$/.exec(trimmed);
    if (bulletItem) {
      flushParagraph(paragraphBuf);
      if (listType !== "ul") {
        closeList();
        out.push("<ul>");
        listType = "ul";
      }
      out.push(`<li>${inline(bulletItem[1])}</li>`);
      i += 1;
      continue;
    }

    // 普通段落：累积直到空行或块级元素
    if (listType) closeList();
    paragraphBuf.push(trimmed);
    i += 1;
  }

  flushParagraph(paragraphBuf);
  closeList();
  return out.join("\n");
}

function status() {
  if (!state.message && !state.error) return "";
  return `<div class="status ${state.error ? "error" : ""}">${html(state.error ?? state.message)}</div>`;
}

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "待确认",
  CONFIRMED: "已确认",
  ARRIVED: "已到店",
  CANCELLED: "已取消"
};

const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  NEW: "新线索",
  CONTACTED: "已联系",
  ATTENDED: "已到店",
  CONVERTED: "已成交",
  CANCELLED: "已取消"
};

const FOLLOW_STATUS_LABELS: Record<string, string> = {
  PENDING: "待随访",
  DONE: "已随访"
};

const TASK_STATUS_LABELS: Record<string, string> = {
  PENDING: "进行中",
  DONE: "已完成"
};

const TASK_PRIORITY_LABELS: Record<string, string> = {
  LOW: "低",
  NORMAL: "普通",
  HIGH: "高",
  URGENT: "紧急"
};

const CHANNEL_LABELS: Record<string, string> = {
  PHONE: "电话",
  IN_APP: "站内信",
  SMS: "短信"
};

const REVISIT_STATUS_LABELS: Record<string, string> = {
  待复查: "待复查",
  已复查: "已复查",
  长期未到店: "长期未到店",
  疗程中: "疗程中"
};

function labelOf(map: Record<string, string>, value: unknown, fallback = "—") {
  const text = value == null ? "" : String(value);
  if (!text) return fallback;
  return map[text] ?? text;
}

async function load() {
  state.error = undefined;
  const [dashboard, templates, tasks, messages, treatmentData] = await Promise.all([
    api<Dashboard>("/api/clinic/dashboard"),
    api<{ templates: any[] }>("/api/clinic/task-templates").catch(() => ({ templates: [] })),
    api<{ summary?: any }>("/api/clinic/tasks").catch(() => ({ summary: undefined as any })),
    api<{ messages: any[]; unread: number }>("/api/clinic/messages?limit=30").catch(() => ({ messages: [], unread: 0 })),
    api<{ treatments: any[]; templates: any[] }>("/api/clinic/treatments").catch(() => ({ treatments: [], templates: [] }))
  ]);
  state.data = { ...dashboard, taskTemplates: templates.templates ?? [], taskSummary: tasks.summary, treatments: treatmentData.treatments, treatmentTemplates: treatmentData.templates };
  state.notifications = messages.messages ?? [];
  state.unread = messages.unread ?? 0;
  renderApp();
}

function renderLogin() {
  root.innerHTML = `
    <div class="login"><section class="panel">
      <div class="brand" style="margin-bottom:16px">
        <div class="brand-mark">清</div>
        <div class="brand-copy"><strong>门店端登录</strong><span>医生、前台、店长账号由总后台分配</span></div>
      </div>
      ${status()}
      <form id="loginForm" class="form">
        <div class="field"><label>手机号</label><input name="phone" autocomplete="username" placeholder="请输入手机号" /></div>
        <div class="field"><label>密码</label><input name="password" type="password" autocomplete="current-password" placeholder="请输入密码" /></div>
        <div class="actions"><button type="submit">登录</button></div>
      </form>
    </section></div>`;

  document.querySelector<HTMLFormElement>("#loginForm")!.onsubmit = (event) => {
    event.preventDefault();
    const formEl = event.currentTarget as HTMLFormElement;
    return withFormLoading(formEl, async () => {
      const form = new FormData(formEl);
      const phone = String(form.get("phone") || "").trim();
      const password = String(form.get("password") || "");
      if (!phone || !password) {
        state.error = "请输入手机号和密码";
        renderLogin();
        return;
      }
      try {
        await loginWithPassword(phone, password);
        // 保留 UI 状态字段，避免重置后 renderTasks 等依赖 state.taskFilter 的页面崩
        state = { ...state, message: "登录成功", error: undefined };
        await load();
      } catch (error: any) {
        state.error = error.message;
        renderLogin();
      }
    });
  };
}

function progressFor(taskId: string) {
  return state.data?.taskProgress.find((item) => item.taskId === taskId)?.status ?? "PENDING";
}

function progressLabel(taskId: string) {
  return labelOf(TASK_STATUS_LABELS, progressFor(taskId), "进行中");
}

function renderNotifPanel() {
  const items = state.notifications;
  return `
    <div class="notif-panel">
      <div class="notif-panel__head">
        <strong>通知中心</strong>
        <div>
          ${state.unread > 0 ? `<button id="notifReadAll" class="link">全部已读</button>` : ""}
          <button id="notifClose" class="link">关闭</button>
        </div>
      </div>
      <div class="notif-panel__list">
        ${items.length === 0 ? `<div class="muted" style="padding:24px;text-align:center">暂无通知</div>` : items.map((msg) => `
          <div class="notif-item ${msg.read ? "is-read" : "is-unread"}" data-notif="${html(msg.id)}">
            <div class="notif-item__title">${msg.read ? "" : '<span class="notif-item__dot" />'}${html(msg.title)}</div>
            <div class="notif-item__content">${html(msg.content || "")}</div>
            <div class="notif-item__time">${msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ""}</div>
          </div>
        `).join("")}
      </div>
    </div>`;
}

function renderNotificationDetail(message: any) {
  if (!message) return "";
  return `<div class="message-detail-backdrop" data-close-message-detail><section class="message-detail" onclick="event.stopPropagation()"><button type="button" data-close-message-detail>关闭</button><span>${message.read ? "已读通知" : "新通知"}</span><h2>${html(message.title)}</h2><time>${message.createdAt ? new Date(message.createdAt).toLocaleString() : ""}</time><p>${html(message.content)}</p></section></div>`;
}

function appointmentActions(item: any) {
  if (item.status === "PENDING") {
    return `<button data-appt="${html(item.id)}" data-status="CONFIRMED">确认</button><button class="danger" data-appt="${html(item.id)}" data-status="CANCELLED">取消</button>`;
  }
  if (item.status === "CONFIRMED") {
    return `<button data-appt="${html(item.id)}" data-status="ARRIVED">到店</button><button class="danger" data-appt="${html(item.id)}" data-status="CANCELLED">取消</button>`;
  }
  return `<span class="muted">已结束</span>`;
}

function enrollmentActions(item: any) {
  if (item.status === "NEW") return `<button data-enrollment="${html(item.id)}" data-enrollment-status="CONTACTED">已联系</button><button class="danger" data-enrollment="${html(item.id)}" data-enrollment-status="CANCELLED">取消</button>`;
  if (item.status === "CONTACTED") return `<button data-enrollment="${html(item.id)}" data-enrollment-status="ATTENDED">已到店</button><button class="danger" data-enrollment="${html(item.id)}" data-enrollment-status="CANCELLED">取消</button>`;
  if (item.status === "ATTENDED") return `<button data-enrollment="${html(item.id)}" data-enrollment-status="CONVERTED">已转化</button><button class="danger" data-enrollment="${html(item.id)}" data-enrollment-status="CANCELLED">取消</button>`;
  return `<span class="muted">已结束</span>`;
}

function menuForRole(_role: string, menuPermissions?: string[]) {
  // 诊所端所有人权限一致：全菜单
  const menu: Array<[string, string]> = [
    ["desk", "📊 今日工作台"],
    ["crm", "👥 患者管理"],
    ["treatments", "疗程管理"],
    ["invites", "🎁 邀请管理"],
    ["marketing", "🎯 活动"],
    ["articles", "📚 健康科普"],
    ["marketingPosts", "📢 营销推送"],
    ["tasks", "✅ 待办中心"],
    ["knowledgeSearch", "患者治疗方案"],
    ["cervicalAgent", "日常医学问答"]
  ];
  const clinicalKeys = new Set(["knowledgeSearch", "cervicalAgent"]);
  const roleMenu = _role === "CLINIC_FRONT_DESK" ? menu.filter(([key]) => !clinicalKeys.has(key)) : menu;
  if (!menuPermissions || menuPermissions.length === 0) return roleMenu;
  return roleMenu.filter(([key]) => clinicalKeys.has(key) || menuPermissions.includes(key as string));
}

function renderClinicSidebar(role: string, menuPermissions?: string[]) {
  const visible = new Map(menuForRole(role, menuPermissions));
  const groups = [
    {
      label: "日常经营",
      items: [
        ["desk", "今日工作台"],
        ["crm", "患者管理"],
        ["treatments", "疗程管理"],
        ["tasks", "待办中心"]
      ]
    },
    {
      label: "增长与内容",
      items: [
        ["invites", "邀请管理"],
        ["marketing", "活动运营"],
        ["articles", "健康科普"],
        ["marketingPosts", "营销推送"]
      ]
    },
    {
      label: "临床支持",
      items: [
        ["knowledgeSearch", "患者治疗方案"],
        ["cervicalAgent", "日常医学问答"]
      ]
    }
  ];
  return groups.map((group) => {
    const items = group.items.filter(([key]) => visible.has(key));
    if (items.length === 0) return "";
    return `<section class="clinic-nav-group">
      <div class="clinic-nav-group__label">${group.label}</div>
      ${items.map(([key, label]) => `<button data-tab="${key}" class="${state.active === key ? "active" : ""}">${label}</button>`).join("")}
    </section>`;
  }).join("");
}

function clinicWorkspaceLabel(key: string): string {
  if (key === "knowledgeSearch") return "患者治疗方案";
  if (key === "cervicalAgent") return "日常医学问答";
  // patient:<id> 这种动态 key 直接用患者姓名作为标签
  if (key.startsWith("patient:")) {
    const patientId = key.slice("patient:".length);
    const patient = state.data?.patients?.find((p: any) => p.id === patientId);
    if (patient?.name) return `${patient.name} · 档案`;
    return "患者档案";
  }
  const item = menuForRole(state.data?.role ?? "", state.data?.currentUser?.menuPermissions).find(([candidate]) => candidate === key);
  const label = item?.[1] ?? key;
  const withoutIcon = label.replace(/^[^\s]+\s+/, "").trim();
  return withoutIcon || label;
}

function ensureClinicWorkspaceTab(key: string, patientId?: string) {
  if (!state.workspaceTabs.some((tab) => tab.key === key)) {
    state.workspaceTabs.push({ key, label: clinicWorkspaceLabel(key), patientId });
  } else {
    // 兼容重复打开：把 patientId 写回已有 tab
    const existing = state.workspaceTabs.find((t) => t.key === key);
    if (existing && patientId) existing.patientId = patientId;
  }
}

function renderClinicWorkspaceTabs(): string {
  return `<nav class="workspace-tabs" aria-label="已打开页面">
    <div class="workspace-tabs__rail">
      ${state.workspaceTabs.map((tab) => `<div class="workspace-tab ${tab.key === state.active ? "is-active" : ""}">
        <button type="button" class="workspace-tab__target" data-workspace-tab="${html(tab.key)}">
          <span class="workspace-tab__signal"></span>
          <span class="workspace-tab__label">${html(tab.label)}</span>
        </button>
        <button type="button" class="workspace-tab__close" data-close-workspace-tab="${html(tab.key)}" aria-label="关闭 ${html(tab.label)}" ${state.workspaceTabs.length === 1 ? "disabled" : ""}>×</button>
      </div>`).join("")}
    </div>
  </nav>`;
}

function activateClinicWorkspaceTab(key: string, patientId?: string) {
  ensureClinicWorkspaceTab(key, patientId);
  state.active = key;
  if (state.active === "invites") loadInvites();
  if (state.active === "cervicalAgent") void loadCervicalPlans();
  // 打开患者档案 tab 时按需拉数据
  if (key.startsWith("patient:") && patientId) {
    void loadPatientDetail(patientId);
  }
  renderApp();
}

async function loadCervicalPlans(patientId?: string) {
  try {
    const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : "";
    const data = await api<{ plans: any[] }>(`/api/clinic/cervical-treatment-agent${query}`);
    state.cervicalPlans = data.plans;
  } catch (error: any) {
    showToast(error.message || "加载智能方案失败", "error");
  }
}

async function downloadCervicalPlanWord(planId: string) {
  const response = await fetch(`${API_BASE_URL}/api/clinic/cervical-treatment-agent/${encodeURIComponent(planId)}/word`, {
    credentials: "include"
  });
  if (!response.ok) throw new Error("Word 文档导出失败");
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)/);
  const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : "治疗方案.docx";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function knowledgeSearchLocalAttachments() {
  return state.knowledgeSearchLocalAttachments ?? [];
}

function knowledgeSearchHistoryFiles() {
  return state.knowledgeSearchHistoryFiles ?? [];
}

function knowledgeSearchSelectedHistoryUrls() {
  return state.knowledgeSearchSelectedHistoryUrls ?? [];
}

function mergedKnowledgeSearchAttachments() {
  const pickedHistory = knowledgeSearchHistoryFiles()
    .filter((item) => knowledgeSearchSelectedHistoryUrls().includes(item.url))
    .map((item) => ({ url: item.url, name: item.name, type: item.type, size: item.size }));
  const map = new Map<string, { url: string; name: string; type: string; size: number }>();
  [...knowledgeSearchLocalAttachments(), ...pickedHistory].forEach((item) => map.set(item.url, item));
  return Array.from(map.values()).slice(0, 6);
}

async function loadKnowledgeSearchHistory(patientId: string) {
  if (!patientId) {
    state.knowledgeSearchHistoryFiles = [];
    state.knowledgeSearchSelectedHistoryUrls = [];
    return;
  }
  state.knowledgeSearchHistoryLoading = true;
  renderApp();
  try {
    const data = await api<{ records: any[] }>(`/api/clinic/patients/${encodeURIComponent(patientId)}/records`);
    const files = (data.records ?? []).flatMap((record: any) =>
      Array.isArray(record.attachments)
        ? record.attachments.map((attachment: any, index: number) => ({
            id: `${record.id || record.createdAt || "record"}-${index}-${attachment.url}`,
            url: attachment.url,
            name: attachment.name,
            type: attachment.type,
            size: attachment.size,
            createdAt: record.createdAt,
            content: record.content,
            authorName: record.authorName,
            authorRole: record.authorRole
          }))
        : []
    ).filter((item: any) => item.type?.startsWith("image/") || item.type === "application/pdf");
    state.knowledgeSearchHistoryFiles = files;
    state.knowledgeSearchSelectedHistoryUrls = knowledgeSearchSelectedHistoryUrls().filter((url) => files.some((item: any) => item.url === url));
  } catch (error: any) {
    state.knowledgeSearchHistoryFiles = [];
    state.knowledgeSearchSelectedHistoryUrls = [];
    showToast(error.message || "加载历史文件失败", "error");
  } finally {
    state.knowledgeSearchHistoryLoading = false;
    renderApp();
  }
}

function closeClinicWorkspaceTab(key: string) {
  if (state.workspaceTabs.length === 1) return;
  const index = state.workspaceTabs.findIndex((tab) => tab.key === key);
  if (index < 0) return;
  const wasActive = state.active === key;
  state.workspaceTabs.splice(index, 1);
  if (wasActive) {
    const next = state.workspaceTabs[index] ?? state.workspaceTabs[index - 1];
    activateClinicWorkspaceTab(next.key);
    return;
  }
  renderApp();
}

function bindClinicTableRowDetails() {
  document.querySelectorAll<HTMLTableRowElement>(".content-stage .table-wrap tbody tr").forEach((row) => {
    const table = row.closest("table");
    if (table?.parentElement?.hasAttribute("data-skip-row-details")) return;
    if (row.querySelector(".empty-state") || row.cells.length < 2) return;
    row.classList.add("is-detail-row");
    row.title = "点击查看完整信息";
    row.onclick = (event) => {
      if ((event.target as HTMLElement).closest("button, a, input, select, textarea, label")) return;
      const table = row.closest("table");
      const headers = Array.from(table?.querySelectorAll<HTMLTableCellElement>("thead th") ?? []);
      const cells = Array.from(row.cells);
      const entries = cells.flatMap((cell, index) => {
        if (cell.querySelector("button, input") || cell.classList.contains("actions")) return [];
        const label = headers[index]?.innerText.trim() || `字段 ${index + 1}`;
        const value = cell.innerText.trim() || "-";
        return [{ label, value }];
      });
      document.querySelector(".row-detail-backdrop")?.remove();
      document.body.insertAdjacentHTML("beforeend", `<div class="row-detail-backdrop" data-close-row-detail>
        <section class="row-detail-sheet" role="dialog" aria-modal="true" aria-label="数据详情">
          <header class="row-detail-sheet__header"><div><span>完整信息</span><h2>${html(entries[0]?.value ?? "数据详情")}</h2></div><button type="button" data-close-row-detail aria-label="关闭">×</button></header>
          <div class="row-detail-grid">${entries.map((entry) => `<div><span>${html(entry.label)}</span><strong>${html(entry.value)}</strong></div>`).join("")}</div>
        </section>
      </div>`);
      document.querySelectorAll<HTMLElement>("[data-close-row-detail]").forEach((element) => {
        element.onclick = (closeEvent) => {
          if (closeEvent.target === element) document.querySelector(".row-detail-backdrop")?.remove();
        };
      });
    };
  });
}

const ROLE_LABELS: Record<string, string> = {
  CLINIC_DOCTOR: "医生",
  CLINIC_FRONT_DESK: "医生",
  CLINIC_MANAGER: "医生",
  PLATFORM_ADMIN: "总部"
};

function renderApp() {
  const data = state.data;
  if (!data) return renderLogin();
  state.sidebarScrollTop = document.querySelector<HTMLElement>(".sidebar")?.scrollTop ?? state.sidebarScrollTop;
  state.workspaceScrollLeft = document.querySelector<HTMLElement>(".workspace-tabs__rail")?.scrollLeft ?? state.workspaceScrollLeft;
  // 保存当前焦点（id + selectionStart/End），render 后恢复，避免输入框失焦
  const active = document.activeElement as HTMLElement | null;
  const focusKey = active?.id || active?.dataset?.focusKey;
  const selStart = (active as HTMLInputElement | HTMLTextAreaElement | null)?.selectionStart ?? null;
  const selEnd = (active as HTMLInputElement | HTMLTextAreaElement | null)?.selectionEnd ?? null;
  root.innerHTML = `
    <div class="app app--clinic">
      <header class="topbar">
        <div class="brand"><strong>${html(data.clinic?.name ?? "门店端")}</strong><span>${html(ROLE_LABELS[data.role] ?? data.role)}</span></div>
        <div style="display:flex;gap:8px;align-items:center">
          <div class="shell-signal"><span></span><strong>门店在线</strong><small>今日工作进行中</small></div>
          <div class="notif-wrap">
            <button id="notifBtn" class="secondary notif-btn" aria-label="通知"><span class="notif-bell">🔔</span>${state.unread > 0 ? `<span class="notif-dot">${state.unread > 99 ? "99+" : state.unread}</span>` : ""}</button>
            ${state.notifOpen ? renderNotifPanel() : ""}
          </div>
          <button id="logoutBtn" class="secondary">退出</button>
        </div>
      </header>
      <div class="layout">
        <aside class="sidebar sidebar--clinic">
          ${renderClinicSidebar(data.role, data.currentUser?.menuPermissions)}
          <div class="sidebar-intelligence">
            <span class="sidebar-intelligence__eyebrow">今日焦点</span>
            <strong>${(data.metrics.pendingFollowUps ?? 0) + (data.metrics.appointmentsToday ?? 0)} 项需关注</strong>
            <small>优先处理预约、随访和总部下发任务</small>
            <button type="button" data-tab="tasks">进入待办中心</button>
          </div>
        </aside>
        <main class="main">
          ${renderClinicWorkspaceTabs()}
          ${status()}
          <div class="content-stage content-stage--clinic">
            ${state.active.startsWith("patient:") ? renderPatientDetail(state.active.slice("patient:".length)) : ""}
            ${state.active === "desk" ? renderDesk(data) : ""}
            ${state.active === "crm" ? renderCrm(data) : ""}
            ${state.active === "treatments" ? renderTreatments(data) : ""}
            ${state.active === "invites" ? renderInvites(data) : ""}
            ${state.active === "marketing" ? renderMarketing(data) : ""}
            ${state.active === "articles" ? renderArticles(data) : ""}
            ${state.active === "marketingPosts" ? renderMarketingPosts(data) : ""}
            ${state.active === "tasks" ? renderTasks(data) : ""}
            ${state.active === "knowledgeSearch" ? renderKnowledgeSearchV2(data) : ""}
            ${state.active === "cervicalAgent" ? renderMedicalQaV2(data) : ""}
          </div>
        </main>
      </div>
      ${renderNotificationDetail(state.activeNotification)}
    </div>`;

  document.querySelector<HTMLButtonElement>("#logoutBtn")!.onclick = (event) => {
    const btn = event.currentTarget as HTMLButtonElement;
    return withLoading(btn, async () => {
      await logout();
      state = { active: "desk", workspaceTabs: [{ key: "desk", label: "今日工作台" }], sidebarScrollTop: 0, workspaceScrollLeft: 0, message: "已退出", notifOpen: false, notifications: [], unread: 0, invites: [], posterMode: "template", posterImageBase64: null, posterTemplate: null, posterDraft: { ...EMPTY_POSTER_TEMPLATE }, toasts: [], taskFilter: { status: "all", priority: "all" }, taskNoteDraft: {}, treatmentPatientId: "", treatmentDraftPatientId: "", cervicalPlans: [], cervicalAgentLoading: false, patientDetailCache: {} };
      state.patientDetailCache = {};
      renderLogin();
    });
  };
  document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((button) => {
    button.onclick = () => {
      state.active = button.dataset.tab!;
      if (state.active === "invites") loadInvites();
      renderApp();
    };
  });
  document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((button) => {
    button.onclick = () => activateClinicWorkspaceTab(button.dataset.tab!);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-workspace-tab]").forEach((button) => {
    button.onclick = () => activateClinicWorkspaceTab(button.dataset.workspaceTab!);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-close-workspace-tab]").forEach((button) => {
    button.onclick = (event) => {
      event.stopPropagation();
      closeClinicWorkspaceTab(button.dataset.closeWorkspaceTab!);
    };
  });
  bindActions();
  bindClinicTableRowDetails();
  bindCrmRowNavigation();
  bindPatientDetailHandlers();
  const sidebar = document.querySelector<HTMLElement>(".sidebar");
  if (sidebar) sidebar.scrollTop = state.sidebarScrollTop;
  const workspaceRail = document.querySelector<HTMLElement>(".workspace-tabs__rail");
  if (workspaceRail) {
    workspaceRail.scrollLeft = state.workspaceScrollLeft;
    workspaceRail.querySelector<HTMLElement>(".workspace-tab.is-active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
    state.workspaceScrollLeft = workspaceRail.scrollLeft;
  }
  // 自动刷新正在显示的邀请管理
  if (state.active === "invites") loadInvites();
  // 渲染海报图片（base64 在 renderApp 时还没设进 DOM；此时再注入）
  const posterImg = document.querySelector<HTMLImageElement>("#invitePosterImg");
  if (posterImg && state.posterImageBase64) posterImg.src = state.posterImageBase64;
  // 恢复焦点
  if (focusKey) {
    const next = document.getElementById(focusKey) || document.querySelector<HTMLElement>(`[data-focus-key="${focusKey}"]`);
    if (next) {
      next.focus();
      if (selStart != null && selEnd != null && (next as HTMLInputElement).setSelectionRange) {
        try { (next as HTMLInputElement).setSelectionRange(selStart, selEnd); } catch {}
      }
    }
  }
}

function renderDesk(data: Dashboard) {
  const pendingAppointments = data.appointments.filter((item) => item.status === "PENDING").length;
  const confirmedAppointments = data.appointments.filter((item) => item.status === "CONFIRMED").length;
  const arrivedAppointments = data.appointments.filter((item) => item.status === "ARRIVED").length;
  const activeEnrollments = data.enrollments.filter((item) => !["CONVERTED", "CANCELLED"].includes(item.status)).length;
  return `
    <header class="page-header">
      <div class="page-header__main">
        <nav class="breadcrumb"><span class="breadcrumb__current">${html(data.clinic?.name ?? "门店")} · ${html(ROLE_LABELS[data.role] ?? data.role)} 工作台</span></nav>
        <h2 class="page-title">今日工作台</h2>
        <p class="page-sub">快速查看今日预约、待随访、报名线索与销售额，并可直接跟进转化。</p>
      </div>
    </header>
    <section class="clinic-dayflow" aria-label="今日业务进度">
      <div class="clinic-dayflow__intro">
        <span class="eyebrow">今日业务进度</span>
        <strong>从预约确认到持续随访</strong>
      </div>
      <div class="clinic-dayflow__steps">
        <div class="clinic-dayflow__step ${pendingAppointments > 0 ? "is-attention" : "is-done"}"><span>01</span><strong>预约确认</strong><small>${pendingAppointments} 项待处理</small></div>
        <div class="clinic-dayflow__step ${confirmedAppointments > 0 ? "is-active" : ""}"><span>02</span><strong>到店接诊</strong><small>${confirmedAppointments} 位待到店</small></div>
        <div class="clinic-dayflow__step ${arrivedAppointments > 0 || activeEnrollments > 0 ? "is-active" : ""}"><span>03</span><strong>治疗跟进</strong><small>${arrivedAppointments + activeEnrollments} 项进行中</small></div>
        <div class="clinic-dayflow__step ${(data.metrics.pendingFollowUps ?? 0) > 0 ? "is-attention" : ""}"><span>04</span><strong>持续随访</strong><small>${data.metrics.pendingFollowUps ?? 0} 项待完成</small></div>
      </div>
    </section>
    <section class="kpi-grid">
      <div class="kpi-card kpi-card--rose">
        <div class="kpi-card__label">今日预约</div>
        <div class="kpi-card__value">${data.metrics.appointmentsToday ?? 0}</div>
        <div class="kpi-card__hint">含待确认 / 已确认 / 已到店</div>
      </div>
      <div class="kpi-card kpi-card--amber">
        <div class="kpi-card__label">待随访</div>
        <div class="kpi-card__value">${data.metrics.pendingFollowUps ?? 0}</div>
        <div class="kpi-card__hint">购药后未完成的随访</div>
      </div>
      <div class="kpi-card kpi-card--indigo">
        <div class="kpi-card__label">报名线索</div>
        <div class="kpi-card__value">${data.metrics.newEnrollments ?? 0}</div>
        <div class="kpi-card__hint">新增的活动报名</div>
      </div>
      <div class="kpi-card kpi-card--teal">
        <div class="kpi-card__label">销售额</div>
        <div class="kpi-card__value" style="font-size:22px">${money(data.metrics.purchaseAmount)}</div>
        <div class="kpi-card__hint">累计已支付订单</div>
      </div>
    </section>
    <section class="panel">
      <h3>预约与报名线索</h3>
      <div class="table-wrap"><table><thead><tr><th>患者</th><th>项目</th><th>预约时间</th><th>状态</th><th>动作</th></tr></thead><tbody>
        ${data.appointments.filter((item) => !["CANCELLED"].includes(item.status)).map((item) => {
          const patientCell = item.patientName
            ? `<strong>${html(item.patientName)}</strong><div class="muted">${html(item.patientPhone ?? "")}</div>`
            : `<span class="muted">—</span>`;
          return `<tr><td>${patientCell}</td><td>${html(item.item)}</td><td>${item.time ? new Date(item.time).toLocaleString() : "—"}</td><td>${html(labelOf(APPOINTMENT_STATUS_LABELS, item.status))}</td><td class="actions">${appointmentActions(item)}</td></tr>`;
        }).join("")}
        ${data.enrollments.filter((item) => !["CONVERTED", "CANCELLED"].includes(item.status)).map((item) => {
          const patientCell = item.patientName
            ? `<strong>${html(item.patientName)}</strong><div class="muted">${html(item.patientPhone ?? "")}</div>`
            : `<span class="muted">—</span>`;
          return `<tr><td>${patientCell}</td><td>活动报名</td><td>—</td><td>${html(labelOf(ENROLLMENT_STATUS_LABELS, item.status))} · ${html(item.source)}</td><td class="actions">${enrollmentActions(item)}</td></tr>`;
        }).join("")}
      </tbody></table></div>
    </section>`;
}

function renderCrm(data: Dashboard) {
  return `
    <header class="page-header">
      <div class="page-header__main">
        <nav class="breadcrumb"><span class="breadcrumb__current">患者管理</span></nav>
        <h2 class="page-title">患者管理</h2>
        <p class="page-sub">登记新患者、记录购买、查看全部患者档案与复查状态。</p>
      </div>
    </header>
    <section class="clinic-action-grid">
      <div class="panel action-panel">
        <div class="section-kicker">新患者建档</div>
        <h3>登记新患者</h3>
        <p class="muted">快速建立患者基础档案，便于后续购买、复查与随访管理。</p>
        <form id="patientForm" class="form">
          <input name="name" placeholder="姓名" />
          <input name="phone" placeholder="手机号" />
          <input name="age" placeholder="年龄" />
          <input name="tag" placeholder="标签" value="待随访" />
          <button type="submit">登记</button>
        </form>
      </div>
      <div class="panel action-panel action-panel--accent">
        <div class="section-kicker">成交记录</div>
        <h3>记录购买</h3>
        <p class="muted">关联患者和产品包，提交后自动生成对应随访任务。</p>
        <form id="purchaseForm" class="form">
          <select name="patientId">${data.patients.map((item) => `<option value="${html(item.id)}">${html(item.name)} · ${html(item.phone ?? "")}</option>`).join("")}</select>
          <select name="kitId">${data.drugKits.map((item) => `<option value="${html(item.id)}">${html(item.name)} · ${money(item.retailPrice)}</option>`).join("")}</select>
          <input name="quantity" placeholder="数量" value="1" type="number" min="1" />
          <button type="submit">记录购买并生成随访</button>
        </form>
      </div>
    </section>
    <section class="panel data-panel">
      <div class="section-heading"><div><span class="section-kicker">患者资产</span><h3>患者列表</h3></div><span class="section-count">${data.patients.length} 位患者</span></div>
      <div class="table-toolbar">
        <input class="search-input" id="crmSearch" placeholder="🔍 搜索姓名 / 手机 / 标签" />
      </div>
      <div class="table-wrap" data-skip-row-details><table id="crmTable"><thead><tr><th>姓名</th><th>手机</th><th>标签</th><th>复查状态</th><th>来源</th></tr></thead><tbody>
        ${data.patients.map((item) => `<tr data-patient-id="${html(item.id)}" data-search="${html((item.name + " " + item.phone + " " + (item.tags ?? []).join(" ") + " " + (item.source ?? "")).toLowerCase())}" class="crm-row" style="cursor:pointer">
          <td><strong>${html(item.name)}<span class="crm-row__chevron" title="点击查看完整档案"></span></strong></td>
          <td>${html(item.phone ?? "")}</td>
          <td>${html((item.tags ?? []).join(" / "))}</td>
          <td>${html(labelOf(REVISIT_STATUS_LABELS, item.revisitStatus))}</td>
          <td><span class="pill ${item.source?.includes("推荐") ? "rose" : "gray"}">${html(item.source ?? "—")}</span></td>
        </tr>`).join("")}
      </tbody></table></div>
    </section>`;
}

// ============================================================================
// 患者档案详情（在工作区 tab 中打开，三 sub-tab：月经/症状/档案）
// ============================================================================

const PERIOD_MODE_LABEL: Record<string, string> = {
  PERIOD: "经期模式",
  PREPARE: "备孕模式",
  PREGNANT: "怀孕模式",
  MOM: "宝妈模式",
  HIDE: "隐藏模式"
};

const SYMPTOM_CATEGORY_LABEL: Record<string, string> = {
  PHYSICAL: "身体",
  EMOTIONAL: "情绪",
  DIGESTIVE: "消化",
  SKIN: "皮肤",
  SLEEP: "睡眠",
  OTHER: "其他"
};

// 月经字段翻译（患者端有的 label，医生端原本缺失）
const PAIN_LABEL: Record<string, string> = { NONE: "无", MILD: "轻微", MODERATE: "中度", SEVERE: "严重" };
const FLOW_DETAIL_LABEL: Record<string, string> = { very_light: "很少", light: "较少", normal: "正常", heavy: "较多", very_heavy: "很多" };
const FLOW_LEVEL_LABEL: Record<string, string> = { LIGHT: "偏少", MEDIUM: "适中", HEAVY: "偏多" };
const BLOOD_COLOR_LABEL: Record<string, string> = { light_pink: "淡粉", red: "鲜红", dark_red: "暗红", brown: "褐色", black: "黑色" };
const BLOOD_STATE_LABEL: Record<string, string> = { nothing: "无异常", bad_smell: "异味", block: "血块", zhazhuang: "渣状" };
const DISCOMFORT_LABEL: Record<string, string> = { NONE: "无不适", BLOATING: "腹胀", CRAMPS: "痉挛", HEADACHE: "头痛", FATIGUE: "乏力", MOOD: "情绪波动" };
const SLEEP_LABEL: Record<string, string> = { POOR: "差", NORMAL: "一般", GOOD: "良好", EXCELLENT: "极佳" };
const BOWEL_LABEL: Record<string, string> = { normal: "正常", constipation: "便秘", diarrhea: "腹泻" };
const EXERCISE_LABEL: Record<string, string> = { none: "无", mild: "轻度", moderate: "中等", heavy: "高强度" };
const COC_LABEL: Record<string, string> = { emergency: "紧急避孕药", short_term: "短效避孕药" };
const OVU_LABEL: Record<string, string> = { invalid: "无效", negative: "阴性", weak_positive: "弱阳性", positive: "阳性", strong_positive: "强阳性", multiple: "多囊信号" };
const PREG_LABEL: Record<string, string> = { invalid: "无效", negative: "阴性", positive: "阳性" };
const MOOD_LABEL: Record<string, string> = { happy: "愉悦", calm: "平静", tired: "疲倦", anxious: "焦虑", blue: "低落", angry: "烦躁", other: "其他" };
const RISK_LEVEL_LABEL: Record<string, string> = { URGENT: "需尽快就医", CARE: "建议关注", OBSERVE: "观察", NORMAL: "正常" };
const ASSESS_LEVEL_LABEL: Record<string, string> = { CARE: "需关注", MILD: "轻微", NORMAL: "正常" };
const REGULARITY_LABEL: Record<string, string> = { REGULAR: "规律", MILD_VARIATION: "轻微波动", IRREGULAR: "不规律" };
const HABIT_TAG_LABEL: Record<string, string> = { "充足睡眠": "充足睡眠", "规律运动": "规律运动", "健康饮食": "健康饮食", "压力管理": "压力管理", "不吃辣": "不吃辣", "早睡早起": "早睡早起", "多喝水": "多喝水", "吃水果": "吃水果", "清淡饮食": "清淡饮食", "补充蛋白": "补充蛋白", "散步": "散步", "早睡": "早睡", "午休": "午休", "热敷": "热敷", "泡脚": "泡脚", "放松冥想": "放松冥想", "不喝冰饮": "不喝冰饮" };
const SYMPTOM_TAG_LABEL: Record<string, string> = { "腹胀": "腹胀", "腹痛": "腹痛", "腰酸": "腰酸", "头痛": "头痛", "头晕": "头晕", "乏力": "乏力", "乳房胀痛": "乳房胀痛", "恶心": "恶心", "腹泻": "腹泻", "便秘": "便秘", "长痘": "长痘", "浮肿": "浮肿" };

function joinLabels(arr: unknown, map: Record<string, string>): string {
  if (!Array.isArray(arr) || arr.length === 0) return "—";
  return arr.map((v) => map[String(v)] ?? String(v)).join("、");
}

function yesNo(v: unknown): string {
  return v ? "是" : "否";
}

async function loadPatientDetail(patientId: string) {
  if (!state.patientDetailCache[patientId]) {
    state.patientDetailCache[patientId] = { activeSubTab: "menstrual", loading: true };
  } else {
    state.patientDetailCache[patientId].loading = true;
  }
  state.patientDetailCache[patientId]!.loading = true;
  renderApp();
  try {
    const [menstrual, symptoms, notes, aiChat, plans] = await Promise.all([
      api<any>(`/api/clinic/patients/${patientId}/menstrual-records`).catch((e) => ({ error: e?.message })),
      api<any>(`/api/clinic/patients/${patientId}/symptom-logs?limit=200`).catch((e) => ({ error: e?.message })),
      api<any>(`/api/clinic/patients/${patientId}/records`).catch((e) => ({ error: e?.message })),
      api<any>(`/api/clinic/patients/${patientId}/chat-history`).catch((e) => ({ error: e?.message })),
      api<{ plans: any[] } | { error: string }>(`/api/clinic/cervical-treatment-agent?patientId=${encodeURIComponent(patientId)}`).catch((e) => ({ error: e?.message }))
    ]);
    const detail = state.patientDetailCache[patientId]!;
    detail.menstrual = menstrual?.error ? undefined : menstrual;
    detail.symptoms = symptoms?.error ? undefined : symptoms;
    detail.notes = notes?.error ? undefined : notes;
    detail.aiChat = aiChat?.error ? undefined : aiChat;
    detail.plans = "error" in plans ? [] : plans.plans ?? [];
    detail.loading = false;
  } catch (e: any) {
    showToast("加载患者档案失败：" + (e?.message || "未知错误"), "error");
    state.patientDetailCache[patientId]!.loading = false;
  }
  renderApp();
}

function renderPatientDetail(patientId: string) {
  const detail = state.patientDetailCache[patientId];
  const patient = state.data?.patients?.find((p: any) => p.id === patientId);
  if (!patient) {
    return `<section class="panel data-panel"><div class="empty-state">找不到该患者，可能已删除或不属于本诊所。</div></section>`;
  }
  const subTab = detail?.activeSubTab ?? "menstrual";
  const tabs = [
    { key: "menstrual", label: "月经周期" },
    { key: "symptom", label: "症状记录" },
    { key: "records", label: "健康档案" },
    { key: "aiChat", label: "AI 对话" },
    { key: "plans", label: "治疗方案" }
  ];
  const head = `
    <header class="page-header">
      <div class="page-header__main">
        <nav class="breadcrumb"><a href="#" data-tab="crm">患者管理</a><span>›</span><span class="breadcrumb__current">${html(patient.name)} · 档案</span></nav>
        <h2 class="page-title">${html(patient.name)}</h2>
        <p class="page-sub">${html(patient.phone ?? "")} · ${html(state.data?.clinic?.name ?? "")} · ${(detail?.menstrual?.records?.length ?? 0)} 条经期 / ${(detail?.symptoms?.items?.length ?? 0)} 条症状 / ${(detail?.notes?.records?.length ?? 0)} 条档案 / ${(detail?.aiChat?.messages?.length ?? 0)} 条 AI 对话 / ${(detail?.plans?.length ?? 0)} 份治疗方案</p>
      </div>
    </header>
    <nav class="patient-detail-subtabs">
      ${tabs.map((t) => `<button type="button" data-patient-detail-tab="${t.key}" class="${subTab === t.key ? "is-active" : ""}">${t.label}</button>`).join("")}
    </nav>`;

  if (detail?.loading) {
    return head + `<div class="empty-state">加载中...</div>`;
  }
  if (subTab === "menstrual") return head + renderPatientMenstrual(patientId);
  if (subTab === "symptom") return head + renderPatientSymptoms(patientId);
  if (subTab === "aiChat") return head + renderPatientAiChat(patientId);
  if (subTab === "plans") return head + renderPatientPlans(patientId);
  return head + renderPatientRecords(patientId);
}

function renderMenstrualDetailPanel(record: any, prevWeight: number | null) {
  // 单条记录的完整 5 大块详情（用于行点击 inline 展开）
  const r = record || {};
  const formatDate = (s: unknown) => s ? String(s).slice(0, 10) : "—";
  const weightDelta = (r.weight != null && prevWeight != null && prevWeight !== r.weight)
    ? ` (${(r.weight - prevWeight >= 0 ? "+" : "") + (r.weight - prevWeight).toFixed(1)} kg)`
    : "";

  // 块 ① 经期与出血
  const block1 = `
    <div class="menstrual-detail__block">
      <div class="menstrual-detail__title">经期与出血</div>
      <div class="menstrual-detail__grid">
        <div class="menstrual-detail__field"><label>开始日期</label><strong>${html(formatDate(r.startDate))}</strong></div>
        <div class="menstrual-detail__field"><label>结束日期</label><strong>${html(r.endDate ? formatDate(r.endDate) : "进行中")}</strong></div>
        <div class="menstrual-detail__field"><label>流量等级</label><strong>${html(r.flowLevel ? (FLOW_LEVEL_LABEL[r.flowLevel] ?? r.flowLevel) : "—")}</strong></div>
        <div class="menstrual-detail__field"><label>5 级流量感受</label><strong>${html(r.flowDetail ? (FLOW_DETAIL_LABEL[r.flowDetail] ?? r.flowDetail) : "—")}</strong></div>
        <div class="menstrual-detail__field"><label>血液颜色</label><strong>${html(r.bloodColor ? (BLOOD_COLOR_LABEL[r.bloodColor] ?? r.bloodColor) : "—")}</strong></div>
        <div class="menstrual-detail__field"><label>经血状态</label><strong>${html(joinLabels(r.bloodState, BLOOD_STATE_LABEL))}</strong></div>
        <div class="menstrual-detail__field"><label>无效标记</label><strong>${r.isInvalid ? "是（不参与预测）" : "否"}</strong></div>
      </div>
    </div>`;

  // 块 ② 身体信号
  const block2 = `
    <div class="menstrual-detail__block">
      <div class="menstrual-detail__title">身体信号</div>
      <div class="menstrual-detail__grid">
        <div class="menstrual-detail__field"><label>疼痛等级</label><strong>${html(r.painLevel ? (PAIN_LABEL[r.painLevel] ?? r.painLevel) : "—")}</strong></div>
        <div class="menstrual-detail__field"><label>主要不适</label><strong>${html(r.discomfort ? (DISCOMFORT_LABEL[r.discomfort] ?? r.discomfort) : "—")}</strong></div>
        <div class="menstrual-detail__field"><label>体重</label><strong>${r.weight != null ? `${r.weight} kg${html(weightDelta)}` : "—"}</strong></div>
        <div class="menstrual-detail__field"><label>睡眠质量</label><strong>${html(r.sleepQuality ? (SLEEP_LABEL[r.sleepQuality] ?? r.sleepQuality) : "—")}</strong></div>
        <div class="menstrual-detail__field"><label>睡眠时长</label><strong>${r.sleepHours != null ? `${r.sleepHours} 小时` : "—"}</strong></div>
        <div class="menstrual-detail__field"><label>基础体温</label><strong>${r.bodyTemp != null ? `${r.bodyTemp} °C` : "—"}</strong></div>
        <div class="menstrual-detail__field"><label>排便</label><strong>${html(r.bowel ? (BOWEL_LABEL[r.bowel] ?? r.bowel) : "—")}</strong></div>
        <div class="menstrual-detail__field"><label>运动</label><strong>${html(r.exercise ? (EXERCISE_LABEL[r.exercise] ?? r.exercise) : "—")}</strong></div>
      </div>
    </div>`;

  // 块 ③ 生育与避孕
  const block3 = `
    <div class="menstrual-detail__block">
      <div class="menstrual-detail__title">生育与避孕</div>
      <div class="menstrual-detail__grid">
        <div class="menstrual-detail__field"><label>同房</label><strong>${html(yesNo(r.intercourse))}</strong></div>
        <div class="menstrual-detail__field"><label>使用安全套</label><strong>${html(yesNo(r.condomUse))}</strong></div>
        <div class="menstrual-detail__field"><label>避孕药类型</label><strong>${html(r.cocType ? (COC_LABEL[r.cocType] ?? r.cocType) : "—")}</strong></div>
        <div class="menstrual-detail__field"><label>排卵试纸</label><strong>${html(r.ovuTestResult ? (OVU_LABEL[r.ovuTestResult] ?? r.ovuTestResult) : "—")}</strong></div>
        <div class="menstrual-detail__field"><label>验孕结果</label><strong>${html(r.pregTestResult ? (PREG_LABEL[r.pregTestResult] ?? r.pregTestResult) : "—")}</strong></div>
        <div class="menstrual-detail__field"><label>心情</label><strong>${html(r.mood ? (MOOD_LABEL[r.mood] ?? r.mood) : "—")}</strong></div>
      </div>
    </div>`;

  // 块 ④ 生活方式
  const habitsHtml = joinLabels(r.habits, HABIT_TAG_LABEL);
  const symptomsHtml = joinLabels(r.symptoms, SYMPTOM_TAG_LABEL);
  const meds = Array.isArray(r.medications) ? r.medications : [];
  const medsHtml = meds.length
    ? `<div class="menstrual-detail__meds">${meds.map((m: any) => `<span><strong>${html(m.name || "—")}</strong>${html(m.dosage || "")} ${html(m.time || "")}</span>`).join("")}</div>`
    : "<strong>—</strong>";
  const leucorrhea = Array.isArray(r.whiteLeucorrhea) ? r.whiteLeucorrhea : [];
  const leucorrheaHtml = leucorrhea.length ? leucorrhea.join(" / ") : "—";
  const block4 = `
    <div class="menstrual-detail__block">
      <div class="menstrual-detail__title">生活方式</div>
      <div class="menstrual-detail__grid">
        <div class="menstrual-detail__field"><label>健康习惯</label><strong>${html(habitsHtml)}</strong></div>
        <div class="menstrual-detail__field"><label>症状标签</label><strong>${html(symptomsHtml)}</strong></div>
        <div class="menstrual-detail__field menstrual-detail__field--full"><label>用药</label>${medsHtml}</div>
        <div class="menstrual-detail__field"><label>白带</label><strong>${html(leucorrheaHtml)}</strong></div>
        <div class="menstrual-detail__field menstrual-detail__field--full"><label>备注</label>${r.notes ? `<div class="menstrual-detail__notes">${html(String(r.notes))}</div>` : "<strong>—</strong>"}</div>
      </div>
    </div>`;

  // 块 ⑤ AI 风险评估
  const ra = r.riskAssessment;
  const block5 = ra ? `
    <div class="menstrual-detail__block">
      <div class="menstrual-detail__title">AI 风险评估</div>
      <div class="menstrual-detail__grid">
        <div class="menstrual-detail__field"><label>风险等级</label><strong>${html(ra.riskLevel ? (RISK_LEVEL_LABEL[ra.riskLevel] ?? ra.riskLevel) : "—")}</strong></div>
        <div class="menstrual-detail__field"><label>是否可等到明天</label><strong>${html(yesNo(ra.canWaitUntilNextDay))}</strong></div>
        <div class="menstrual-detail__field"><label>建议科室</label><strong>${html(ra.recommendedDepartment || "—")}</strong></div>
        <div class="menstrual-detail__field menstrual-detail__field--full"><label>风险信号</label><strong>${html(joinLabels(ra.riskSignals, {} as Record<string, string>))}</strong></div>
        <div class="menstrual-detail__field menstrual-detail__field--full"><label>建议检查</label><strong>${html(joinLabels(ra.recommendedChecks, {} as Record<string, string>))}</strong></div>
        <div class="menstrual-detail__field menstrual-detail__field--full"><label>医疗建议</label>${ra.medicalAdvice ? `<div class="menstrual-detail__notes">${html(ra.medicalAdvice)}</div>` : "<strong>—</strong>"}</div>
        <div class="menstrual-detail__field menstrual-detail__field--full"><label>紧急处置</label>${ra.urgentAction ? `<div class="menstrual-detail__notes">${html(ra.urgentAction)}</div>` : "<strong>—</strong>"}</div>
      </div>
    </div>` : "";

  // 块 ⑥ AI 综合分析
  const ai = r.aiAnalysis;
  let block6 = "";
  if (ai) {
    const aiBlocks: string[] = [];
    const aiField = (label: string, val: unknown) => {
      if (val == null || val === "" || (Array.isArray(val) && val.length === 0)) return "";
      const content = Array.isArray(val) ? val.join(" / ") : String(val);
      return `<div class="menstrual-detail__ai-block"><span>${label}</span><p>${html(content)}</p></div>`;
    };
    const aiText = (label: string, obj: any) => {
      if (!obj || typeof obj !== "object") return "";
      const title = obj.title ? `<strong>${html(obj.title)}</strong> · ` : "";
      const content = obj.content ? html(obj.content) : "";
      if (!content) return "";
      return `<div class="menstrual-detail__ai-block"><span>${label}</span><p>${title}${content}</p></div>`;
    };
    aiBlocks.push(aiField("问候", ai.greeting));
    if (ai.overallScore != null) {
      aiBlocks.push(`<div class="menstrual-detail__ai-block"><span>综合评分</span><p><strong>${ai.overallScore}/10</strong> ${html(ai.overallScoreLabel || "")}</p></div>`);
    }
    aiBlocks.push(aiText("周期报告", ai.cycleReport));
    aiBlocks.push(aiText("睡眠", ai.sleepReport));
    aiBlocks.push(aiText("体重", ai.weightReport));
    aiBlocks.push(aiText("症状", ai.symptomReport));
    aiBlocks.push(aiText("习惯", ai.habitReport));
    if (ai.nextCycle) {
      const nc = ai.nextCycle;
      if (nc.predictedStart || nc.expectations) {
        aiBlocks.push(`<div class="menstrual-detail__ai-block"><span>下月预测</span><p>${html(nc.predictedStart || "")} ${html(nc.expectations || "")}</p></div>`);
      }
    }
    aiBlocks.push(aiField("本月小贴士", Array.isArray(ai.monthlyTips) ? ai.monthlyTips : null));
    aiBlocks.push(aiField("风险提示", Array.isArray(ai.riskWarnings) ? ai.riskWarnings : null));
    aiBlocks.push(aiField("医生寄语", ai.encouragement));
    block6 = `<div class="menstrual-detail__block"><div class="menstrual-detail__title">AI 综合分析</div>${aiBlocks.filter(Boolean).join("")}</div>`;
  }

  return `<div class="menstrual-detail">${block1}${block2}${block3}${block4}${block5}${block6}</div>`;
}

function renderMenstrualSparkline(probs: Array<{ date: string; periodProb: number; fertilityProb: number; ovulationProb: number }>) {
  // 14 天紧凑条形图（不引入图表库）：每天一个 14px 宽 div，高度按 periodProb
  if (!probs || probs.length === 0) return `<span class="muted" style="font-size:12px">无数据</span>`;
  const cells = probs.slice(0, 14).map((p) => {
    const h = Math.max(2, Math.round((p.periodProb / 100) * 32));
    const date = String(p.date).slice(5); // MM-DD
    return `<div class="menstrual-sparkline__bar" style="height:${h}px" title="${html(p.date)}：经期 ${p.periodProb}% / 易孕 ${p.fertilityProb}% / 排卵 ${p.ovulationProb}%"><span>${html(date)}</span></div>`;
  }).join("");
  return `<div class="menstrual-sparkline">${cells}</div>`;
}

function renderPatientMenstrual(patientId: string) {
  const detail = state.patientDetailCache[patientId];
  const data = detail?.menstrual;
  if (!data) return `<div class="menstrual-empty">该患者暂无月经数据。</div>`;

  const stateRow = data.state;
  const assessment = data.assessment;
  const config = data.config;
  const prob = data.cycleProbability;
  const records = data.records || [];
  const expandedId = detail?.expandedRecordId ?? null;

  const stateLabel = stateRow?.mode ? PERIOD_MODE_LABEL[stateRow.mode] ?? stateRow.mode : "未设置";
  const modeKey = stateRow?.mode ?? "unset";
  const stateIcon = stateRow?.mode === "PREGNANT" ? "🤰" : stateRow?.mode === "MOM" ? "👶" : stateRow?.mode === "PREPARE" ? "🌱" : stateRow?.mode === "PERIOD" ? "🌸" : "—";

  // ===== 段 1：模式 HERO（最显眼，模式决定配色）=====
  const heroDates: string[] = [];
  if (stateRow?.pregnantStartDate) heroDates.push(`<span>🤰 怀孕起始 ${new Date(stateRow.pregnantStartDate).toLocaleDateString()}</span>`);
  if (stateRow?.dueDate) heroDates.push(`<span>📅 预产期 ${new Date(stateRow.dueDate).toLocaleDateString()}</span>`);
  if (stateRow?.babyBirthDate) heroDates.push(`<span>👶 宝宝出生 ${new Date(stateRow.babyBirthDate).toLocaleDateString()}</span>`);
  if (stateRow?.prepareStartDate) heroDates.push(`<span>🌱 备孕起始 ${new Date(stateRow.prepareStartDate).toLocaleDateString()}</span>`);

  // 风险评估（用最新一条记录的 riskLevel，找不到就 None）
  const latestRiskLevel = records.find((r: any) => r.riskAssessment?.riskLevel)?.riskAssessment?.riskLevel as string | undefined;
  const riskChipClass = latestRiskLevel === "URGENT" ? "is-urgent" : latestRiskLevel === "CARE" ? "is-care" : latestRiskLevel === "OBSERVE" ? "is-observe" : "";
  const riskChipText = latestRiskLevel ? (RISK_LEVEL_LABEL[latestRiskLevel] ?? latestRiskLevel) : "暂无风险标记";

  const hero = `
    <div class="menstrual-hero menstrual-hero--${modeKey.toLowerCase()}">
      <div class="menstrual-hero__icon">${stateIcon}</div>
      <div class="menstrual-hero__body">
        <div class="menstrual-hero__eyebrow">当前状态</div>
        <div class="menstrual-hero__title">${html(stateLabel)}</div>
        <div class="menstrual-hero__dates">${heroDates.join("") || `<span style="opacity:0.7">未填写相关日期</span>`}</div>
      </div>
      <div class="menstrual-hero__risk">
        <div class="menstrual-hero__risk-label">最新风险</div>
        <div class="menstrual-hero__risk-chip ${riskChipClass}">${riskChipText}</div>
      </div>
    </div>`;

  // ===== 段 2：6 卡紧凑指标 =====
  const avgCycle = assessment?.averageCycleDays ?? config?.avgCycle;
  const avgDuration = assessment?.averageDurationDays ?? config?.avgDuration;
  const regularity = prob?.cycleStats?.regularity ? REGULARITY_LABEL[prob.cycleStats.regularity] ?? prob.cycleStats.regularity : "—";
  const metricCards = [
    { label: "平均周期", value: avgCycle ? `${avgCycle} 天` : "—", hint: assessment?.averageCycleDays ? "来自最近记录" : config?.avgCycle ? "使用默认配置" : "需 1+ 条记录", highlight: true },
    { label: "平均经期", value: avgDuration ? `${avgDuration} 天` : "—", hint: `黄体期 ${config?.lutealPhase ?? "—"} 天`, highlight: true },
    { label: "下次经期", value: assessment?.predictedNextStart || "—", hint: "基于最近周期推算", highlight: true },
    { label: "排卵日", value: assessment?.predictedOvulationDate || "—", hint: "下次周期 -14 天" },
    { label: "易孕窗", value: (assessment?.predictedFertileStart || "—") + " ~ " + (assessment?.predictedFertileEnd || "—"), hint: "受孕概率最高 6 天" },
    { label: "规律性", value: regularity, hint: prob?.cycleStats?.stdDev != null ? `标准差 ±${prob.cycleStats.stdDev} 天` : "需更多记录" }
  ];
  const metricsPanel = `
    <section class="panel data-panel">
      <div class="section-heading"><div><span class="section-kicker">指标</span><h3>关键指标</h3></div></div>
      <div class="menstrual-metrics">
        ${metricCards.map((m) => `
          <div class="menstrual-metric ${m.highlight ? "menstrual-metric--highlight" : ""}">
            <div class="menstrual-metric__label">${html(m.label)}</div>
            <div class="menstrual-metric__value">${html(m.value)}</div>
            <div class="menstrual-metric__hint">${html(m.hint)}</div>
          </div>`).join("")}
      </div>
    </section>`;

  // ===== 段 3：AI 评估（2 列：摘要+依据 | 睡眠/体重/习惯）=====
  const summaryText = assessment?.summary ? `<div class="menstrual-detail__ai-block"><span>综合摘要</span><p>${html(assessment.summary)}</p></div>` : "";
  const reasonsText = (assessment?.reasons || []).length ? `<div class="menstrual-detail__ai-block"><span>评估依据</span><p>${html((assessment.reasons || []).join("；"))}</p></div>` : "";
  const sleepText = assessment?.sleepAnalysis ? `<div class="menstrual-detail__ai-block"><span>睡眠分析</span><p>${html(assessment.sleepAnalysis)}</p></div>` : "";
  const weightText = assessment?.weightTrend ? `<div class="menstrual-detail__ai-block"><span>体重趋势</span><p>${html(assessment.weightTrend)}</p></div>` : "";
  const habitText = assessment?.habitScore != null ? `<div class="menstrual-detail__ai-block"><span>习惯评分</span><p>${assessment.habitScore} / 4</p></div>` : "";
  const disclaimerText = assessment?.disclaimer ? `<div class="menstrual-detail__ai-block"><span>免责声明</span><p style="color:var(--muted)">${html(assessment.disclaimer)}</p></div>` : "";

  const aiPanel = (summaryText || reasonsText || sleepText || weightText || habitText || disclaimerText) ? `
    <section class="panel data-panel">
      <div class="section-heading"><div><span class="section-kicker">AI 评估</span><h3>健康评估（assessMenstrualRecords）</h3></div></div>
      <div class="menstrual-ai">
        <div class="menstrual-ai__primary">${summaryText}${reasonsText}</div>
        <div class="menstrual-ai__metrics">${sleepText}${weightText}${habitText}${disclaimerText}</div>
      </div>
    </section>` : "";

  // ===== 段 5：月经记录（按年分组可折叠）=====
  const formatDuration = (r: any) => {
    if (!r.startDate) return "—";
    const start = new Date(r.startDate);
    const end = r.endDate ? new Date(r.endDate) : new Date();
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + (r.endDate ? 1 : 0));
    return r.endDate ? `${days} 天` : `进行中 ${days}+ 天`;
  };

  // 按年分组
  const yearGroups: Record<string, any[]> = {};
  for (const r of records) {
    const y = String(r.startDate).slice(0, 4) || "未注明";
    if (!yearGroups[y]) yearGroups[y] = [];
    yearGroups[y].push(r);
  }
  const years = Object.keys(yearGroups).sort().reverse();

  const yearBlocks = years.map((y) => {
    const recs = yearGroups[y];
    // 年度统计
    const totalDays = recs.reduce((acc, r) => {
      if (!r.startDate) return acc;
      const s = new Date(r.startDate);
      const e = r.endDate ? new Date(r.endDate) : new Date();
      return acc + Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + (r.endDate ? 1 : 0));
    }, 0);
    const avgDays = recs.length ? (totalDays / recs.length).toFixed(1) : "—";
    const riskCount = recs.filter((r) => r.riskAssessment?.riskLevel && r.riskAssessment.riskLevel !== "NORMAL").length;
    const isOpen = expandedId && recs.some((r) => expandedId === r.id);
    const rowsHtml = recs.map((r: any, idx: number) => {
      const recsAll = yearGroups[y];
      const idxInAll = records.indexOf(r);
      const prev = records[idxInAll + 1];
      const prevWeight = prev?.weight ?? null;
      const isExpanded = expandedId === r.id;
      const riskLevel = r.riskAssessment?.riskLevel;
      const riskRowClass = riskLevel === "URGENT" ? "risk-row--urgent" : riskLevel === "CARE" ? "risk-row--care" : "";
      const riskBarColor = riskLevel === "URGENT" ? "#ef4444" : riskLevel === "CARE" ? "#f59e0b" : riskLevel === "OBSERVE" ? "#3b82f6" : "transparent";
      const triggerHtml = `<button type="button" class="expand-trigger ${isExpanded ? "is-open" : ""}" data-expand-menstrual="${html(r.id)}">${isExpanded ? "收起详情" : "展开详情"}</button>`;
      const riskPill = riskLevel ? `<span class="pill ${riskLevel === "URGENT" ? "rose" : riskLevel === "CARE" ? "gold" : riskLevel === "OBSERVE" ? "blue" : "gray"}" style="font-size:10px">${html(RISK_LEVEL_LABEL[riskLevel] ?? riskLevel)}</span>` : `<span class="muted" style="font-size:11px">—</span>`;
      const row = `<tr class="${riskRowClass}">
        <td class="date-cell"><span class="risk-bar" style="background:${riskBarColor}"></span>${html(String(r.startDate).slice(0, 10))}</td>
        <td class="date-cell">${html(r.endDate ? String(r.endDate).slice(0, 10) : "—")}</td>
        <td class="duration-cell">${html(formatDuration(r))}</td>
        <td>${html(r.flowLevel ? (FLOW_LEVEL_LABEL[r.flowLevel] ?? r.flowLevel) : "—")}</td>
        <td>${html(r.painLevel ? (PAIN_LABEL[r.painLevel] ?? r.painLevel) : "—")}</td>
        <td>${html(r.discomfort ? (DISCOMFORT_LABEL[r.discomfort] ?? r.discomfort) : "—")}</td>
        <td>${html(r.mood ? (MOOD_LABEL[r.mood] ?? r.mood) : "—")}</td>
        <td>${riskPill}</td>
        <td>${triggerHtml}</td>
      </tr>`;
      const expandRow = isExpanded ? `<tr class="menstrual-expanded-row"><td colspan="9">${renderMenstrualDetailPanel(r, prevWeight)}</td></tr>` : "";
      return row + expandRow;
    }).join("");

    const yearPanel = `
      <div class="menstrual-year-group ${isOpen ? "is-open" : ""}">
        <button type="button" class="menstrual-year-head" data-toggle-menstrual-year="${html(y)}" aria-expanded="${isOpen ? "true" : "false"}">
          <div class="menstrual-year-head__left">
            <div class="menstrual-year-head__year">${html(y)} 年</div>
            <div class="menstrual-year-head__count">${recs.length} 条</div>
          </div>
          <div class="menstrual-year-head__stats">
            <span>平均经期 <b>${avgDays} 天</b></span>
            <span>风险标记 <b style="color:${riskCount > 0 ? "#ef4444" : "var(--muted)"}">${riskCount}</b></span>
          </div>
          <div class="menstrual-year-head__caret">›</div>
        </button>
        <div class="menstrual-year-body">
          <div class="table-wrap" data-skip-row-details>
            <table class="menstrual-records-table">
              <thead><tr><th>开始</th><th>结束</th><th>天数</th><th>流量</th><th>疼痛</th><th>不适</th><th>心情</th><th>风险</th><th>操作</th></tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </div>
      </div>`;
    return yearPanel;
  }).join("");

  const recordsPanel = records.length ? `
    <section class="panel data-panel">
      <div class="section-heading"><div><span class="section-kicker">时间线</span><h3>月经记录</h3></div><span class="section-count">${records.length} 条 / ${years.length} 年</span></div>
      ${yearBlocks}
      <p class="muted" style="margin-top:12px;text-align:center;font-size:11px">医生端为只读视图。点击"展开详情"查看 24 字段完整数据 + AI 风险。数据修改需患者在 App 内操作。</p>
    </section>` : `<section class="panel data-panel"><div class="section-heading"><div><span class="section-kicker">时间线</span><h3>月经记录</h3></div></div><div class="menstrual-empty">暂无月经记录</div></section>`;

  return hero + metricsPanel + aiPanel + recordsPanel;
}

function renderPatientSymptoms(patientId: string) {
  const detail = state.patientDetailCache[patientId];
  const data = detail?.symptoms;
  if (!data) return `<div class="empty-state">该患者暂无症状数据。</div>`;
  const items = data.items || [];
  if (items.length === 0) return `<div class="empty-state">该患者还没有记录症状。</div>`;
  const rows = `<div class="table-wrap"><table><thead><tr><th>日期</th><th>类别</th><th>标签</th><th>严重度</th><th>备注</th></tr></thead><tbody>
    ${items.map((it: any) => `<tr>
      <td>${html(String(it.occurredAt).slice(0, 10))}</td>
      <td><span class="pill gray">${html(SYMPTOM_CATEGORY_LABEL[it.category] ?? it.category)}</span></td>
      <td>${html((it.tags || []).join("、"))}</td>
      <td>${"●".repeat(Math.min(5, Math.max(1, it.severity || 1)))}${"○".repeat(5 - Math.min(5, Math.max(1, it.severity || 1)))}</td>
      <td>${html((it.notes || "").toString().slice(0, 40) || "—")}</td>
    </tr>`).join("")}
  </tbody></table></div>`;
  return `<section class="panel data-panel"><div class="section-heading"><div><span class="section-kicker">共 ${items.length} 条</span><h3>症状时间线</h3></div></div>
    ${rows}
    <p class="muted" style="margin-top:12px;text-align:center;font-size:11px">医生端为只读视图，新症状由患者在 App 内记录。</p>
  </section>`;
}

function renderPatientRecords(patientId: string) {
  const detail = state.patientDetailCache[patientId];
  const data = detail?.notes;
  const records = data?.records || [];
  const currentUserId = state.data?.currentUser?.id;
  const list = records.length
    ? `<div class="table-wrap"><table><thead><tr><th>时间</th><th>作者</th><th>内容</th><th>附件</th><th>操作</th></tr></thead><tbody>
        ${records.map((r: any) => {
          const att = (r.attachments || []) as Array<{ url: string; name: string }>;
          const attHtml = att.length
            ? '<div style="display:flex;gap:6px;flex-wrap:wrap">' + att.map((a) => `<a href="${html(a.url)}" target="_blank" rel="noopener"><img src="${html(a.url)}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;border:1px solid var(--line)" alt="${html(a.name || "附件")}" /></a>`).join("") + "</div>"
            : "—";
          const canDelete = currentUserId && r.authorUserId === currentUserId;
          const delHtml = canDelete ? `<button class="secondary" data-clinic-delete-record="${html(r.id)}" type="button">删除</button>` : "";
          return `<tr>
            <td>${html(new Date(r.createdAt).toLocaleString())}</td>
            <td>${html(r.authorName || (r.authorRole === "PATIENT" ? "患者" : "医生"))} <span class="pill gray" style="font-size:9px">${html(r.authorRole)}</span></td>
            <td>${html((r.content || "").toString().slice(0, 80) || "（仅附件）")}</td>
            <td>${attHtml}</td>
            <td>${delHtml}</td>
          </tr>`;
        }).join("")}
      </tbody></table></div>`
    : `<div class="empty-state">该患者还没有档案记录。</div>`;
  const form = `<section class="panel action-panel" style="margin-bottom:16px">
    <div class="section-kicker">新增档案</div>
    <h3>为患者补充健康记录</h3>
    <p class="muted">文字 + 图片（最多 3 张）。可填写问诊摘要、检查报告解读、随访建议等。</p>
    <form id="clinicRecordForm" class="form" data-clinic-record-form>
      <textarea name="content" placeholder="例如：3 月 15 日复查，阴道超声未见明显异常，建议 3 个月后随访..." maxlength="2000" style="min-height:80px"></textarea>
      <input name="attachments" type="file" accept="image/*" multiple data-clinic-record-attach />
      <div data-clinic-record-preview style="display:flex;flex-wrap:wrap;gap:8px"></div>
      <button type="submit">保存档案</button>
    </form>
  </section>`;
  return form + `<section class="panel data-panel"><div class="section-heading"><div><span class="section-kicker">共 ${records.length} 条</span><h3>共享档案</h3></div></div>${list}</section>`;
}

function renderPatientAiChat(patientId: string) {
  const detail = state.patientDetailCache[patientId];
  const data = detail?.aiChat;
  if (!data) return `<div class="empty-state">该患者暂无 AI 对话记录。</div>`;
  const messages = data.messages || [];
  if (messages.length === 0) {
    return `<div class="empty-state">该患者还没有和 AI 顾问对话过。${data.date ? "" : "系统每天首次打开时会注入一条每日分析。"}</div>`;
  }

  // 按天分组
  const groups: Record<string, Array<{ role: string; content: string; createdAt?: string }>> = {};
  for (const m of messages) {
    const day = m.createdAt ? String(m.createdAt).slice(0, 10) : "未注明时间";
    if (!groups[day]) groups[day] = [];
    groups[day].push(m);
  }
  const days = Object.keys(groups).sort().reverse();

  const roleLabel = (role: string) => role === "user" ? "患者" : role === "assistant" ? "AI 顾问" : role;

  const timeline = days.map((day) => {
    const dayMsgs = groups[day];
    const bubbles = dayMsgs.map((m) => {
      const isUser = m.role === "user";
      const time = m.createdAt ? new Date(m.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "";
      return `<div class="ai-chat-bubble ${isUser ? "ai-chat-bubble--user" : "ai-chat-bubble--assistant"}">
        <div class="ai-chat-bubble__role">${html(roleLabel(m.role))} · ${html(time)}</div>
        <div class="ai-chat-bubble__text">${html(m.content || "")}</div>
      </div>`;
    }).join("");
    return `<div class="ai-chat-day">
      <div class="ai-chat-day__label">${html(day)}（${dayMsgs.length} 条）</div>
      <div class="ai-chat-day__bubbles">${bubbles}</div>
    </div>`;
  }).join("");

  // 用户/AI 数量统计
  const userCount = messages.filter((m) => m.role === "user").length;
  const aiCount = messages.filter((m) => m.role === "assistant").length;
  const dateRange = messages[0]?.createdAt ? `${String(messages[messages.length - 1].createdAt).slice(0, 10)} ~ ${String(messages[0].createdAt).slice(0, 10)}` : "未注明";

  return `
    <section class="panel data-panel">
      <div class="section-heading">
        <div>
          <span class="section-kicker">对话概览</span>
          <h3>${userCount} 条患者提问 / ${aiCount} 条 AI 回复</h3>
        </div>
        <span class="section-count">时间范围 ${html(dateRange)}</span>
      </div>
      <p class="muted" style="font-size:11px;margin-bottom:14px">医生只读视角：内容由患者在 App 内和 AI 顾问对话时产生，存储在 PeriodState.chatMessages。</p>
    </section>
    ${timeline}
  `;
}

function renderPatientPlans(patientId: string) {
  const detail = state.patientDetailCache[patientId];
  const plan = detail?.plans?.[0];
  if (!plan) {
    return `<section class="panel data-panel"><div class="empty-state">该患者暂无治疗方案。生成新方案后，这里只保留并展示最新版本。</div></section>`;
  }

  const draft = plan.draft ?? {};
  const updatedAt = String(plan.updatedAt ?? "").slice(0, 16).replace("T", " ");
  const source = draft.sourceDiagnostics ?? {};
  const planOptions = Array.isArray(draft.planOptions) ? draft.planOptions : [];
  const primaryOption = planOptions[0] ?? {};
  const references = Array.isArray(plan.knowledgeRefs) ? plan.knowledgeRefs : [];
  const productCandidates = Array.isArray(source.productCandidates) ? source.productCandidates : [];

  return `
    <section class="panel data-panel">
      <div class="section-heading">
        <div>
          <span class="section-kicker">最新版本</span>
          <h3>${html(draft.summary ?? primaryOption.title ?? "治疗方案草稿")}</h3>
        </div>
        <div class="cervical-review-actions">
          <button type="button" class="secondary" data-cervical-plan-word="${html(plan.id)}">导出 Word 文档</button>
        </div>
      </div>
      <div class="cervical-result-grid">
        <div><h4>更新时间</h4><p>${html(updatedAt || "未记录")}</p></div>
        <div><h4>方案状态</h4><p>${html(plan.status ?? "DRAFT")}</p></div>
        <div><h4>知识片段</h4><p>${references.length} 条</p></div>
        <div><h4>候选产品</h4><p>${html(productCandidates.join("、") || "清愫美宫颈治疗托")}</p></div>
      </div>
      ${primaryOption.summary ? `<div class="cervical-alert"><strong>方案说明</strong><p>${html(primaryOption.summary)}</p></div>` : ""}
      ${planOptions.length ? `<div class="cervical-recommendations"><h4>方案路径</h4>${planOptions.slice(0, 3).map((item: any, index: number) => `<article><span>${index + 1}</span><div><strong>${html(item.title ?? `方案 ${index + 1}`)}</strong><p>${html(item.summary ?? item.suitableFor ?? "")}</p></div></article>`).join("")}</div>` : ""}
      ${draft.doctorReviewNote ? `<div class="cervical-alert"><strong>医生确认</strong><p>${html(draft.doctorReviewNote)}</p></div>` : ""}
    </section>
  `;
}

function bindCrmRowNavigation() {
  document.querySelectorAll<HTMLTableRowElement>("#crmTable tbody tr[data-patient-id]").forEach((row) => {
    row.onclick = (event) => {
      if ((event.target as HTMLElement).closest("button, a, input, select, textarea, label")) return;
      const patientId = row.dataset.patientId;
      if (!patientId) return;
      activateClinicWorkspaceTab("patient:" + patientId, patientId);
    };
  });
}

function bindPatientDetailHandlers() {
  // sub-tab 切换
  document.querySelectorAll<HTMLButtonElement>("[data-patient-detail-tab]").forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      const sub = btn.dataset.patientDetailTab as "menstrual" | "symptom" | "records" | "aiChat" | "plans" | undefined;
      if (!sub) return;
      const m = state.active.match(/^patient:(.+)$/);
      if (!m) return;
      const patientId = m[1];
      if (!state.patientDetailCache[patientId]) {
        state.patientDetailCache[patientId] = { activeSubTab: sub, loading: true };
      } else {
        state.patientDetailCache[patientId].activeSubTab = sub;
      }
      renderApp();
    };
  });
  // breadcrumb 返回 CRM
  document.querySelectorAll<HTMLAnchorElement>(".breadcrumb a[data-tab='crm']").forEach((a) => {
    a.onclick = (e) => {
      e.preventDefault();
      activateClinicWorkspaceTab("crm");
    };
  });
  // 上传预览
  document.querySelectorAll<HTMLInputElement>("[data-clinic-record-attach]").forEach((input) => {
    input.onchange = () => {
      const formEl = input.closest("form");
      const previewEl = formEl?.querySelector("[data-clinic-record-preview]") as HTMLElement | null;
      if (!previewEl) return;
      previewEl.innerHTML = "";
      const files = Array.from(input.files || []).slice(0, 3);
      files.forEach((f) => {
        const url = URL.createObjectURL(f);
        const img = document.createElement("img");
        img.src = url;
        img.style.cssText = "width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid var(--line)";
        img.onload = () => URL.revokeObjectURL(url);
        previewEl.appendChild(img);
      });
    };
  });
  // 提交档案
  const recordForm = document.querySelector<HTMLFormElement>("[data-clinic-record-form]");
  if (recordForm) {
    recordForm.onsubmit = async (e) => {
      e.preventDefault();
      const m = state.active.match(/^patient:(.+)$/);
      if (!m) return;
      const patientId = m[1];
      const content = (recordForm.querySelector("[name=content]") as HTMLTextAreaElement | null)?.value?.trim() ?? "";
      const fileInput = recordForm.querySelector("[name=attachments]") as HTMLInputElement | null;
      const files = fileInput?.files ? Array.from(fileInput.files).slice(0, 3) : [];
      if (!content && files.length === 0) {
        showToast("请填写文字或上传图片", "warn");
        return;
      }
      const submitBtn = recordForm.querySelector("button[type=submit]") as HTMLButtonElement | null;
      if (submitBtn) submitBtn.disabled = true;
      try {
        const attachments: Array<{ url: string; name: string; type: string; size: number }> = [];
        for (const f of files) {
          const up = await uploadFile(f);
          attachments.push(up);
        }
        await api(`/api/clinic/patients/${patientId}/records`, { method: "POST", bodyJson: { content, attachments } });
        (recordForm.querySelector("[name=content]") as HTMLTextAreaElement).value = "";
        if (fileInput) fileInput.value = "";
        const preview = recordForm.querySelector("[data-clinic-record-preview]");
        if (preview) preview.innerHTML = "";
        showToast("档案已保存", "success");
        await loadPatientDetail(patientId);
      } catch (e: any) {
        showToast("保存失败：" + (e?.message || "未知错误"), "error");
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    };
  }
  // 删除自己写的记录
  document.querySelectorAll<HTMLButtonElement>("[data-clinic-delete-record]").forEach((btn) => {
    btn.onclick = async (e) => {
      e.preventDefault();
      const m = state.active.match(/^patient:(.+)$/);
      if (!m) return;
      const patientId = m[1];
      const recordId = btn.dataset.clinicDeleteRecord;
      if (!recordId) return;
      if (!confirm("确认删除这条档案？")) return;
      try {
        await api(`/api/clinic/patients/${patientId}/records/${recordId}`, { method: "DELETE" });
        showToast("已删除", "success");
        await loadPatientDetail(patientId);
      } catch (e: any) {
        showToast("删除失败：" + (e?.message || "未知错误"), "error");
      }
    };
  });
  // 月经记录行展开 / 收起（inline，显示 5 大块完整详情）
  document.querySelectorAll<HTMLButtonElement>("[data-expand-menstrual]").forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const recordId = btn.dataset.expandMenstrual;
      if (!recordId) return;
      const m = state.active.match(/^patient:(.+)$/);
      if (!m) return;
      const patientId = m[1];
      const cache = state.patientDetailCache[patientId];
      if (!cache) return;
      cache.expandedRecordId = cache.expandedRecordId === recordId ? null : recordId;
      renderApp();
    };
  });
  // 年份分组折叠 / 展开
  document.querySelectorAll<HTMLButtonElement>("[data-toggle-menstrual-year]").forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      const groupId = btn.dataset.toggleMenstrualYear;
      if (!groupId) return;
      const group = btn.closest(".menstrual-year-group");
      if (!group) return;
      group.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", group.classList.contains("is-open") ? "true" : "false");
    };
  });
}

function renderFollow(data: Dashboard) {
  return `
    <header class="page-header">
      <div class="page-header__main">
        <nav class="breadcrumb"><span class="breadcrumb__current">随访</span></nav>
        <h2 class="page-title">随访</h2>
        <p class="page-sub">为购药后的患者排程到店 / 电话 / 短信随访，并标记完成情况。</p>
      </div>
    </header>
    <section class="clinic-workspace-split">
    <section class="panel action-panel">
      <div class="section-kicker">创建任务</div>
      <h3>手动排程随访</h3>
      <p class="muted">选择患者、时间和触达渠道，安排下一次关怀。</p>
      <form id="followScheduleForm" class="form">
        <select name="patientId">${data.patients.map((item) => `<option value="${html(item.id)}">${html(item.name)} · ${html(item.phone ?? "")}</option>`).join("")}</select>
        <input name="title" placeholder="随访主题" value="复查关怀随访" />
        <input name="dueDate" type="date" value="2026-06-10" />
        <select name="channel"><option value="PHONE">${CHANNEL_LABELS.PHONE}</option><option value="IN_APP">${CHANNEL_LABELS.IN_APP}</option><option value="SMS">${CHANNEL_LABELS.SMS}</option></select>
        <button type="submit">创建随访</button>
      </form>
    </section>
    </section>
    <section class="panel data-panel">
      <div class="section-heading"><div><span class="section-kicker">执行队列</span><h3>随访任务</h3></div><span class="section-count">${data.followUps.length} 项</span></div>
      <div class="table-wrap"><table><thead><tr><th>患者</th><th>任务</th><th>状态</th><th>动作</th></tr></thead><tbody>
        ${data.followUps.map((item) => {
          const patientCell = item.patientName
            ? `<strong>${html(item.patientName)}</strong><div class="muted">${html(item.patientPhone ?? "")}</div>`
            : `<span class="muted">—</span>`;
          return `<tr><td>${patientCell}</td><td>${html(item.title)}</td><td>${html(labelOf(FOLLOW_STATUS_LABELS, item.status))}</td><td><button data-follow="${html(item.id)}" ${item.status === "DONE" ? "disabled" : ""}>完成随访</button></td></tr>`;
        }).join("")}
      </tbody></table></div>
    </section>
    </section>`;
}

function renderKnowledgeSearch(data: Dashboard) {
  const answer = state.knowledgeSearchAnswer;
  const citations = Array.isArray(answer?.citations) ? answer.citations : [];
  const context = state.knowledgeSearchContext;
  const view = state.knowledgeSearchView ?? "input";
  const list = (items: unknown[]) => (items ?? []).map((item) => `<li>${html(String(item))}</li>`).join("");
  const viewButton = (key: string, label: string, disabled = false) =>
    `<button type="button" data-knowledge-view="${key}" class="${view === key ? "is-active" : ""}" ${disabled ? "disabled" : ""}>${label}</button>`;
  const confidenceLabel = answer?.confidence === "HIGH" ? "高" : answer?.confidence === "MEDIUM" ? "中" : "低";
  const statusLabel = (status: string) => status === "SUPPORTED" ? "证据支持" : status === "PARTIALLY_SUPPORTED" ? "部分支持" : "待核验";
  return `
    <header class="page-header"><div class="page-header__main">
      <nav class="breadcrumb"><span class="breadcrumb__current">临床支持</span></nav>
      <h2 class="page-title">患者治疗方案</h2>
      <p class="page-sub">医生只需选择患者并补充当前上下文，系统使用固定治疗方案任务生成完整治疗体系。</p>
    </div></header>
    <nav class="knowledge-workflow-nav" aria-label="知识查询工作流">
      ${viewButton("input", "1. 患者与材料")}
      ${viewButton("overview", "2. 方案总览", !answer)}
      ${viewButton("path", "3. 完整治疗体系", !answer)}
      ${viewButton("evidence", "4. 依据核验", !answer)}
    </nav>
    ${context ? `<div class="knowledge-context-strip"><strong>${html(context.patientName)}</strong><span>病历 ${context.recordCount}</span><span>症状 ${context.symptomCount}</span><span>月经记录 ${context.menstrualCount}</span><span>疗程 ${context.treatmentCount}</span><span>附件 ${context.attachmentCount ?? 0}</span></div>` : ""}
    <section class="knowledge-workflow-stage">
      ${view === "input" ? `<form id="clinicKnowledgeSearchForm" class="panel knowledge-query-form knowledge-query-form--focused">
        <div class="section-heading"><div><span class="section-kicker">患者上下文</span><h3>选择患者并补充当前情况</h3></div><span class="pill">固定治疗方案任务</span></div>
        <label>关联患者（可选）<select name="patientId"><option value="">不关联患者，直接生成方案</option>${data.patients.map((patient) => `<option value="${html(patient.id)}">${html(patient.name)} · ${html(patient.phone ?? "")}</option>`).join("")}</select></label>
        <label>当前状态补充（可选）<textarea name="query" rows="5" placeholder="例如：近期复查 HPV16 持续阳性，TCT 为 ASC-US；患者有生育需求。无需填写问题，系统会自动生成完整治疗体系。"></textarea></label>
        <label class="cervical-upload">上传宫颈图片<input type="file" name="images" accept="image/png,image/jpeg,image/webp" multiple /><small>支持 JPG / PNG / WebP，最多 3 张，每张不超过 10MB。</small></label>
        <label class="cervical-upload">上传 PDF 报告单<input type="file" name="reports" accept="application/pdf,.pdf" multiple /><small>最多 3 份，每份不超过 30MB；文本型 PDF 自动提取，扫描版需人工核对。</small></label>
        <label>证据召回范围<select name="topK"><option value="10">10 条</option><option value="20" selected>20 条</option><option value="30">30 条</option></select></label>
        <button type="submit" ${state.knowledgeSearchLoading ? "disabled" : ""}>${state.knowledgeSearchLoading ? "正在读取记录并整理方案..." : "生成有依据的临床参考方案"}</button>
      </form>` : ""}
      ${view === "overview" ? `<section class="panel knowledge-query-results">
        <div class="section-heading"><div><span class="section-kicker">临床参考方案</span><h3>${html(answer?.summary ?? "等待生成方案")}</h3></div>${answer ? `<span class="pill">${html(answer.confidence ?? "LOW")} 置信度</span>` : ""}</div>
        <div class="knowledge-quality-row"><div><strong>${confidenceLabel}</strong><span>综合置信度</span></div><div><strong>${Math.round(Number(answer?.quality?.citationCoverage ?? 0) * 100)}%</strong><span>引用覆盖</span></div><div><strong>${Math.round(Number(answer?.quality?.supportedRecommendationRate ?? 0) * 100)}%</strong><span>建议支持率</span></div><div><strong>${answer?.quality?.knowledgeBaseCount ?? 0}</strong><span>覆盖知识库</span></div></div>
        <div class="cervical-alert"><strong>安全提示</strong><p>${html(answer?.safetyNotice ?? "")}</p></div>
        <div class="cervical-result-grid"><div><h4>临床评估</h4><ul>${list(answer?.assessment)}</ul></div><div><h4>信息缺口</h4><ul>${list(answer?.missingInformation)}</ul></div><div><h4>风险提示</h4><ul>${list(answer?.redFlags)}</ul></div><div><h4>复查计划</h4><ul>${list(answer?.followUpPlan)}</ul></div></div>
      </section>` : ""}
      ${view === "path" ? `<section class="panel knowledge-query-results"><div class="section-heading"><div><span class="section-kicker">完整治疗体系</span><h3>围绕患者当前状态的连续治疗与干预路径</h3></div><span class="pill">${Math.round(Number(answer?.quality?.completenessRate ?? 0) * 100)}% 完整度</span></div>
        <div class="treatment-system-section"><h4>当前状态</h4><ul>${list(answer?.treatmentSystem?.currentState)}</ul></div>
        <div class="treatment-goals">${(answer?.treatmentSystem?.treatmentGoals ?? []).map((item: any) => `<article><span>${html(item.horizon)}</span><div><strong>${html(item.goal)}</strong><p>达成标准：${html(item.successCriteria)}</p><small>${html((item.citations ?? []).map((n: number) => `[来源:${n}]`).join(" ") || "医生待确认")}</small></div></article>`).join("")}</div>
        <div class="treatment-system-section"><h4>分阶段治疗路径</h4><div class="treatment-phases">${(answer?.treatmentSystem?.phases ?? []).map((item: any, index: number) => `<article><span>${index + 1}</span><div><strong>${html(item.name)}</strong><p>${html(item.objective)} · ${html(item.duration)}</p><h5>执行动作</h5><ul>${list(item.actions)}</ul><h5>阶段完成标准</h5><ul>${list(item.completionCriteria)}</ul><small>${html((item.citations ?? []).map((n: number) => `[来源:${n}]`).join(" ") || "医生待确认")}</small></div></article>`).join("")}</div></div>
        <div class="treatment-system-section"><h4>综合干预手段</h4><div class="intervention-table"><div class="intervention-row intervention-head"><span>类型</span><span>干预动作</span><span>频率/周期</span><span>注意事项</span></div>${(answer?.treatmentSystem?.interventions ?? []).map((item: any) => `<div class="intervention-row"><span>${html(item.category)}</span><span>${html(item.action)}</span><span>${html(item.frequency)}</span><span>${html((item.precautions ?? []).join("；"))}</span></div>`).join("")}</div></div>
        <div class="treatment-system-grid"><div><h4>监测与复查</h4>${(answer?.treatmentSystem?.monitoringPlan ?? []).map((item: any) => `<article><strong>${html(item.item)}</strong><p>${html(item.timing)} · 目标：${html(item.target)}</p><small>异常时：${html(item.actionIfAbnormal)}</small></article>`).join("")}</div><div><h4>调整条件</h4>${(answer?.treatmentSystem?.adjustmentRules ?? []).map((item: any) => `<article><strong>${html(item.trigger)}</strong><p>${html(item.adjustment)}</p></article>`).join("")}</div><div><h4>患者教育</h4><ul>${list(answer?.treatmentSystem?.patientEducation)}</ul></div></div>
        <div class="cervical-recommendations"><h4>医生审核重点</h4>
        <div class="cervical-recommendations">${(answer?.treatmentRecommendations ?? []).map((item: any) => `<article class="evidence-${html(String(item.evidenceStatus ?? "UNSUPPORTED").toLowerCase())}"><span>${html(item.priority ?? "NORMAL")}</span><div><div class="recommendation-title-row"><strong>${html(item.title)}</strong><em>${statusLabel(item.evidenceStatus)}</em></div><p>${html(item.detail)}</p><small>引用：${html((item.citations ?? []).map((n: number) => `[来源:${n}]`).join(" ") || "无，需人工核验")}</small></div></article>`).join("")}</div>
        </div>
      </section>` : ""}
      ${view === "evidence" ? `<section class="panel knowledge-query-results"><div class="section-heading"><div><span class="section-kicker">依据核验</span><h3>知识来源与原文摘录</h3></div><span class="pill">${citations.length} 条引用</span></div>
        <div class="knowledge-query-list">${citations.map((item: any) => `<article><span class="knowledge-query-rank">${item.index}</span><div><div class="knowledge-query-title"><strong>${html(item.title)}</strong><span>${html(item.knowledgeBaseName)}</span></div><small>综合 ${Math.round(Number(item.score ?? 0) * 100)}% · v${html(item.version)}</small><p>${html(item.excerpt)}</p></div></article>`).join("")}</div>
      </section>` : ""}
    </section>`;
}

function renderCervicalPlanOptionCards(options: any[], _list: (items: unknown[]) => string) {
  return options.map((option: any, index: number) => `
    <article class="doctor-plan-paper">
      <header class="doctor-plan-paper__head">
        <span>方案 ${index + 1}</span>
        <h3>${html(option.title ?? `治疗方案 ${index + 1}`)}</h3>
        ${option.suitableFor ? `<p>${html(option.suitableFor)}</p>` : ""}
      </header>
      ${option.summary ? `<section class="doctor-plan-paper__intro"><h4>这套方案怎么讲</h4><p>${html(option.summary)}</p></section>` : ""}
      ${(option.treatmentRecommendations ?? []).length ? `<section class="doctor-plan-paper__body">
        <h4>医生直接照这个思路执行</h4>
        ${(option.treatmentRecommendations ?? []).map((item: any) => `<p><strong>${html(item.title ?? "")}</strong>：${html(item.detail ?? "")}</p>`).join("")}
      </section>` : ""}
      ${(option.stagePlan ?? []).length ? `<section class="doctor-plan-paper__body">
        <h4>前中后期怎么安排</h4>
        ${(option.stagePlan ?? []).map((stage: any) => `
          <div class="doctor-plan-step">
            <h5>${html(stage.phase ?? "")}</h5>
            ${stage.objective ? `<p>${html(stage.objective)}</p>` : ""}
            ${[...(stage.actions ?? []), ...(stage.interventionSupport ?? []), ...(stage.medicationPairings ?? []), ...(stage.reviewFocus ?? [])]
              .filter(Boolean)
              .map((item: unknown) => `<p>${html(String(item))}</p>`)
              .join("")}
          </div>
        `).join("")}
      </section>` : ""}
      ${(option.medicationPairings ?? []).length || (option.interventionSummary ?? []).length ? `<section class="doctor-plan-paper__body">
        <h4>搭配用药和干预怎么配合</h4>
        ${(option.medicationPairings ?? []).map((item: unknown) => `<p>${html(String(item))}</p>`).join("")}
        ${(option.interventionSummary ?? []).map((item: unknown) => `<p>${html(String(item))}</p>`).join("")}
      </section>` : ""}
      ${(option.followUpPlan ?? []).length ? `<section class="doctor-plan-paper__body">
        <h4>复查和调整</h4>
        ${(option.followUpPlan ?? []).map((item: unknown) => `<p>${html(String(item))}</p>`).join("")}
      </section>` : ""}
      ${(option.patientEducation ?? []).length ? `<section class="doctor-plan-paper__body">
        <h4>医生给患者怎么说</h4>
        ${(option.patientEducation ?? []).map((item: unknown) => `<p>${html(String(item))}</p>`).join("")}
      </section>` : ""}
      ${(option.cautions ?? []).length ? `<section class="doctor-plan-paper__body doctor-plan-paper__body--warning">
        <h4>注意事项</h4>
        ${(option.cautions ?? []).map((item: unknown) => `<p>${html(String(item))}</p>`).join("")}
      </section>` : ""}
      ${option.doctorReviewNote ? `<section class="doctor-plan-paper__body doctor-plan-paper__body--review"><h4>医生最后确认</h4><p>${html(option.doctorReviewNote)}</p></section>` : ""}
    </article>
  `).join("");
}

function renderKnowledgeSearchV2(data: Dashboard) {
  const draftPlan = state.cervicalPlanDraft;
  const answer = draftPlan?.draft;
  const refs = Array.isArray(draftPlan?.knowledgeRefs) ? draftPlan.knowledgeRefs : [];
  const context = state.knowledgeSearchContext;
  const view = state.knowledgeSearchView ?? "input";
  const selectedPatientId = state.knowledgeSearchSelectedPatientId ?? "";
  const historyFiles = knowledgeSearchHistoryFiles();
  const historyLoading = Boolean(state.knowledgeSearchHistoryLoading);
  const selectedHistoryUrls = knowledgeSearchSelectedHistoryUrls();
  const localAttachments = knowledgeSearchLocalAttachments();
  const attachments = mergedKnowledgeSearchAttachments();
  const list = (items: unknown[]) => (items ?? []).map((item) => `<li>${html(String(item))}</li>`).join("");
  const formatFileSize = (size?: number) => size ? `${Math.max(1, Math.round(size / 1024))} KB` : "-";
  const fileTypeLabel = (type?: string) => !type ? "文件" : type.startsWith("image/") ? "图片" : type === "application/pdf" ? "PDF 报告" : type;
  const authorRoleLabel = (role?: string) => role === "PATIENT" ? "患者记录" : "医生记录";
  const viewButton = (key: string, label: string, disabled = false) =>
    `<button type="button" data-knowledge-view="${key}" class="${view === key ? "is-active" : ""}" ${disabled ? "disabled" : ""}>${label}</button>`;
  const optionCards = renderCervicalPlanOptionCards(answer?.planOptions ?? [], list); /*
    <article class="plan-option-card">
      <div class="plan-option-card__head">
        <div>
          <strong>${html(option.title ?? `方案 ${index + 1}`)}</strong>
          <p>${html(option.suitableFor ?? "")}</p>
        </div>
        <span class="pill">方案 ${index + 1}</span>
      </div>
      <p class="plan-option-card__summary">${html(option.summary ?? "")}</p>
      <div class="plan-option-card__section">
        <h4>核心建议</h4>
        <div class="cervical-recommendations">${(option.treatmentRecommendations ?? []).map((item: any) => `<article><span>${html(item.priority ?? "NORMAL")}</span><div><strong>${html(item.title)}</strong><p>${html(item.detail)}</p></div></article>`).join("")}</div>
      </div>
      <div class="plan-option-card__grid">
        <div><h4>复查随访</h4><ul>${list(option.followUpPlan)}</ul></div>
        <div><h4>患者沟通</h4><ul>${list(option.patientEducation)}</ul></div>
        <div><h4>注意事项</h4><ul>${list(option.cautions)}</ul></div>
      </div>
      ${option.doctorReviewNote ? `<div class="cervical-alert"><strong>医生审阅提示</strong><p>${html(option.doctorReviewNote)}</p></div>` : ""}
    </article>
  `).join(""); */

  return `
    <header class="page-header"><div class="page-header__main">
      <nav class="breadcrumb"><span class="breadcrumb__current">临床支持</span></nav>
      <h2 class="page-title">患者治疗方案</h2>
      <p class="page-sub">支持本地上传图片和报告单，也支持直接勾选医生与患者历史文件，生成 1-3 套可审核治疗方案。</p>
    </div></header>
    <nav class="knowledge-workflow-nav" aria-label="治疗方案工作流">
      ${viewButton("input", "1. 患者与资料").replace(/data-knowledge-view=/g, "data-knowledge-view-v2=")}
      ${viewButton("overview", "2. 方案总览", !answer).replace(/data-knowledge-view=/g, "data-knowledge-view-v2=")}
      ${viewButton("path", "3. 方案选项", !answer).replace(/data-knowledge-view=/g, "data-knowledge-view-v2=")}
      ${viewButton("evidence", "4. 知识依据", !answer).replace(/data-knowledge-view=/g, "data-knowledge-view-v2=")}
    </nav>
    ${context ? `<div class="knowledge-context-strip"><strong>${html(context.patientName ?? "")}</strong><span>病历 ${context.recordCount ?? 0}</span><span>症状 ${context.symptomCount ?? 0}</span><span>月经记录 ${context.menstrualCount ?? 0}</span><span>疗程 ${context.treatmentCount ?? 0}</span><span>已选附件 ${context.attachmentCount ?? attachments.length}</span></div>` : ""}
    <section class="knowledge-workflow-stage">
      ${view === "input" ? `<form id="clinicKnowledgeSearchFormV2" class="panel knowledge-query-form knowledge-query-form--focused">
        <div class="section-heading"><div><span class="section-kicker">患者上下文</span><h3>选择患者并补充当前情况</h3></div><span class="pill">固定治疗方案任务</span></div>
          <label>关联患者（可选）
            <select name="patientId" id="knowledgeSearchPatientSelect">
              <option value="">不关联患者，直接生成方案</option>
            ${data.patients.map((patient) => `<option value="${html(patient.id)}" ${patient.id === selectedPatientId ? "selected" : ""}>${html(patient.name)} · ${html(patient.phone ?? "")}</option>`).join("")}
          </select>
        </label>
        <label>当前状态补充（可选）
          <textarea name="query" id="knowledgeSearchQueryInput" rows="5" placeholder="例如：近期复查 HPV16 持续阳性，患者有生育需求，希望兼顾安全性与保守处理。">${html(state.knowledgeSearchQueryText ?? "")}</textarea>
        </label>
        <section class="knowledge-source-card">
          <div class="knowledge-source-card__head"><div><span class="section-kicker">本地上传</span><h3>保留本地选择文件</h3></div><span class="pill">${attachments.length}/6</span></div>
          <div class="knowledge-upload-actions">
            <label class="secondary knowledge-upload-trigger">本地图片<input type="file" id="knowledgeLocalImages" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden /></label>
            <label class="secondary knowledge-upload-trigger">本地报告单<input type="file" id="knowledgeLocalReports" accept="application/pdf,.pdf" multiple hidden /></label>
          </div>
          ${localAttachments.length ? `<div class="knowledge-file-list">${localAttachments.map((item) => `<article class="knowledge-file-chip"><div><strong>${html(item.name)}</strong><small>本地上传 · ${html(fileTypeLabel(item.type))} · ${formatFileSize(item.size)}</small></div><button type="button" class="secondary" data-remove-knowledge-local="${html(item.url)}">移除</button></article>`).join("")}</div>` : `<div class="empty-state empty-state--inline"><div class="empty-state__sub">可继续从本地上传图片或 PDF 报告单。</div></div>`}
        </section>
        <section class="knowledge-source-card">
          <div class="knowledge-source-card__head"><div><span class="section-kicker">历史资料</span><h3>直接选择医生与患者历史文件</h3></div><span class="pill">${selectedHistoryUrls.length} 已选</span></div>
          ${!selectedPatientId ? `<div class="empty-state empty-state--inline"><div class="empty-state__sub">先选择患者，再读取历史图片和报告单。</div></div>` : historyLoading ? `<div class="empty-state empty-state--inline"><div class="empty-state__sub">正在读取历史文件...</div></div>` : historyFiles.length ? `<div class="knowledge-history-list">${historyFiles.map((item) => `<label class="knowledge-history-item ${selectedHistoryUrls.includes(item.url) ? "is-active" : ""}"><input type="checkbox" data-knowledge-history-url="${html(item.url)}" ${selectedHistoryUrls.includes(item.url) ? "checked" : ""} /><div><div class="knowledge-history-item__title"><strong>${html(item.name)}</strong><span>${html(authorRoleLabel(item.authorRole))}</span></div><small>${html(fileTypeLabel(item.type))} · ${html(item.authorName ?? "未知记录人")} · ${html(String(item.createdAt ?? "").slice(0, 10) || "未知时间")} · ${formatFileSize(item.size)}</small>${item.content ? `<p>${html(item.content)}</p>` : ""}</div></label>`).join("")}</div>` : `<div class="empty-state empty-state--inline"><div class="empty-state__sub">该患者暂无可直接选择的历史图片或 PDF 报告。</div></div>`}
        </section>
        <button type="submit" ${state.knowledgeSearchLoading ? "disabled" : ""}>${state.knowledgeSearchLoading ? "正在整理资料并生成 1-3 套方案..." : "生成 1-3 套治疗方案"}</button>
      </form>` : ""}
        ${view === "overview" ? `<section class="panel knowledge-query-results">
          <div class="section-heading"><div><span class="section-kicker">方案总览</span><h3>${html(answer?.summary ?? "等待生成方案")}</h3></div><span class="pill">${(answer?.planOptions ?? []).length} 套方案</span></div>
          ${draftPlan?.id ? `<div class="cervical-review-actions"><button type="button" class="secondary" data-cervical-plan-word="${html(draftPlan.id)}">导出 Word 文档</button></div>` : ""}
          <div class="cervical-alert"><strong>医生审阅提示</strong><p>${html(answer?.doctorReviewNote ?? "请结合原始报告、病史和面诊结果确认最终方案。")}</p></div>
        ${answer?.sourceDiagnostics ? `<div class="cervical-alert cervical-alert--source"><strong>资料读取情况</strong><p>PDF 已读取 ${html(String(answer.sourceDiagnostics.extractedPdfCount ?? 0))} 份，提取 ${html(String(answer.sourceDiagnostics.extractedPdfChars ?? 0))} 字；本次进入生成的知识片段 ${html(String(answer.sourceDiagnostics.knowledgeRefCount ?? 0))} 条，其中产品专项检索 ${html(String(answer.sourceDiagnostics.productFocusedCount ?? 0))} 条。</p>${(answer.sourceDiagnostics.productCandidates ?? []).length ? `<p>候选产品：${html((answer.sourceDiagnostics.productCandidates ?? []).join("、"))}</p>` : ""}${(answer.sourceDiagnostics.attachments ?? []).map((item: any) => `<p>${html(item.name ?? "附件")}：${html(item.status ?? "")}${item.extractedChars ? `，提取 ${html(String(item.extractedChars))} 字` : ""}${item.reason ? `，${html(item.reason)}` : ""}</p>`).join("")}</div>` : ""}
        <div class="cervical-result-grid"><div><h4>临床评估</h4><ul>${list(answer?.assessment)}</ul></div><div><h4>待补充信息</h4><ul>${list(answer?.missingInformation)}</ul></div><div><h4>红旗风险</h4><ul>${list(answer?.redFlags)}</ul></div><div><h4>默认随访</h4><ul>${list(answer?.followUpPlan)}</ul></div></div>
      </section>` : ""}
      ${view === "path" ? `<section class="panel knowledge-query-results">
        <div class="section-heading"><div><span class="section-kicker">方案选项</span><h3>为不同患者诉求提供 1-3 套可比较路径</h3></div><span class="pill">${(answer?.planOptions ?? []).length} 套方案</span></div>
        <div class="plan-option-list">${optionCards || `<div class="empty-state"><div class="empty-state__title">暂无方案选项</div></div>`}</div>
      </section>` : ""}
      ${view === "evidence" ? `<section class="panel knowledge-query-results"><div class="section-heading"><div><span class="section-kicker">知识依据</span><h3>生成本次方案时引用的知识资料</h3></div><span class="pill">${refs.length} 条依据</span></div>
        <div class="knowledge-query-list">${refs.map((item: any, index: number) => `<article><span class="knowledge-query-rank">${index + 1}</span><div><div class="knowledge-query-title"><strong>${html(item.title)}</strong><span>v${html(item.version)}</span></div><p>${html(item.excerpt ?? "")}</p></div></article>`).join("") || `<div class="empty-state"><div class="empty-state__sub">暂无知识依据记录。</div></div>`}</div>
      </section>` : ""}
    </section>`;
}

function renderMedicalQaV2(data: Dashboard) {
  const qa = state.medicalQaAnswer;
  return `
    <header class="page-header"><div class="page-header__main">
      <nav class="breadcrumb"><span class="breadcrumb__current">临床支持</span></nav>
      <h2 class="page-title">日常医学问答</h2>
      <p class="page-sub">支持上传宫颈图片和 PDF 报告单做问答查询，系统会结合内部知识库与通用医学知识回复。</p>
    </div></header>
    <section class="medical-qa-layout">
      <form id="medicalQaFormV2" class="panel medical-qa-composer">
        <div class="section-heading"><div><span class="section-kicker">医学助手</span><h3>输入你的问题</h3></div><span class="pill">支持资料上传</span></div>
        <label>可选患者<select name="patientId"><option value="">不关联患者</option>${data.patients.map((patient) => `<option value="${html(patient.id)}">${html(patient.name)} · ${html(patient.phone ?? "")}</option>`).join("")}</select></label>
        <textarea name="question" rows="7" required placeholder="例如：上传这份报告后，ASC-US 常见的后续管理路径是什么？"></textarea>
        <label class="cervical-upload">上传宫颈图片<input type="file" name="images" accept="image/png,image/jpeg,image/webp,image/gif" multiple /><small>最多 3 张，支持 JPG / PNG / WebP / GIF。</small></label>
        <label class="cervical-upload">上传 PDF 报告单<input type="file" name="reports" accept="application/pdf,.pdf" multiple /><small>最多 3 份，系统会尝试提取文字参与问答。</small></label>
        <button type="submit" ${state.medicalQaLoading ? "disabled" : ""}>${state.medicalQaLoading ? "正在检索并回答..." : "获取医学回答"}</button>
        <p class="muted">可只提问文字，也可叠加患者、宫颈图片和 PDF 报告单。内部知识库支持的内容会附带来源。</p>
      </form>
      <section class="panel medical-qa-answer">
        ${qa ? `<div class="section-heading"><div><span class="section-kicker">回答</span><h3>${qa.knowledgeCoverage ? "已结合内部知识库" : "通用医学回答"}</h3></div><span class="pill">${qa.citations?.length ?? 0} 条内部依据</span></div>
          <div class="medical-qa-content">${renderMarkdown(qa.answer)}</div>
          ${qa.citations?.length ? `<details class="knowledge-citations"><summary>查看内部知识依据</summary><div class="knowledge-query-list">${qa.citations.map((item: any) => `<article><span class="knowledge-query-rank">${item.index}</span><div><div class="knowledge-query-title"><strong>${html(item.title)}</strong><span>${html(item.knowledgeBaseName)}</span></div><p>${html(item.excerpt)}</p></div></article>`).join("")}</div></details>` : ""}`
          : `<div class="empty-state"><div class="empty-state__title">可以询问日常医学问题</div><div class="empty-state__sub">也可以附加宫颈图片、PDF 报告和患者上下文一起提问。</div></div>`}
      </section>
    </section>`;
}

function renderCervicalAgent(data: Dashboard) {
  const qa = state.medicalQaAnswer;
  return `
    <header class="page-header"><div class="page-header__main">
      <nav class="breadcrumb"><span class="breadcrumb__current">临床支持</span></nav>
      <h2 class="page-title">日常医学问答</h2>
      <p class="page-sub">快速咨询日常医学问题。系统会优先检索公司知识库，也允许结合通用医学知识回答。</p>
    </div></header>
    <section class="medical-qa-layout">
      <form id="medicalQaForm" class="panel medical-qa-composer">
        <div class="section-heading"><div><span class="section-kicker">医学助手</span><h3>输入你的问题</h3></div><span class="pill">不绑定患者</span></div>
        <textarea name="question" rows="7" required placeholder="例如：ASC-US 常见的后续管理路径是什么？"></textarea>
        <button type="submit" ${state.medicalQaLoading ? "disabled" : ""}>${state.medicalQaLoading ? "正在检索并回答..." : "获取医学回答"}</button>
        <p class="muted">回答可能包含通用医学知识；内部知识库支持的内容会附带来源。</p>
      </form>
      <section class="panel medical-qa-answer">
        ${qa ? `<div class="section-heading"><div><span class="section-kicker">回答</span><h3>${qa.knowledgeCoverage ? "已检索内部知识库" : "通用医学回答"}</h3></div><span class="pill">${qa.citations?.length ?? 0} 条内部依据</span></div>
          <div class="medical-qa-content">${renderMarkdown(qa.answer)}</div>
          ${qa.citations?.length ? `<details class="knowledge-citations"><summary>查看内部知识依据</summary><div class="knowledge-query-list">${qa.citations.map((item: any) => `<article><span class="knowledge-query-rank">${item.index}</span><div><div class="knowledge-query-title"><strong>${html(item.title)}</strong><span>${html(item.knowledgeBaseName)}</span></div><p>${html(item.excerpt)}</p></div></article>`).join("")}</div></details>` : ""}`
          : `<div class="empty-state"><div class="empty-state__title">可以询问日常医学问题</div><div class="empty-state__sub">该入口不生成患者治疗方案，也不要求回答完全局限于公司知识库。</div></div>`}
      </section>
    </section>`;
  /*
  const draft = state.cervicalPlanDraft ?? state.cervicalPlans[0];
  const result = draft?.draft ?? null;
  const refs = Array.isArray(draft?.knowledgeRefs) ? draft.knowledgeRefs : [];
  const list = (items: unknown[]) => (items ?? []).map((item) => `<li>${html(String(item))}</li>`).join("");
  return `
    <header class="page-header"><div class="page-header__main">
      <nav class="breadcrumb"><span class="breadcrumb__current">临床决策支持</span></nav>
      <h2 class="page-title">宫颈疾病方案智能体</h2>
      <p class="page-sub">汇总医生输入、报告图片与患者档案，生成带知识依据的可审核方案草稿。</p>
    </div></header>
    <section class="cervical-agent-layout">
      <form id="cervicalAgentForm" class="panel cervical-agent-composer">
        <div class="section-heading"><div><span class="section-kicker">病例输入</span><h3>生成针对性方案草稿</h3></div><span class="pill">医生审核后生效</span></div>
        <label>关联患者（可选）<select name="patientId"><option value="">不关联患者，直接生成方案</option>${data.patients.map((patient) => `<option value="${html(patient.id)}">${html(patient.name)} · ${html(patient.phone ?? "")}</option>`).join("")}</select></label>
        <label>病情描述与医生关注点<textarea name="inputText" rows="7" placeholder="例如：HPV16 持续阳性，TCT 提示 ASC-US，希望结合生育需求制定复查与处置建议"></textarea></label>
        <label class="cervical-upload">上传报告图片<input type="file" name="reports" accept="image/png,image/jpeg,image/webp" multiple /><small>支持 JPG / PNG / WebP，最多 3 张。PDF 将在知识库私有解析接入后支持。</small></label>
        <label class="checklist__item"><input type="checkbox" required />我确认本功能仅用于临床决策支持，最终方案由执业医生审核。</label>
        <button type="submit" ${state.cervicalAgentLoading ? "disabled" : ""}>${state.cervicalAgentLoading ? "正在汇总并生成..." : "生成方案草稿"}</button>
      </form>
      <section class="panel cervical-agent-result">
        ${result ? `
          <div class="section-heading"><div><span class="section-kicker">方案草稿</span><h3>${html(result.summary ?? "待医生审核")}</h3></div><span class="pill ${draft.status === "APPROVED" ? "green" : "gold"}">${draft.status === "APPROVED" ? "医生已确认" : "待医生确认"}</span></div>
          <div class="cervical-alert"><strong>安全边界</strong><p>${html(result.doctorReviewNote ?? "请医生核对原始报告和指南后确认。")}</p></div>
          <div class="cervical-result-grid">
            <div><h4>临床评估</h4><ul>${list(result.assessment)}</ul></div>
            <div><h4>缺失信息</h4><ul>${list(result.missingInformation)}</ul></div>
            <div><h4>红旗风险</h4><ul>${list(result.redFlags)}</ul></div>
            <div><h4>复查计划</h4><ul>${list(result.followUpPlan)}</ul></div>
          </div>
          <div class="cervical-recommendations"><h4>建议处置路径</h4>${(result.treatmentRecommendations ?? []).map((item: any) => `<article><span>${html(item.priority ?? "NORMAL")}</span><div><strong>${html(item.title)}</strong><p>${html(item.detail)}</p></div></article>`).join("")}</div>
          <form id="cervicalReviewForm"><input type="hidden" name="id" value="${html(draft.id)}" /><label>医生审核备注<textarea name="doctorReviewNote" rows="3">${html(result.doctorReviewNote ?? "")}</textarea></label><div class="cervical-review-actions"><button type="submit" name="decision" value="DRAFT" class="secondary">保存审核备注</button><button type="submit" name="decision" value="APPROVED">确认方案</button></div></form>
          <div class="cervical-evidence"><strong>知识依据</strong>${refs.length ? refs.map((ref: any) => `<span>${html(ref.title)} v${html(ref.version)}</span>`).join("") : `<span>当前知识库暂无已发布文档</span>`}</div>
        ` : `<div class="empty-state"><div class="empty-state__title">等待生成方案草稿</div><div class="empty-state__sub">选择患者并补充病情，智能体会自动汇总关联档案与已发布知识文档。</div></div>`}
      </section>
    </section>
    <section class="panel data-panel"><div class="section-heading"><div><span class="section-kicker">历史记录</span><h3>最近方案草稿</h3></div><span class="section-count">${state.cervicalPlans.length} 份</span></div>
      <div class="table-wrap"><table><thead><tr><th>时间</th><th>患者</th><th>状态</th><th>知识引用</th><th>操作</th></tr></thead><tbody>${state.cervicalPlans.map((plan) => {
        const patient = data.patients.find((item) => item.id === plan.patientId);
        return `<tr><td>${html(String(plan.updatedAt).slice(0, 16).replace("T", " "))}</td><td>${html(patient?.name ?? plan.patientId)}</td><td>${html(plan.status)}</td><td>${Array.isArray(plan.knowledgeRefs) ? plan.knowledgeRefs.length : 0}</td><td><button type="button" class="secondary" data-cervical-plan="${html(plan.id)}">查看</button></td></tr>`;
      }).join("") || `<tr><td colspan="5" class="muted">暂无方案记录</td></tr>`}</tbody></table></div>
    </section>`;
  */
}

function renderTreatments(data: Dashboard) {
  const treatments = data.treatments ?? [];
  const templates = data.treatmentTemplates ?? [];
  const canManage = data.role !== "CLINIC_FRONT_DESK";
  const today = new Date().toISOString().slice(0, 10);
  const sessions = treatments.flatMap((treatment) => (treatment.sessions ?? []).map((session: any) => ({ ...session, treatment })));
  const todayCount = sessions.filter((item) => String(item.plannedAt).slice(0, 10) === today && item.status !== "COMPLETED").length;
  const delayedCount = sessions.filter((item) => item.status === "PERIOD_DELAYED").length;
  const attentionCount = treatments.filter((item) => item.status === "NEEDS_ATTENTION" || item.feedbacks?.length).length;
  const feedbackTreatments = treatments.filter((item) => item.status === "NEEDS_ATTENTION" || item.feedbacks?.length);
  const patientIds = new Set(treatments.map((item) => item.patient?.id).filter(Boolean));
  const treatmentPatients = data.patients.filter((item) => patientIds.has(item.id));
  const attentionTreatment = treatments.find((item) => item.status === "NEEDS_ATTENTION" || item.feedbacks?.length);
  const selectedPatientId = state.treatmentPatientId || attentionTreatment?.patient?.id || treatmentPatients[0]?.id || data.patients[0]?.id || "";
  const selectedPatient = data.patients.find((item) => item.id === selectedPatientId);
  const visibleTreatments = treatments.filter((item) => item.patient?.id === selectedPatientId);
  const visibleFollowUps = (data.followUps ?? []).filter((item) => item.patientId === selectedPatientId);
  const draftPatientId = state.treatmentDraftPatientId || selectedPatientId;
  const actionLabel = (value: string) => value === "HOME_MEDICATION" ? "居家用药" : value === "RECHECK" ? "到店复查" : value === "OBSERVATION" ? "居家观察" : "到店上药";
  const statusLabel = (value: string) => value === "COMPLETED" ? "已完成" : value === "PERIOD_DELAYED" ? "经期顺延" : value === "NEEDS_ATTENTION" ? "待处理异常" : value === "PAUSED" ? "已暂停" : value === "PENDING_CONFIRMATION" ? "待确认" : "待执行";
  return `
    <header class="page-header"><div class="page-header__main"><nav class="breadcrumb"><span class="breadcrumb__current">长期健康管理</span></nav><h2 class="page-title">疗程管理中心</h2><p class="page-sub">先选择患者，再集中查看她的疗程进度与执行排期。</p></div></header>
    <section class="kpi-grid">
      <div class="kpi-card kpi-card--teal"><div class="kpi-card__label">进行中疗程</div><div class="kpi-card__value">${treatments.filter((item) => ["ACTIVE","PERIOD_DELAYED","NEEDS_ATTENTION"].includes(item.status)).length}</div><div class="kpi-card__hint">已同步患者端</div></div>
      <div class="kpi-card kpi-card--amber"><div class="kpi-card__label">今日执行</div><div class="kpi-card__value">${todayCount}</div><div class="kpi-card__hint">到店与居家任务</div></div>
      <div class="kpi-card kpi-card--indigo"><div class="kpi-card__label">经期顺延</div><div class="kpi-card__value">${delayedCount}</div><div class="kpi-card__hint">已自动调整计划</div></div>
      <div class="kpi-card kpi-card--rose"><div class="kpi-card__label">异常待处理</div><div class="kpi-card__value">${attentionCount}</div><div class="kpi-card__hint">患者反馈与改期</div></div>
    </section>
    ${feedbackTreatments.length ? `<section class="panel treatment-feedback-queue">
      <div class="section-heading"><div><span class="section-kicker">需要医生处理</span><h3>患者反馈队列</h3></div><span class="section-count">${feedbackTreatments.length} 位患者</span></div>
      <div class="treatment-feedback-queue__items">${feedbackTreatments.map((item) => `<button type="button" data-treatment-feedback-patient="${html(item.patient?.id)}">
        <strong>${html(item.patient?.name || "患者")}</strong>
        <span>${html(item.name)} · ${item.feedbacks?.length ?? 0} 条待处理反馈</span>
      </button>`).join("")}</div>
    </section>` : ""}
    <section class="panel treatment-patient-filter">
      <div><span class="section-kicker">患者疗程档案</span><h3>${selectedPatient ? `${html(selectedPatient.name)}的疗程` : "选择患者查看疗程"}</h3><p class="muted">每次只展示一位患者，执行排期更容易核对。</p></div>
      <label>筛选患者<select data-treatment-patient-filter>${data.patients.map((item) => {
        const feedbackCount = treatments.filter((t) => t.patient?.id === item.id).reduce((sum, t) => sum + (t.feedbacks?.length ?? 0), 0);
        return `<option value="${html(item.id)}" ${item.id === selectedPatientId ? "selected" : ""}>${html(item.name)} · ${html(item.phone ?? "")}${feedbackCount ? ` · ${feedbackCount} 条待处理反馈` : ""}</option>`;
      }).join("")}</select></label>
    </section>
    ${canManage ? `<details class="panel action-panel treatment-create-panel" ${visibleTreatments.length ? "" : "open"}><summary><div><span class="section-kicker">创建新疗程</span><h3>从标准模板生成完整排期</h3></div><strong>展开创建</strong></summary><form id="treatmentCreateForm" class="form-grid">
      <label>患者<select name="patientId">${data.patients.map((item) => `<option value="${html(item.id)}" ${item.id === draftPatientId ? "selected" : ""}>${html(item.name)} · ${html(item.phone)}</option>`).join("")}</select></label>
      <label>疗程模板<select name="templateId">${templates.map((item) => `<option value="${html(item.id)}">${html(item.name)} · ${html(item.kit?.name)}</option>`).join("")}</select></label>
      <label>开始日期<input name="startDate" type="date" value="${today}" required /></label>
      <label class="checklist__item"><input name="periodNotApplicable" type="checkbox" value="true" />该患者无需经期避让基线</label>
      <label style="grid-column:1/-1">个性化备注<textarea name="notes" placeholder="医生可填写患者个性化执行说明"></textarea></label>
      <button type="submit" ${templates.length ? "" : "disabled"}>生成并同步疗程</button>
    </form>${templates.length ? "" : `<p class="muted">暂无已发布的总部疗程模板，请先在总后台创建模板。</p>`}</details>` : ""}
    <section class="treatment-board">${visibleTreatments.map((treatment) => {
      const completed = treatment.sessions.filter((item: any) => item.status === "COMPLETED").length;
      const next = treatment.sessions.find((item: any) => item.status !== "COMPLETED");
      return `<article class="treatment-card">
        <header><div><span>${html(treatment.kit?.name)} · ${statusLabel(treatment.status)}</span><h3>${html(treatment.name)}</h3><p>负责医生 ${html(treatment.doctor?.name)} · 下一步 ${next ? `${html(next.title)} ${html(String(next.plannedAt).slice(0, 10))}` : "已全部完成"}</p></div><strong>${completed}/${treatment.sessions.length}</strong></header>
        <div class="treatment-progress"><i style="width:${treatment.sessions.length ? Math.round(completed / treatment.sessions.length * 100) : 0}%"></i></div>
        <div class="table-wrap treatment-session-table"><table><thead><tr><th>序号 / 日期</th><th>标准流程</th><th>执行方式</th><th>状态</th><th>操作</th></tr></thead><tbody>${treatment.sessions.map((session: any, index: number) => `<tr class="${session.status === "COMPLETED" ? "is-done" : ""}">
          <td><strong>第 ${index + 1} 次</strong><div class="muted">${html(String(session.plannedAt).slice(0, 10))}</div></td>
          <td><strong>${html(session.title)}</strong><div class="muted">${html(session.description || "按医生安排执行")}</div></td>
          <td>${actionLabel(session.actionType)}</td><td><span class="pill">${statusLabel(session.status)}</span></td>
          <td>${canManage && session.status !== "COMPLETED" ? `<div class="treatment-row-actions"><button data-complete-treatment-session="${html(session.id)}" data-treatment-id="${html(treatment.id)}">完成本次</button><input type="date" data-treatment-date="${html(session.id)}" value="${html(String(session.plannedAt).slice(0, 10))}" /><button data-reschedule-treatment-session="${html(session.id)}" data-treatment-id="${html(treatment.id)}">改期</button></div>` : `<span class="muted">${session.status === "COMPLETED" ? "本次已完成" : "仅可查看"}</span>`}</td>
        </tr>`).join("")}</tbody></table></div>
        ${treatment.feedbacks?.length ? `<div class="treatment-alert"><strong>患者反馈待处理</strong>${treatment.feedbacks.map((item: any) => `<p>${html(item.type)}：${html(item.content)} <button data-resolve-treatment-feedback="${html(item.id)}" data-treatment-id="${html(treatment.id)}">标记已处理</button></p>`).join("")}</div>` : ""}
        ${treatment.status === "COMPLETED" && canManage ? `<div class="treatment-renew"><div><strong>本疗程已结束</strong><p>是否继续为 ${html(treatment.patient?.name)} 创建新的疗程计划？</p></div><button data-new-treatment-for="${html(treatment.patient?.id)}">创建新疗程</button></div>` : ""}
      </article>`;
    }).join("") || `<div class="empty-state"><div class="empty-state__title">${selectedPatient ? `${html(selectedPatient.name)}暂无疗程记录` : "暂无疗程记录"}</div><div class="empty-state__sub">展开上方创建区，从标准模板生成第一份长期疗程计划。</div></div>`}</section>
    ${canManage && selectedPatient ? `<section class="panel treatment-followup-panel"><div class="section-heading"><div><span class="section-kicker">疗程补充关怀</span><h3>随访与患者通知</h3></div><span class="section-count">${visibleFollowUps.length} 项</span></div>
      <form id="followScheduleForm" class="form-grid">
        <input type="hidden" name="patientId" value="${html(selectedPatient.id)}" />
        <label>随访主题<input name="title" value="疗程复查关怀" required /></label>
        <label>随访日期<input name="dueDate" type="date" value="${today}" required /></label>
        <input type="hidden" name="channel" value="IN_APP" />
        <label style="grid-column:1/-1">发送给患者的通知内容<textarea name="notificationContent" required>医生已为您安排疗程随访，请留意通知并按计划完成复查。</textarea></label>
        <button type="submit">创建随访并发送站内通知</button>
      </form>
      <div class="table-wrap"><table><thead><tr><th>日期</th><th>随访主题</th><th>状态</th><th>操作</th></tr></thead><tbody>${visibleFollowUps.map((item) => `<tr><td>${html(item.dueDate)}</td><td><strong>${html(item.title)}</strong></td><td>${html(labelOf(FOLLOW_STATUS_LABELS, item.status))}</td><td><button data-follow="${html(item.id)}" ${item.status === "DONE" ? "disabled" : ""}>完成随访</button></td></tr>`).join("") || `<tr><td colspan="4" class="muted">暂未安排随访</td></tr>`}</tbody></table></div>
    </section>` : ""}`;
}

function badge(value: unknown, tone = "") {
  return `<span class="pill ${tone}">${html(value || "-")}</span>`;
}

function renderMarketing(data: Dashboard) {
  // 已采用活动追踪：按 campaignId 聚合 enrollments 状态分布
  const adoptedCampaigns = (data.campaigns ?? []).slice().sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
  const enrollmentsByCampaign = new Map<string, any[]>();
  for (const enrollment of data.enrollments ?? []) {
    const list = enrollmentsByCampaign.get(enrollment.campaignId) ?? [];
    list.push(enrollment);
    enrollmentsByCampaign.set(enrollment.campaignId, list);
  }
  const trackedRows = adoptedCampaigns.map((campaign) => {
    const related = enrollmentsByCampaign.get(campaign.id) ?? [];
    const tally: Record<string, number> = { NEW: 0, CONTACTED: 0, ATTENDED: 0, CONVERTED: 0, CANCELLED: 0 };
    for (const e of related) tally[e.status] = (tally[e.status] ?? 0) + 1;
    const total = related.length;
    const conversionRate = total ? Math.round((tally.CONVERTED / total) * 100) : 0;
    const shares = Number(campaign.shares ?? 0);
    const bookings = Number(campaign.bookings ?? 0);
    return { campaign, total, tally, conversionRate, shares, bookings };
  });
  const statusBadge = (s: string) => s === "进行中" ? badge("进行中", "green")
    : s === "已下架" ? badge("已下架", "rose")
    : s === "已结束" ? badge("已结束", "muted")
    : badge(s || "—", "muted");

  return `
    <header class="page-header">
      <div class="page-header__main">
        <nav class="breadcrumb"><span class="breadcrumb__current">活动运营</span></nav>
        <h2 class="page-title">活动运营</h2>
        <p class="page-sub">追踪活动从线索到成交的转化进度，并从总部模板快速启动新活动。</p>
      </div>
    </header>
    <section class="panel data-panel">
      <div class="toolbar"><h3>已采用活动追踪（${trackedRows.length}）</h3>${badge(`共 ${trackedRows.reduce((s, r) => s + r.total, 0)} 条报名`, "blue")}</div>
      <p class="muted">NEW（线索）→ CONTACTED（已联系）→ ATTENDED（已到店）→ CONVERTED（已成交）。本视图只展示本门店的活动漏斗。「<strong>已下架</strong>」的活动不再向患者端展示。</p>
      ${trackedRows.length === 0
        ? `<div class="empty-state"><div class="empty-state__title">尚未采用任何活动</div><div class="empty-state__sub">在下方「总部活动模板」中点击「采用」</div></div>`
        : `<div class="table-wrap"><table>
            <thead><tr><th>活动</th><th>状态</th><th>分类</th><th>分享 / 预约</th><th>线索 NEW</th><th>已联系</th><th>已到店</th><th>已成交</th><th>已取消</th><th>转化率</th><th>操作</th></tr></thead>
            <tbody>${trackedRows.map(({ campaign, total, tally, conversionRate, shares, bookings }) => {
              const tone = conversionRate >= 30 ? "green" : conversionRate >= 10 ? "gold" : "rose";
              const isFromTemplate = !!campaign.templateId;
              const isArchived = campaign.status === "已下架";
              const actions = isFromTemplate
                ? (isArchived
                    ? `<button data-campaign-reactivate="${html(campaign.id)}">重新上架</button>`
                    : `<button class="danger" data-campaign-archive="${html(campaign.id)}">下架（取消患者端展示）</button>`)
                : `<span class="muted" style="font-size:11px">自建活动</span>`;
              return `<tr ${isArchived ? 'style="opacity:0.55"' : ''}>
                <td><strong>${html(campaign.title)}</strong><br><span class="muted">${html(campaign.target ?? "")}</span></td>
                <td>${statusBadge(campaign.status)}</td>
                <td>${html(campaign.category ?? "")}</td>
                <td>${shares} / ${bookings}</td>
                <td>${tally.NEW}</td>
                <td>${tally.CONTACTED}</td>
                <td>${tally.ATTENDED}</td>
                <td><strong>${tally.CONVERTED}</strong></td>
                <td>${tally.CANCELLED}</td>
                <td>${badge(total ? `${conversionRate}%` : "-", total ? tone : "muted")}</td>
                <td>${actions}</td>
              </tr>`;
            }).join("")}</tbody>
          </table></div>`}
    </section>
    <section class="panel template-library">
      <div class="section-heading"><div><span class="section-kicker">可用素材</span><h3>总部活动模板</h3></div><span class="section-count">${data.campaignTemplates.length} 个模板</span></div>
      <div class="table-wrap"><table><thead><tr><th>模板</th><th>内容</th><th>动作</th></tr></thead><tbody>
        ${data.campaignTemplates.map((item) => `<tr><td>${html(item.title)}</td><td>${html(item.copy)}</td><td><button data-template="${html(item.id)}">采用</button></td></tr>`).join("")}
      </tbody></table></div>
    </section>`;
}

const ARTICLE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档"
};

function renderAiPanel(panelId: string, placeholder: string, hint: string) {
  return `
    <div class="ai-panel" id="${panelId}">
      <div class="ai-panel__header">
        <span class="ai-panel__badge">AI</span>
        <span>${html(hint)}</span>
      </div>
      <textarea data-ai-prompt placeholder="${html(placeholder)}" maxlength="800"></textarea>
      <div class="ai-panel__actions">
        <button type="button" class="ai-generate" data-ai-generate>AI 一键生成</button>
        <span class="ai-panel__status" data-ai-status></span>
      </div>
    </div>`;
}

function renderArticles(data: Dashboard) {
  return `
    <header class="page-header">
      <div class="page-header__main">
        <nav class="breadcrumb"><span class="breadcrumb__current">健康科普</span></nav>
        <h2 class="page-title">健康科普</h2>
        <p class="page-sub">创建本店专业内容，或采用总部模板快速发布到患者端。</p>
      </div>
    </header>
    <section class="clinic-creator-layout">
      <div class="panel creator-panel">
        <div class="section-kicker">内容创作</div>
        <h3>原创健康科普</h3>
        <p class="muted">直接撰写并发布到本诊所的患者端，未填字段将自动留空或使用默认值。</p>
        ${renderAiPanel(
          "aiArticlePanel",
          "如：写一篇关于女性冬季手脚冰凉的科普文章，重点讲原因和日常调理方法。",
          "提示词：仅作生成参考，不会随文章发布"
        )}
        <form id="articleCreateForm" class="form">
          <input name="title" placeholder="标题" required />
          <input name="category" placeholder="分类（如 妇科科普）" value="妇科科普" />
          <input name="summary" placeholder="副标题 / 摘要（卡片展示用）" />
          ${renderImageField("articleImageFile", "imageUrl", "封面图", false)}
          <textarea name="content" placeholder="正文，每行一段，支持多段落" rows="5" required></textarea>
          <select name="status">
            <option value="PUBLISHED">直接发布</option>
            <option value="DRAFT">存为草稿</option>
          </select>
          <button type="submit">新增文章</button>
        </form>
      </div>
      <div class="panel template-library">
        <div class="section-kicker">总部内容库</div>
        <h3>从总部模板一键发布</h3>
        <p class="muted">总部下发的科普模板，可一键发布到本店患者端，发布后支持二次编辑。</p>
        <div class="table-wrap"><table><thead><tr><th>模板</th><th>分类</th><th>动作</th></tr></thead><tbody>
          ${(data.articleTemplates ?? []).map((item) => `<tr><td><strong>${html(item.title)}</strong><div class="muted">${html(item.summary ?? "")}</div></td><td>${html(item.category ?? "—")}</td><td><button data-adopt-template="${html(item.id)}">采用并发布</button></td></tr>`).join("")}
        </tbody></table></div>
      </div>
    </section>
    <section class="panel data-panel">
      <div class="section-heading"><div><span class="section-kicker">已创建内容</span><h3>本店文章</h3></div><span class="section-count">${(data.clinicArticles ?? []).length} 篇</span></div>
      <p class="muted">编辑后将实时同步到患者端；归档后患者端将不再展示。</p>
      <div class="table-wrap"><table><thead><tr><th>标题</th><th>分类</th><th>副标题</th><th>状态</th><th>更新时间</th><th>动作</th></tr></thead><tbody>
        ${(data.clinicArticles ?? []).map((item) => `<tr>
          <td><strong>${html(item.title)}</strong>${item.imageUrl ? `<div class="muted">已设置封面</div>` : ""}</td>
          <td>${html(item.category ?? "—")}</td>
          <td>${html(item.summary ?? "—")}</td>
          <td>${html(labelOf(ARTICLE_STATUS_LABELS, item.status, "草稿"))}</td>
          <td>${item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}</td>
          <td class="actions">
            <button data-article-status="${html(item.id)}" data-target="${item.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"}">${item.status === "PUBLISHED" ? "转草稿" : "转发布"}</button>
            <button class="danger" data-article-archive="${html(item.id)}">删除</button>
          </td>
        </tr>`).join("")}
      </tbody></table></div>
    </section>`;
}

const MARKETING_POST_TYPE_LABELS: Record<string, string> = {
  ANNOUNCEMENT: "公告",
  PROMOTION: "营销",
  ACTIVITY: "活动"
};

const MARKETING_POST_STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
  TEMPLATE: "总部模板"
};

function renderMarketingPosts(data: Dashboard) {
  return `
    <header class="page-header">
      <div class="page-header__main">
        <nav class="breadcrumb"><span class="breadcrumb__current">营销推送</span></nav>
        <h2 class="page-title">营销推送</h2>
        <p class="page-sub">制作结构化宣传稿，并管理面向本店患者的发布状态。</p>
      </div>
    </header>
    <section class="clinic-creator-layout">
      <div class="panel creator-panel">
        <div class="section-kicker">营销内容创作</div>
        <h3>原创营销推送</h3>
        <p class="muted">结构化宣传稿：首图/内容/中心图/内容/尾图/权益 + 活动信息 + 留空。发布后将 in-app 推送到本诊所全部患者。</p>
        ${renderAiPanel(
          "aiMarketingPanel",
          "如：双十一妇科体检套餐 9.9 元秒杀，仅限前 100 名新客，含妇科彩超 + 白带常规。",
          "提示词：仅作生成参考，不会随营销稿发布"
        )}
        <form id="marketingPostCreateForm" class="form">
          <input name="title" placeholder="标题" required />
          <input name="subtitle" placeholder="副标题（卡片下方一行）" />
          ${renderImageField("coverImageFile", "coverImageUrl", "首图", false)}
          <textarea name="introText" placeholder="首图后正文" rows="3" required></textarea>
          ${renderImageField("centerImageFile", "centerImageUrl", "中心图", false)}
          <textarea name="bodyText" placeholder="中心图后正文（可选）" rows="3"></textarea>
          ${renderImageField("footerImageFile", "footerImageUrl", "尾图", false)}
          <input name="benefits" placeholder="活动权益（一段话）" />
          <input name="activityInfo" placeholder="活动信息（时间/门槛/价格）" />
          <textarea name="notes" placeholder="底部留空 1-2 行（可选）" rows="2"></textarea>
          <select name="type">
            <option value="ANNOUNCEMENT">公告</option>
            <option value="PROMOTION" selected>营销</option>
            <option value="ACTIVITY">活动</option>
          </select>
          <select name="status">
            <option value="PUBLISHED">直接发布</option>
            <option value="DRAFT">存为草稿</option>
          </select>
          <button type="submit">新增营销推送</button>
        </form>
      </div>
      <div class="panel template-library">
        <div class="section-kicker">总部营销库</div>
        <h3>总部营销模板</h3>
        <p class="muted">总部下发的结构化模板，可改写留空 1-2 行后一键发布到本店患者端。</p>
        <div class="table-wrap"><table><thead><tr><th>模板</th><th>类型</th><th>动作</th></tr></thead><tbody>
          ${(data.marketingPostTemplates ?? []).map((item) => `<tr>
            <td><strong>${html(item.title)}</strong><div class="muted">${html(item.subtitle ?? item.introText?.slice(0, 30) ?? "")}</div></td>
            <td>${html(MARKETING_POST_TYPE_LABELS[item.type] ?? item.type ?? "—")}</td>
            <td><button data-marketing-adopt="${html(item.id)}">采用并发布</button></td>
          </tr>`).join("") || `<tr><td colspan="3" class="muted">暂无总部模板</td></tr>`}
        </tbody></table></div>
      </div>
    </section>
    <section class="panel data-panel">
      <div class="section-heading"><div><span class="section-kicker">发布管理</span><h3>本店营销推送</h3></div><span class="section-count">${(data.clinicMarketingPosts ?? []).length} 条</span></div>
      <p class="muted">已发布状态会向本诊所全部患者发送 in-app 通知；归档后患者端不再展示。</p>
      <div class="table-wrap"><table><thead><tr><th>标题</th><th>类型</th><th>副标题</th><th>状态</th><th>更新时间</th><th>动作</th></tr></thead><tbody>
        ${(data.clinicMarketingPosts ?? []).map((item) => `<tr>
          <td><strong>${html(item.title)}</strong>${item.coverImageUrl ? `<div class="muted">已设置首图</div>` : ""}</td>
          <td>${html(MARKETING_POST_TYPE_LABELS[item.type] ?? item.type ?? "—")}</td>
          <td>${html(item.subtitle ?? "—")}</td>
          <td>${html(labelOf(MARKETING_POST_STATUS_LABELS, item.status, "草稿"))}</td>
          <td>${item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}</td>
          <td class="actions">
            <button data-marketing-status="${html(item.id)}" data-target="${item.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"}">${item.status === "PUBLISHED" ? "转草稿" : "转发布"}</button>
            <button class="danger" data-marketing-archive="${html(item.id)}">删除</button>
          </td>
        </tr>`).join("") || `<tr><td colspan="6" class="muted">暂无营销推送</td></tr>`}
      </tbody></table></div>
    </section>`;
}

const REFERRAL_STATUS_LABELS: Record<string, string> = {
  PENDING: "已邀请",
  REGISTERED: "已注册",
  ATTENDED: "已到店",
  REWARDED: "已奖励",
  CANCELLED: "已取消"
};

function renderInvites(data: Dashboard) {
  const stats = data.inviteStats ?? { total: 0, registered: 0, attended: 0, rewarded: 0 };
  const poster = data.sharePoster;
  const isManager = true; // 诊所端统一为医生，所有人权限一致
  const update = data.sharePoster?.updatedAt ? new Date(data.sharePoster.updatedAt).toLocaleString() : "—";
  return `
    <header class="page-header">
      <div class="page-header__main">
        <nav class="breadcrumb"><span>诊所工作台</span><span class="breadcrumb__sep">/</span><span class="breadcrumb__current">邀请管理</span></nav>
        <h2 class="page-title">邀请管理</h2>
        <p class="page-sub">管理门店统一分享海报，追踪患者专属邀请码带来的到店转化。</p>
      </div>
    </header>
    <section class="kpi-grid" id="inviteKpiGrid">
      <div class="kpi-card kpi-card--rose">
        <div class="kpi-card__label">总邀请数</div>
        <div class="kpi-card__value">${stats.total}</div>
        <div class="kpi-card__hint">已注册的 Referral 数量</div>
      </div>
      <div class="kpi-card kpi-card--indigo">
        <div class="kpi-card__label">已到店</div>
        <div class="kpi-card__value">${stats.attended}</div>
        <div class="kpi-card__hint">被邀请人已到店首签</div>
      </div>
      <div class="kpi-card kpi-card--teal">
        <div class="kpi-card__label">已奖励</div>
        <div class="kpi-card__value">${stats.rewarded}</div>
        <div class="kpi-card__hint">已发放奖励券</div>
      </div>
      <div class="kpi-card" id="inviteKpiPoster">
        <div class="kpi-card__label">统一海报</div>
        <div class="kpi-card__value" style="font-size:16px;line-height:1.4">${poster?.hasImage ? "已上传" : "未上传"}</div>
        <div class="kpi-card__hint">最近更新：${update}</div>
      </div>
    </section>
    <section class="panel poster-workspace">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h3 style="margin:0">门店统一分享海报</h3>
        <div style="display:flex;gap:8px">
          <button class="${state.posterMode === "template" ? "" : "secondary"}" id="posterModeTemplate">模板编辑器</button>
          <button class="${state.posterMode === "simple" ? "" : "secondary"}" id="posterModeSimple">直接上传</button>
        </div>
      </div>
      ${state.posterMode === "template" ? `
        <p class="muted">左侧实时预览，右侧填写文字 / 插入图片。保存后患者在「个人中心 · 邀请有礼」看到的就是这张图。</p>
        ${renderPosterEditor(data)}
      ` : renderSimplePosterUpload(data)}
    </section>
    <section class="panel data-panel">
      <div class="section-heading"><div><span class="section-kicker">转化明细</span><h3>邀请记录</h3></div><span class="section-count">${state.invites.length} 条</span></div>
      <p class="muted">所有「专属邀请码」渠道产生的 Referral，手机号已脱敏。仅展示最近 ${state.invites.length} 条；点击列表可见邀请人对应邀请码。</p>
      <div class="table-wrap"><table><thead><tr><th>邀请时间</th><th>邀请人</th><th>被邀请人</th><th>渠道</th><th>状态</th><th>邀请码</th></tr></thead><tbody id="inviteTableBody">
        ${state.invites.length === 0 ? `<tr><td colspan="6" class="muted">暂无邀请记录（数据加载中…）</td></tr>` : state.invites.map((item) => `<tr>
          <td>${item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}</td>
          <td>${html(item.inviter?.name ?? "—")} <div class="muted">${html(item.inviter?.phone ?? "")}</div></td>
          <td>${html(item.invitee?.name ?? "—")} <div class="muted">${html(item.invitee?.phone ?? "")}</div></td>
          <td><span class="pill ${item.source === "CODE" ? "indigo" : "gray"}">${item.source === "CODE" ? "专属邀请码" : "短信"}</span></td>
          <td><span class="pill ${item.status === "REWARDED" ? "green" : item.status === "ATTENDED" ? "blue" : item.status === "REGISTERED" ? "indigo" : "gold"}">${REFERRAL_STATUS_LABELS[item.status] ?? item.status}</span></td>
          <td>${html(item.inviteCode ?? "—")}</td>
        </tr>`).join("")}
      </tbody></table></div>
    </section>
  `;
}

function renderTasks(data: Dashboard) {
  // 兜底：state.taskFilter / state.taskNoteDraft 可能在 state 被重置时丢失
  if (!state.taskFilter) state.taskFilter = { status: "all", priority: "all" };
  if (!state.taskNoteDraft) state.taskNoteDraft = {};
  const pending = data.operationTasks.filter((item) => progressFor(item.id) !== "DONE");
  const done = data.operationTasks.filter((item) => progressFor(item.id) === "DONE");
  const summary = data.taskSummary;
  const myTasks = data.operationTasks.filter((t) => t.clinicId === data.clinic?.id);
  const dueBadge = (item: any) => {
    if (progressFor(item.id) === "DONE") return `<span class="muted">—</span>`;
    if (!item.dueAt) return `<span class="muted">—</span>`;
    const due = new Date(item.dueAt).getTime();
    const now = Date.now();
    if (due < now) return `<span class="badge rose">已逾期</span>`;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);
    if (due >= todayStart.getTime() && due < todayEnd.getTime()) return `<span class="badge gold">今日到期</span>`;
    return `<span class="muted">${new Date(item.dueAt).toLocaleDateString()}</span>`;
  };
  // 过滤 + 分组
  const f = state.taskFilter;
  const matchFilter = (item: any) => {
    const st = progressFor(item.id);
    if (f.status !== "all" && st !== f.status) return false;
    if (f.priority !== "all" && (item.priority ?? "NORMAL") !== f.priority) return false;
    return true;
  };
  const filteredPending = pending.filter(matchFilter);
  const filteredDone = done.filter(matchFilter);
  // 分组：逾期 / 今日 / 未来
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);
  const overdueItems = filteredPending.filter((t) => t.dueAt && new Date(t.dueAt).getTime() < now);
  const todayItems = filteredPending.filter((t) => t.dueAt && new Date(t.dueAt).getTime() >= todayStart.getTime() && new Date(t.dueAt).getTime() < todayEnd.getTime());
  const upcomingItems = filteredPending.filter((t) => !t.dueAt || new Date(t.dueAt).getTime() >= todayEnd.getTime());
  // 完成率
  const totalAll = myTasks.length || (pending.length + done.length);
  const doneAll = myTasks.filter((t) => progressFor(t.id) === "DONE").length || done.length;
  const completionRate = totalAll ? Math.round((doneAll / totalAll) * 100) : 0;
  const taskRow = (item: any) => {
    const note = state.taskNoteDraft[item.id] ?? "";
    return `<tr>
      <td><strong>${html(item.title)}</strong><div class="muted">${html((item.content || "").slice(0, 50))}${(item.content || "").length > 50 ? "…" : ""}</div></td>
      <td>${html(labelOf(TASK_PRIORITY_LABELS, item.priority ?? "NORMAL", "普通"))}</td>
      <td>${dueBadge(item)}</td>
      <td>${progressLabel(item.id)}</td>
      <td><div style="display:flex;gap:8px;align-items:center"><button data-task="${html(item.id)}">完成</button><input type="text" placeholder="备注（可选）" data-task-note="${html(item.id)}" id="taskNote-${html(item.id)}" data-focus-key="taskNote-${html(item.id)}" value="${html(note)}" style="min-width:160px" /></div></td>
    </tr>`;
  };
  const renderGroup = (title: string, color: string, items: any[]) => {
    if (items.length === 0) return "";
    return `<h4 style="margin:14px 0 6px"><span class="badge ${color}">${title}</span> <span class="muted">${items.length} 项</span></h4>${items.map(taskRow).join("")}`;
  };
  return `
    <header class="page-header">
      <div class="page-header__main">
        <nav class="breadcrumb"><span class="breadcrumb__current">待办中心</span></nav>
        <h2 class="page-title">✅ 待办中心</h2>
        <p class="page-sub">总部下发的运营任务，完成后系统会回传给总部统计完成率。</p>
      </div>
    </header>
    <section class="grid four">
      <div class="panel metric"><span class="muted">待办总数</span><strong>${summary?.total ?? pending.length}</strong></div>
      <div class="panel metric"><span class="muted">今日到期</span><strong style="color:#d97706">${summary?.dueToday ?? 0}</strong></div>
      <div class="panel metric"><span class="muted">已逾期</span><strong style="color:#dc2626">${summary?.overdue ?? 0}</strong></div>
      <div class="panel metric"><span class="muted">紧急 + 高优</span><strong>${(summary?.byPriority?.URGENT ?? 0) + (summary?.byPriority?.HIGH ?? 0)}</strong></div>
    </section>
    <section class="panel">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:240px">
          <div class="muted" style="font-size:12px;margin-bottom:4px">本店完成率</div>
          <div style="background:#e5e7eb;border-radius:8px;height:14px;overflow:hidden">
            <div style="background:linear-gradient(90deg,#10b981,#059669);height:100%;width:100%;transform:scaleX(${(completionRate / 100).toFixed(3)});transform-origin:left center;transition:transform .3s"></div>
          </div>
          <div style="margin-top:4px;font-size:13px"><strong>${completionRate}%</strong> <span class="muted">（已完成 ${doneAll} / 总计 ${totalAll}）</span></div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <label class="muted">状态</label>
          <select id="taskStatusFilter">
            <option value="all" ${f.status === "all" ? "selected" : ""}>全部</option>
            <option value="PENDING" ${f.status === "PENDING" ? "selected" : ""}>进行中</option>
            <option value="DONE" ${f.status === "DONE" ? "selected" : ""}>已完成</option>
          </select>
          <label class="muted">优先级</label>
          <select id="taskPriorityFilter">
            <option value="all" ${f.priority === "all" ? "selected" : ""}>全部</option>
            <option value="URGENT" ${f.priority === "URGENT" ? "selected" : ""}>紧急</option>
            <option value="HIGH" ${f.priority === "HIGH" ? "selected" : ""}>高</option>
            <option value="NORMAL" ${f.priority === "NORMAL" ? "selected" : ""}>普通</option>
            <option value="LOW" ${f.priority === "LOW" ? "selected" : ""}>低</option>
          </select>
        </div>
      </div>
    </section>
    <section class="clinic-workspace-split clinic-workspace-split--tasks">
      <div class="panel template-library">
        <div class="section-kicker">快捷创建</div>
        <h3>总部任务模板库</h3>
        <p class="muted">总部下发的常用任务模板，可一键采纳为待办。同一模板二次采纳会自动跳过。</p>
        <div class="table-wrap"><table><thead><tr><th>模板</th><th>分类</th><th>优先级</th><th>动作</th></tr></thead><tbody>
          ${(data.taskTemplates ?? []).map((item) => `<tr>
            <td><strong>${html(item.title)}</strong><div class="muted">${html((item.content || "").slice(0, 50))}${(item.content || "").length > 50 ? "…" : ""}</div></td>
            <td>${html(item.category === "GROWTH" ? "拓店" : item.category === "MARKETING" ? "营销" : "运营")}</td>
            <td>${html(labelOf(TASK_PRIORITY_LABELS, item.priority ?? "NORMAL", "普通"))}</td>
            <td><button data-adopt-task-template="${html(item.id)}">采纳为待办</button></td>
          </tr>`).join("") || `<tr><td colspan="4" class="muted">暂无总部模板</td></tr>`}
        </tbody></table></div>
      </div>
      <div class="panel data-panel">
        <div class="section-heading"><div><span class="section-kicker">执行队列</span><h3>待办中心</h3></div><span class="section-count">${filteredPending.length} 项</span></div>
        <p class="muted">按紧急程度 + 到期时间排序，逾期 → 今日 → 未来。</p>
        ${filteredPending.length === 0 ? `<p class="muted" style="text-align:center;padding:20px">🎉 暂无待办</p>` : `
        <div class="table-wrap"><table><thead><tr><th>任务</th><th>优先级</th><th>截止</th><th>状态</th><th>动作</th></tr></thead><tbody>
          ${renderGroup("已逾期", "rose", overdueItems)}
          ${renderGroup("今日到期", "gold", todayItems)}
          ${renderGroup("未来待办", "blue", upcomingItems)}
        </tbody></table></div>`}
      </div>
    </section>
    ${filteredDone.length ? `<section class="panel">
      <h3>已完成（${filteredDone.length}）</h3>
      <div class="table-wrap"><table><thead><tr><th>任务</th><th>优先级</th><th>完成时间</th><th>备注</th></tr></thead><tbody>
        ${filteredDone.slice(0, 20).map((item) => {
          const p = state.data?.taskProgress.find((tp) => tp.taskId === item.id);
          return `<tr><td>${html(item.title)}</td><td>${html(labelOf(TASK_PRIORITY_LABELS, item.priority ?? "NORMAL", "普通"))}</td><td>${p?.completedAt ? new Date(p.completedAt).toLocaleString() : "—"}</td><td class="muted">${html(p?.note || "—")}</td></tr>`;
        }).join("")}
      </tbody></table></div>
    </section>` : ""}`;
}

async function loadInvites() {
  if (state.active !== "invites") return;
  try {
    const [items, poster] = await Promise.all([
      api<{ items: InviteItem[] }>("/api/clinic/invites?limit=50"),
      api<{ poster: { id: string; title: string; imageBase64: string | null; templateData?: PosterTemplateData | null; status: string; updatedAt: string } | null }>("/api/clinic/share-poster")
    ]);
    state.invites = items.items;
    if (poster.poster) {
      state.posterImageBase64 = poster.poster.imageBase64;
      state.posterTemplate = poster.poster.templateData ?? null;
      if (poster.poster.templateData && state.active === "invites") {
        // 只在首次加载时写入 draft（避免覆盖用户正在编辑的内容）
        const el = document.querySelector<HTMLInputElement>("#peTitle");
        if (!el || !el.matches(":focus")) {
          state.posterDraft = { ...EMPTY_POSTER_TEMPLATE, ...poster.poster.templateData };
        }
      }
      if (state.data) {
        state.data.sharePoster = {
          id: poster.poster.id,
          title: poster.poster.title,
          hasImage: !!poster.poster.imageBase64,
          updatedAt: poster.poster.updatedAt
        };
      }
    } else {
      if (state.data) state.data.sharePoster = { id: null, title: "", hasImage: false, updatedAt: null };
      state.posterImageBase64 = null;
      state.posterTemplate = null;
    }
    // 增量更新邀请记录 table 行，不重建整个 DOM
    updateInviteTable();
    // 更新 KPI 卡片
    updateInviteKpis();
    // 只重绘 canvas 预览（不重建 DOM）
    void redrawPosterPreview();
  } catch (err) {
    showToast((err as Error).message, "error");
  }
}

function updateInviteTable() {
  const tbody = document.querySelector<HTMLTableSectionElement>("#inviteTableBody");
  if (!tbody) return;
  if (state.invites.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">暂无邀请记录</td></tr>`;
    return;
  }
  tbody.innerHTML = state.invites.map((item) => `<tr>
    <td>${item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}</td>
    <td>${html(item.inviter?.name ?? "—")} <div class="muted">${html(item.inviter?.phone ?? "")}</div></td>
    <td>${html(item.invitee?.name ?? "—")} <div class="muted">${html(item.invitee?.phone ?? "")}</div></td>
    <td><span class="pill ${item.source === "CODE" ? "indigo" : "gray"}">${item.source === "CODE" ? "专属邀请码" : "短信"}</span></td>
    <td><span class="pill ${item.status === "REWARDED" ? "green" : item.status === "ATTENDED" ? "blue" : item.status === "REGISTERED" ? "indigo" : "gold"}">${REFERRAL_STATUS_LABELS[item.status] ?? item.status}</span></td>
    <td>${html(item.inviteCode ?? "—")}</td>
  </tr>`).join("");
}

function updateInviteKpis() {
  const kpiCards = document.querySelectorAll<HTMLElement>("#inviteKpiGrid .kpi-card__value");
  const stats = state.data?.inviteStats ?? { total: 0, registered: 0, attended: 0, rewarded: 0 };
  const values = [stats.total, stats.attended, stats.rewarded];
  kpiCards.forEach((el, i) => {
    if (i < values.length) el.textContent = String(values[i]);
  });
  // 更新海报状态 KPI
  const posterKpi = document.querySelector<HTMLElement>("#inviteKpiPoster .kpi-card__value");
  if (posterKpi) {
    const poster = state.data?.sharePoster;
    posterKpi.textContent = poster?.hasImage ? "已上传" : "未上传";
    posterKpi.style.fontSize = "16px";
    posterKpi.style.lineHeight = "1.4";
  }
}

function bindPosterEditor() {
  // 文本字段：实时同步 + 预览
  const textIds: Array<[string, keyof PosterTemplateData]> = [
    ["peTitle", "title"],
    ["peSubtitle", "subtitle"],
    ["peSlogan", "slogan"],
    ["peContact", "contact"]
  ];
  for (const [id, key] of textIds) {
    const el = document.querySelector<HTMLInputElement>(`#${id}`);
    if (!el) continue;
    // 输入时只更新 state，不重绘；失焦时才重绘
    el.addEventListener("input", () => {
      state.posterDraft = { ...state.posterDraft, [key]: el.value };
    });
    el.addEventListener("change", () => {
      void redrawPosterPreview();
    });
  }

  // 邀请码底部横幅开关
  const inviteCodeToggle = document.querySelector<HTMLInputElement>("#peInviteCodeVisible");
  if (inviteCodeToggle) {
    inviteCodeToggle.addEventListener("change", () => {
      state.posterDraft = { ...state.posterDraft, inviteCodeVisible: inviteCodeToggle.checked };
      void redrawPosterPreview();
    });
  }

  // 图片字段：FileReader → draft → 预览
  const fileBindings: Array<[string, keyof PosterTemplateData]> = [
    ["peBgFile", "bgImageBase64"],
    ["peLogoFile", "logoBase64"],
    ["pePhotoFile", "photoBase64"],
    ["peProductFile", "productBase64"]
  ];
  for (const [id, key] of fileBindings) {
    const el = document.querySelector<HTMLInputElement>(`#${id}`);
    if (!el) continue;
    // 选择文件 → 更新 draft + 重绘
    el.addEventListener("change", () => {
      const file = el.files?.[0];
      if (!file) return;
      if (!/^image\/(png|jpe?g)$/i.test(file.type)) {
        showToast("仅支持 JPG/PNG 格式", "error");
        el.value = "";
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast("图片不能超过 5MB", "error");
        el.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        state.posterDraft = { ...state.posterDraft, [key]: dataUrl };
        void redrawPosterPreview();
      };
      reader.onerror = () => showToast("读取图片失败", "error");
      reader.readAsDataURL(file);
    });
  }

  // 清除图片按钮
  document.querySelectorAll<HTMLButtonElement>(".poster-clear-btn").forEach((btn) => {
    const fileId = btn.dataset.fileid!;
    const key = btn.dataset.key as keyof PosterTemplateData;
    const hintEl = document.querySelector<HTMLElement>(`#hint-${fileId}`);
    // 初始状态
    btn.disabled = !state.posterDraft[key];
    if (hintEl) hintEl.style.display = state.posterDraft[key] ? "" : "none";

    btn.addEventListener("click", () => {
      if (!key) return;
      state.posterDraft = { ...state.posterDraft, [key]: undefined };
      // 清空 file input
      const fileInput = document.querySelector<HTMLInputElement>(`#${fileId}`);
      if (fileInput) fileInput.value = "";
      // 更新按钮状态
      btn.disabled = true;
      if (hintEl) hintEl.style.display = "none";
      void redrawPosterPreview();
    });
  });

  // 图片选择后更新清除按钮状态
  for (const [id, key] of fileBindings) {
    const fileInput = document.querySelector<HTMLInputElement>(`#${id}`);
    if (!fileInput) continue;
    // 除了已有的 change 监听（在之前的 for 循环），再加一个状态更新
    fileInput.addEventListener("change", () => {
      // 延迟等 FileReader 完成
      window.setTimeout(() => {
        const clearBtn = document.querySelector<HTMLButtonElement>(`#clear-${id}`) as HTMLButtonElement | null;
        const hintEl = document.querySelector<HTMLElement>(`#hint-${id}`);
        const hasVal = !!state.posterDraft[key];
        if (clearBtn) clearBtn.disabled = !hasVal;
        if (hintEl) hintEl.style.display = hasVal ? "" : "none";
      }, 200);
    });
  }

  // 保存：渲染 canvas → 调 API
  document.querySelector<HTMLButtonElement>("#peSaveBtn")?.addEventListener("click", (event) => {
    const btn = event.currentTarget as HTMLButtonElement;
    return withLoading(btn, async () => {
      const tpl = state.posterDraft;
      if (!tpl.title?.trim()) { showToast("请填写主标题", "error"); return; }
      if (!tpl.contact?.trim()) { showToast("请填写联系方式（地址/电话）", "warn"); }
      const canvas = document.querySelector<HTMLCanvasElement>("#posterCanvas");
      if (!canvas) { showToast("找不到预览画布", "error"); return; }
      // 确保画的是最新 draft
      try { await drawPosterOnCanvas(canvas, tpl); } catch { /* fall through */ }
      const rendered = canvas.toDataURL("image/png");
      await call("/api/clinic/share-poster", {
        title: tpl.title,
        imageBase64: rendered,
        templateData: tpl
      }, "海报已保存", "PUT");
      await loadInvites();
    });
  });

  // 删除（模板模式）
  document.querySelector<HTMLButtonElement>("#peArchiveBtn")?.addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: "删除海报",
      message: "确定要删除当前海报吗？删除后患者端将立即看不到。",
      okText: "确定删除",
      danger: true
    });
    if (!ok) return;
    try {
      await api("/api/clinic/share-poster", { method: "DELETE" });
      state.posterImageBase64 = null;
      state.posterTemplate = null;
      state.posterDraft = { ...EMPTY_POSTER_TEMPLATE };
      await loadInvites();
      showToast("海报已删除", "success");
    } catch (error: any) {
      showToast(error?.message ?? "删除失败", "error");
    }
  });

  // 简单上传模式
  bindSimplePoster();
}

function bindSimplePoster() {
  // 模式切换按钮
  document.querySelector<HTMLButtonElement>("#posterModeTemplate")?.addEventListener("click", () => {
    state.posterMode = "template";
    renderApp();
  });
  document.querySelector<HTMLButtonElement>("#posterModeSimple")?.addEventListener("click", () => {
    state.posterMode = "simple";
    renderApp();
  });

  // 文件选择预览
  const simpleFile = document.querySelector<HTMLInputElement>("#simplePosterFile");
  if (simpleFile) {
    simpleFile.addEventListener("change", () => {
      const file = simpleFile.files?.[0];
      if (!file) return;
      if (!/^image\/(png|jpe?g)$/i.test(file.type)) {
        showToast("仅支持 JPG/PNG 格式", "error");
        simpleFile.value = "";
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast("图片不能超过 5MB", "error");
        simpleFile.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        state.posterImageBase64 = String(reader.result);
        // 增量更新预览区域，不整页刷新
        const previewWrap = document.querySelector<HTMLElement>("#simplePosterPreview");
        if (previewWrap) {
          previewWrap.classList.remove("invite-poster-preview--empty");
          previewWrap.innerHTML = `<img id="simplePosterImg" src="${html(state.posterImageBase64!)}" alt="海报预览" />`;
        }
        // 更新按钮文案
        const saveBtn = document.querySelector<HTMLButtonElement>("#simplePosterSaveBtn");
        if (saveBtn) saveBtn.textContent = "替换海报";
        const archiveBtn = document.querySelector<HTMLButtonElement>("#simplePosterArchiveBtn");
        if (archiveBtn) archiveBtn.disabled = false;
      };
      reader.onerror = () => showToast("读取图片失败", "error");
      reader.readAsDataURL(file);
    });
  }

  // 保存
  document.querySelector<HTMLButtonElement>("#simplePosterSaveBtn")?.addEventListener("click", (event) => {
    const btn = event.currentTarget as HTMLButtonElement;
    return withLoading(btn, async () => {
      const title = (document.querySelector<HTMLInputElement>("#simplePosterTitle")?.value ?? "").trim();
      if (!state.posterImageBase64) { showToast("请先选择图片", "error"); return; }
      await call("/api/clinic/share-poster", {
        title: "门店海报",
        imageBase64: state.posterImageBase64,
        templateData: undefined
      }, "海报已保存", "PUT");
      await loadInvites();
    });
  });

  // 删除
  document.querySelector<HTMLButtonElement>("#simplePosterArchiveBtn")?.addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: "删除海报",
      message: "确定要删除当前海报吗？删除后患者端将立即看不到。",
      okText: "确定删除",
      danger: true
    });
    if (!ok) return;
    try {
      await api("/api/clinic/share-poster", { method: "DELETE" });
      state.posterImageBase64 = null;
      // 增量更新预览回到空态
      const previewWrap = document.querySelector<HTMLElement>("#simplePosterPreview");
      if (previewWrap) {
        previewWrap.classList.add("invite-poster-preview--empty");
        previewWrap.innerHTML = `<div>暂无海报<br><small>上传 JPG / PNG<br>最大 5 MB</small></div>`;
      }
      const saveBtn = document.querySelector<HTMLButtonElement>("#simplePosterSaveBtn");
      if (saveBtn) saveBtn.textContent = "上传海报";
      const archiveBtn = document.querySelector<HTMLButtonElement>("#simplePosterArchiveBtn");
      if (archiveBtn) archiveBtn.disabled = true;
      await loadInvites();
      showToast("海报已删除", "success");
    } catch (error: any) {
      showToast(error?.message ?? "删除失败", "error");
    }
  });
}

function bindActions() {
  // 通知中心：点 .notif-wrap 外部自动关闭。只在第一次进入时注册 document click 监听，
  // 现有 notifBtn / notif-item / notifClose 都已 event.stopPropagation()，不会误触。
  if (!notifOutsideClickBound) {
    notifOutsideClickBound = true;
    document.addEventListener("click", (event) => {
      if (!state.notifOpen) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest(".notif-wrap")) return;
      state.notifOpen = false;
      renderApp();
    });
  }
  document.querySelector<HTMLFormElement>("#clinicKnowledgeSearchFormV2")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    return withFormLoading(form, async () => {
      state.knowledgeSearchLoading = true;
      try {
        const formData = new FormData(form);
        const patientId = String(formData.get("patientId") ?? "").trim();
        const response = await api<{ plan: any }>("/api/clinic/cervical-treatment-agent", {
          method: "POST",
          bodyJson: {
            ...(patientId ? { patientId } : {}),
            inputText: state.knowledgeSearchQueryText ?? String(formData.get("query") ?? ""),
            attachments: mergedKnowledgeSearchAttachments()
          }
        });
        const patient = state.data?.patients.find((item) => item.id === patientId);
        state.cervicalPlanDraft = response.plan;
        state.knowledgeSearchAnswer = response.plan?.draft;
        state.knowledgeSearchContext = {
          patientName: patient?.name ?? "未关联患者方案",
          recordCount: knowledgeSearchHistoryFiles().length,
          symptomCount: "-",
          menstrualCount: "-",
          treatmentCount: "-",
          attachmentCount: mergedKnowledgeSearchAttachments().length
        };
        state.knowledgeSearchView = "overview";
        await loadCervicalPlans(patientId);
        showToast(`已生成 ${(response.plan?.draft?.planOptions ?? []).length || 1} 套治疗方案`, "success");
      } catch (error: any) {
        showToast(error.message || "治疗方案生成失败", "error");
      } finally {
        state.knowledgeSearchLoading = false;
        renderApp();
      }
    });
  });
  document.querySelector<HTMLSelectElement>("#knowledgeSearchPatientSelect")?.addEventListener("change", async (event) => {
    const select = event.currentTarget as HTMLSelectElement;
    const patientId = select.value;
    state.knowledgeSearchSelectedPatientId = patientId;
    state.knowledgeSearchQueryText = "";
    state.knowledgeSearchLocalAttachments = [];
    state.knowledgeSearchSelectedHistoryUrls = [];
    state.knowledgeSearchHistoryFiles = [];
    state.cervicalPlanDraft = undefined;
    state.knowledgeSearchAnswer = undefined;
    state.knowledgeSearchContext = undefined;
    if (patientId) {
      await loadKnowledgeSearchHistory(patientId);
    } else {
      renderApp();
    }
  });
  document.querySelector<HTMLTextAreaElement>("#knowledgeSearchQueryInput")?.addEventListener("input", (event) => {
    state.knowledgeSearchQueryText = (event.currentTarget as HTMLTextAreaElement).value;
  });
  document.querySelector<HTMLInputElement>("#knowledgeLocalImages")?.addEventListener("change", async (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    try {
      for (const file of files) {
        if (mergedKnowledgeSearchAttachments().length >= 6) throw new Error("图片和报告最多选择 6 份");
        state.knowledgeSearchLocalAttachments = [...knowledgeSearchLocalAttachments(), await uploadFile(file, file.name)];
      }
      renderApp();
    } catch (error: any) {
      showToast(error.message || "图片上传失败", "error");
    } finally {
      input.value = "";
    }
  });
  document.querySelector<HTMLInputElement>("#knowledgeLocalReports")?.addEventListener("change", async (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    try {
      for (const file of files) {
        if (mergedKnowledgeSearchAttachments().length >= 6) throw new Error("图片和报告最多选择 6 份");
        state.knowledgeSearchLocalAttachments = [...knowledgeSearchLocalAttachments(), await uploadFile(file, file.name)];
      }
      renderApp();
    } catch (error: any) {
      showToast(error.message || "报告上传失败", "error");
    } finally {
      input.value = "";
    }
  });
  document.querySelectorAll<HTMLButtonElement>("[data-remove-knowledge-local]").forEach((button) => {
    button.onclick = () => {
      state.knowledgeSearchLocalAttachments = knowledgeSearchLocalAttachments().filter((item) => item.url !== button.dataset.removeKnowledgeLocal);
      renderApp();
    };
  });
  document.querySelectorAll<HTMLInputElement>("[data-knowledge-history-url]").forEach((input) => {
    input.addEventListener("change", () => {
      const url = input.dataset.knowledgeHistoryUrl!;
      const selected = new Set(knowledgeSearchSelectedHistoryUrls());
      if (input.checked) {
        if (mergedKnowledgeSearchAttachments().length >= 6) {
          input.checked = false;
          showToast("图片和报告最多选择 6 份", "error");
          return;
        }
        selected.add(url);
      } else {
        selected.delete(url);
      }
      state.knowledgeSearchSelectedHistoryUrls = Array.from(selected);
      renderApp();
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-knowledge-view-v2]").forEach((button) => {
    button.onclick = () => {
      if (button.disabled) return;
      state.knowledgeSearchView = button.dataset.knowledgeViewV2 as typeof state.knowledgeSearchView;
      renderApp();
    };
  });
  document.querySelector<HTMLFormElement>("#clinicKnowledgeSearchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    return withFormLoading(form, async () => {
      state.knowledgeSearchLoading = true;
      try {
        const formData = new FormData(form);
        const images = Array.from((form.elements.namedItem("images") as HTMLInputElement | null)?.files ?? []);
        const reports = Array.from((form.elements.namedItem("reports") as HTMLInputElement | null)?.files ?? []);
        if (images.length > 3 || reports.length > 3) throw new Error("宫颈图片和 PDF 报告单各最多上传 3 份");
        const response = await api<{ answer: any; contextSummary: any; attachments: any[] }>("/api/clinic/knowledge-search", {
          method: "POST",
          body: formData
        });
        state.knowledgeSearchAnswer = response.answer;
        state.knowledgeSearchContext = response.contextSummary;
        state.knowledgeSearchView = "overview";
        showToast(`已读取 ${response.attachments?.length ?? 0} 个附件并生成方案，引用 ${response.answer?.citations?.length ?? 0} 条知识依据`, "success");
      } catch (error: any) {
        showToast(error.message || "医学知识查询失败", "error");
      } finally {
        state.knowledgeSearchLoading = false;
        renderApp();
      }
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-knowledge-view]").forEach((button) => {
    button.onclick = () => {
      if (button.disabled) return;
      state.knowledgeSearchView = button.dataset.knowledgeView as typeof state.knowledgeSearchView;
      renderApp();
    };
  });
  document.querySelector<HTMLFormElement>("#medicalQaForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    return withFormLoading(form, async () => {
      state.medicalQaLoading = true;
      try {
        const formData = new FormData(form);
        state.medicalQaAnswer = await api("/api/clinic/medical-qa", {
          method: "POST",
          bodyJson: { question: formData.get("question") }
        });
        showToast("医学回答已生成", "success");
      } catch (error: any) {
        showToast(error.message || "医学问答失败", "error");
      } finally {
        state.medicalQaLoading = false;
        renderApp();
      }
    });
  });
  document.querySelector<HTMLFormElement>("#medicalQaFormV2")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    return withFormLoading(form, async () => {
      state.medicalQaLoading = true;
      try {
        const formData = new FormData(form);
        const imageFiles = Array.from((form.elements.namedItem("images") as HTMLInputElement | null)?.files ?? []).slice(0, 3);
        const reportFiles = Array.from((form.elements.namedItem("reports") as HTMLInputElement | null)?.files ?? []).slice(0, 3);
        const attachments = [];
        for (const file of [...imageFiles, ...reportFiles]) attachments.push(await uploadFile(file, file.name));
        state.medicalQaAnswer = await api("/api/clinic/medical-qa", {
          method: "POST",
          bodyJson: {
            question: formData.get("question"),
            patientId: formData.get("patientId"),
            attachments
          }
        });
        showToast("医学回答已生成", "success");
      } catch (error: any) {
        showToast(error.message || "医学问答失败", "error");
      } finally {
        state.medicalQaLoading = false;
        renderApp();
      }
    });
  });
  document.querySelector<HTMLFormElement>("#cervicalAgentForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    return withFormLoading(form, async () => {
      state.cervicalAgentLoading = true;
      try {
        const formData = new FormData(form);
        const files = Array.from((form.elements.namedItem("reports") as HTMLInputElement | null)?.files ?? []).slice(0, 3);
        const attachments = [];
        for (const file of files) attachments.push(await uploadFile(file, file.name));
        const response = await api<{ plan: any }>("/api/clinic/cervical-treatment-agent", {
          method: "POST",
          bodyJson: { patientId: formData.get("patientId"), inputText: formData.get("inputText"), attachments }
        });
        state.cervicalPlanDraft = response.plan;
        await loadCervicalPlans();
        showToast("方案草稿已生成，请医生审核", "success");
      } catch (error: any) {
        showToast(error.message || "方案生成失败", "error");
      } finally {
        state.cervicalAgentLoading = false;
        renderApp();
      }
    });
  });
  document.querySelector<HTMLFormElement>("#cervicalReviewForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
    return withFormLoading(form, async () => {
      const draft = structuredClone(state.cervicalPlanDraft?.draft ?? {});
      draft.doctorReviewNote = String(new FormData(form).get("doctorReviewNote") ?? "");
      const response = await api<{ plan: any }>("/api/clinic/cervical-treatment-agent", {
        method: "PATCH",
        bodyJson: { id: new FormData(form).get("id"), status: submitter?.value ?? "DRAFT", draft }
      });
      state.cervicalPlanDraft = response.plan;
      await loadCervicalPlans();
      showToast(response.plan.status === "APPROVED" ? "方案已由医生确认" : "审核备注已保存", "success");
      renderApp();
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-cervical-plan]").forEach((button) => {
    button.onclick = () => {
      state.cervicalPlanDraft = state.cervicalPlans.find((plan) => plan.id === button.dataset.cervicalPlan);
      renderApp();
    };
  });
  document.querySelectorAll<HTMLButtonElement>("[data-cervical-plan-word]").forEach((button) => {
    button.onclick = async () => {
      try {
        await downloadCervicalPlanWord(button.dataset.cervicalPlanWord ?? "");
        showToast("Word 文档已开始下载", "success");
      } catch (error: any) {
        showToast(error.message || "Word 文档导出失败", "error");
      }
    };
  });
  // 邀请管理：海报上传 / 归档
  // CRM 患者搜索
  const crmSearch = document.querySelector<HTMLInputElement>("#crmSearch");
  if (crmSearch) {
    crmSearch.addEventListener("input", () => {
      const q = crmSearch.value.toLowerCase().trim();
      document.querySelectorAll<HTMLTableRowElement>("#crmTable tbody tr").forEach((row) => {
        const hay = row.dataset.search ?? "";
        row.style.display = !q || hay.includes(q) ? "" : "none";
      });
    });
  }

  // 模板化海报编辑器
  bindPosterEditor();

  document.querySelector<HTMLButtonElement>("#notifBtn")?.addEventListener("click", async (event) => {
    event.stopPropagation();
    state.notifOpen = !state.notifOpen;
    if (state.notifOpen) {
      const data = await api<{ messages: any[]; unread: number }>("/api/clinic/messages?limit=30").catch(() => ({ messages: [], unread: 0 }));
      state.notifications = data.messages;
      state.unread = data.unread;
    }
    renderApp();
  });
  document.querySelector<HTMLButtonElement>("#notifClose")?.addEventListener("click", (event) => {
    event.stopPropagation();
    state.notifOpen = false;
    renderApp();
  });
  document.querySelector<HTMLButtonElement>("#notifReadAll")?.addEventListener("click", (event) => {
    const btn = event.currentTarget as HTMLButtonElement;
    return withLoading(btn, async () => {
      await call("/api/clinic/messages/read-all", {}, "已全部标记为已读", "POST");
      const data = await api<{ messages: any[]; unread: number }>("/api/clinic/messages?limit=30");
      state.notifications = data.messages;
      state.unread = data.unread;
      renderApp();
    });
  });
  document.querySelectorAll<HTMLElement>("[data-notif]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      return withLoading(el, async () => {
        const id = el.dataset.notif!;
        state.activeNotification = state.notifications.find((message) => message.id === id);
        await call(`/api/clinic/messages/${id}/read`, {}, "已标记为已读", "POST");
        const data = await api<{ messages: any[]; unread: number }>("/api/clinic/messages?limit=30");
        state.notifications = data.messages;
        state.unread = data.unread;
        renderApp();
      });
    });
  });
  document.querySelectorAll<HTMLElement>("[data-close-message-detail]").forEach((element) => {
    element.onclick = () => { state.activeNotification = undefined; renderApp(); };
  });
  document.querySelectorAll<HTMLButtonElement>("[data-appt]").forEach((button) => {
    button.onclick = () => withLoading(button, () => call("/api/clinic/appointments", { appointmentId: button.dataset.appt, status: button.dataset.status }, "预约状态已更新", "PATCH"));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-enrollment]").forEach((button) => {
    button.onclick = () => withLoading(button, () => call("/api/clinic/enrollments", { enrollmentId: button.dataset.enrollment, status: button.dataset.enrollmentStatus }, "线索状态已更新", "PATCH"));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-follow]").forEach((button) => {
    button.onclick = () => withLoading(button, () => call("/api/clinic/followups", { followUpId: button.dataset.follow, note: "门店已完成随访", notify: true }, "随访已完成", "PATCH"));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-template]").forEach((button) => {
    button.onclick = () => withLoading(button, () => call("/api/clinic/campaigns/adopt", { templateId: button.dataset.template }, "活动已采用，患者端可见"));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-campaign-archive]").forEach((button) => {
    button.onclick = async () => {
      const id = button.dataset.campaignArchive!;
      const ok = await confirmDialog({
        title: "下架活动",
        message: "下架后该活动将立即从患者端首页移除（已报名的患者不受影响，可继续跟进）。确定下架？",
        okText: "确定下架",
        danger: true
      });
      if (!ok) return;
      return withLoading(button, () => call(`/api/clinic/campaigns/${encodeURIComponent(id)}`, { status: "已下架" }, "已下架，患者端不再展示", "PATCH"));
    };
  });
  document.querySelectorAll<HTMLButtonElement>("[data-campaign-reactivate]").forEach((button) => {
    button.onclick = () => withLoading(button, () => call(`/api/clinic/campaigns/${encodeURIComponent(button.dataset.campaignReactivate!)}`, { status: "进行中" }, "已重新上架", "PATCH"));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-task]").forEach((button) => {
    const taskId = button.dataset.task!;
    button.onclick = () => {
      const noteInput = document.querySelector<HTMLInputElement>(`[data-task-note="${taskId}"]`);
      const note = noteInput?.value?.trim();
      return withLoading(button, () => call("/api/clinic/tasks", { taskId, note: note || undefined }, "任务完成情况已回传总部", "PATCH"));
    };
  });
  document.querySelectorAll<HTMLInputElement>("[data-task-note]").forEach((input) => {
    input.oninput = () => {
      state.taskNoteDraft[input.dataset.taskNote!] = input.value;
    };
  });
  document.querySelectorAll<HTMLSelectElement>("#taskStatusFilter").forEach((sel) => {
    sel.onchange = () => {
      state.taskFilter.status = sel.value as "all" | "PENDING" | "DONE";
      renderApp();
    };
  });
  document.querySelectorAll<HTMLSelectElement>("#taskPriorityFilter").forEach((sel) => {
    sel.onchange = () => {
      state.taskFilter.priority = sel.value as "all" | "URGENT" | "HIGH" | "NORMAL" | "LOW";
      renderApp();
    };
  });
  document.querySelectorAll<HTMLButtonElement>("[data-adopt-task-template]").forEach((button) => {
    button.onclick = () => withLoading(button, () => call("/api/clinic/task-templates", { templateId: button.dataset.adoptTaskTemplate }, "已采纳为待办，可在「待办中心」查看", "POST"));
  });
  document.querySelector<HTMLFormElement>("#patientForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    return withFormLoading(form, () => call("/api/clinic/patients", Object.fromEntries(new FormData(form)), "患者已登记"));
  });
  document.querySelector<HTMLFormElement>("#purchaseForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const body = Object.fromEntries(new FormData(form));
    return withFormLoading(form, () => call("/api/clinic/purchases", { ...body, quantity: Number(body.quantity || 1) || 1 }, "购买已记录，复查券和随访已生成"));
  });
  document.querySelector<HTMLFormElement>("#followScheduleForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    return withFormLoading(form, () => call("/api/clinic/followups", { ...Object.fromEntries(new FormData(form)), notify: true }, "随访已创建并通知患者"));
  });
  document.querySelector<HTMLFormElement>("#treatmentCreateForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const raw = Object.fromEntries(new FormData(form));
    return withFormLoading(form, () => call("/api/clinic/treatments", { ...raw, periodNotApplicable: raw.periodNotApplicable === "true" }, "疗程已生成并同步患者端"));
  });
  document.querySelector<HTMLSelectElement>("[data-treatment-patient-filter]")?.addEventListener("change", (event) => {
    state.treatmentPatientId = (event.currentTarget as HTMLSelectElement).value;
    state.treatmentDraftPatientId = state.treatmentPatientId;
    renderApp();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-treatment-feedback-patient]").forEach((button) => {
    button.onclick = () => {
      state.treatmentPatientId = button.dataset.treatmentFeedbackPatient!;
      state.treatmentDraftPatientId = state.treatmentPatientId;
      renderApp();
    };
  });
  document.querySelectorAll<HTMLButtonElement>("[data-new-treatment-for]").forEach((button) => {
    button.onclick = () => {
      state.treatmentPatientId = button.dataset.newTreatmentFor!;
      state.treatmentDraftPatientId = button.dataset.newTreatmentFor!;
      renderApp();
      document.querySelector<HTMLDetailsElement>(".treatment-create-panel")?.setAttribute("open", "");
      document.querySelector(".treatment-create-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
  });
  document.querySelectorAll<HTMLButtonElement>("[data-complete-treatment-session]").forEach((button) => {
    button.onclick = () => withLoading(button, () => call("/api/clinic/treatments", { treatmentId: button.dataset.treatmentId, sessionId: button.dataset.completeTreatmentSession, status: "COMPLETED" }, "本次疗程执行已完成", "PATCH"));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-reschedule-treatment-session]").forEach((button) => {
    button.onclick = () => {
      const value = document.querySelector<HTMLInputElement>(`[data-treatment-date="${button.dataset.rescheduleTreatmentSession}"]`)?.value;
      return withLoading(button, () => call("/api/clinic/treatments", { treatmentId: button.dataset.treatmentId, sessionId: button.dataset.rescheduleTreatmentSession, plannedAt: value, status: "PLANNED" }, "疗程日期已调整并同步患者", "PATCH"));
    };
  });
  document.querySelectorAll<HTMLButtonElement>("[data-resolve-treatment-feedback]").forEach((button) => {
    button.onclick = () => withLoading(button, () => call("/api/clinic/treatments", { treatmentId: button.dataset.treatmentId, feedbackId: button.dataset.resolveTreatmentFeedback, resolution: "医生已联系患者并完成处理" }, "患者反馈已处理", "PATCH"));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-adopt-template]").forEach((button) => {
    button.onclick = () => withLoading(button, () => call("/api/clinic/articles", { sourceTemplateId: button.dataset.adoptTemplate, status: "PUBLISHED" }, "已采用总部模板并发布到本店患者端"));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-article-status]").forEach((button) => {
    button.onclick = () => withLoading(button, () => toggleArticleStatus(button));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-article-archive]").forEach((button) => {
    button.onclick = () => deleteArticleRow(button);
  });

  // AI 一键生成：仅把生成结果填到对应 form 字段，提示词不会被提交
  type AiField = { name: string };
  function bindAiPanel(panelId: string, formId: string, fields: AiField[], fetcher: (prompt: string) => Promise<Record<string, string | undefined>>) {
    const panel = document.querySelector<HTMLDivElement>(`#${panelId}`);
    if (!panel) return;
    const promptEl = panel.querySelector<HTMLTextAreaElement>("[data-ai-prompt]");
    const btn = panel.querySelector<HTMLButtonElement>("[data-ai-generate]");
    const statusEl = panel.querySelector<HTMLSpanElement>("[data-ai-status]");
    if (!promptEl || !btn || !statusEl) return;
    btn.addEventListener("click", () => withLoading(btn, async () => {
      const prompt = promptEl.value.trim();
      if (!prompt) {
        statusEl.textContent = "请输入提示词";
        statusEl.classList.add("ai-panel__status--error");
        return;
      }
      statusEl.classList.remove("ai-panel__status--error");
      statusEl.textContent = "AI 正在生成，请稍候…";
      try {
        const copy = await fetcher(prompt);
        const form = document.querySelector<HTMLFormElement>(`#${formId}`);
        let filled = 0;
        for (const field of fields) {
          const value = copy[field.name];
          if (!value) continue;
          const input = form?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${field.name}"]`);
          if (!input) continue;
          input.value = value;
          filled += 1;
        }
        statusEl.textContent = filled > 0 ? `已填入 ${filled} 个字段，可继续编辑后再发布` : "AI 未返回可填入的字段";
        showToast("AI 文案已生成，请检查后发布", "success");
      } catch (error: any) {
        statusEl.textContent = error?.message ?? "生成失败";
        statusEl.classList.add("ai-panel__status--error");
        showToast(error?.message ?? "AI 生成失败", "error");
      }
    }));
  }

  bindAiPanel(
    "aiArticlePanel",
    "articleCreateForm",
    [
      { name: "title" },
      { name: "category" },
      { name: "summary" },
      { name: "content" }
    ],
    async (prompt) => {
      const res = await generateArticleCopy({ prompt });
      return res.copy as Record<string, string | undefined>;
    }
  );

  bindAiPanel(
    "aiMarketingPanel",
    "marketingPostCreateForm",
    [
      { name: "title" },
      { name: "subtitle" },
      { name: "introText" },
      { name: "bodyText" },
      { name: "benefits" },
      { name: "activityInfo" },
      { name: "notes" }
    ],
    async (prompt) => {
      // 营销类型取自表单当前的 select，未选时默认 PROMOTION
      const form = document.querySelector<HTMLFormElement>("#marketingPostCreateForm");
      const type = (form?.querySelector<HTMLSelectElement>('[name="type"]')?.value ?? "PROMOTION") as "ANNOUNCEMENT" | "PROMOTION" | "ACTIVITY";
      const res = await generateMarketingPostCopy({ prompt, type });
      return res.copy as Record<string, string | undefined>;
    }
  );

  // 文章/营销稿图片字段：本地选文件 → 上传至 /api/uploads → 写入 URL 到 hidden input
  document.querySelectorAll<HTMLInputElement>("[data-image-input]").forEach((fileInput) => {
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
        showToast("仅支持 JPG/PNG/WebP/GIF 格式", "error");
        fileInput.value = "";
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast("图片不能超过 5MB", "error");
        fileInput.value = "";
        return;
      }
      const hiddenName = fileInput.dataset.hiddenName!;
      const hidden = fileInput.closest("label")?.querySelector<HTMLInputElement>(`input[type="hidden"][name="${hiddenName}"]`);
      const hint = document.querySelector<HTMLElement>(`#hint-${fileInput.id}`);
      const preview = document.querySelector<HTMLElement>(`#preview-${fileInput.id}`);
      if (hint) hint.textContent = "上传中…";
      try {
        const res = await uploadFile(file, file.name);
        if (hidden) hidden.value = res.url;
        if (preview) {
          preview.style.display = "";
          preview.querySelector("img")?.remove();
          preview.insertAdjacentHTML("afterbegin", `<img src="${html(res.url)}" alt="已上传图片预览" />`);
        }
        if (hint) {
          hint.textContent = `已上传：${file.name}（${Math.round(file.size / 1024)} KB）`;
        }
      } catch (err: any) {
        showToast(err?.message || "上传失败", "error");
        fileInput.value = "";
        if (preview) preview.style.display = "none";
      }
    });
  });

  document.querySelector<HTMLFormElement>("#articleCreateForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    return withFormLoading(form, () => call("/api/clinic/articles", Object.fromEntries(new FormData(form)), "文章已发布到本店患者端"));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-marketing-adopt]").forEach((button) => {
    button.onclick = () => withLoading(button, () => call("/api/clinic/marketing-posts", { sourcePostId: button.dataset.marketingAdopt, status: "PUBLISHED" }, "已采用总部营销模板并推送到本店患者"));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-marketing-status]").forEach((button) => {
    button.onclick = () => withLoading(button, () => toggleMarketingStatus(button));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-marketing-archive]").forEach((button) => {
    button.onclick = () => deleteMarketingRow(button);
  });
  document.querySelector<HTMLFormElement>("#marketingPostCreateForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    return withFormLoading(form, () => call("/api/clinic/marketing-posts", Object.fromEntries(new FormData(form)), "营销稿已发布到本店患者端"));
  });
}

// 表格行内更新：在 PATCH/DELETE 成功后只改这一行（或移除这一行）的 DOM，
// 不再触发 load() → renderApp()，避免误触「转草稿/归档」时把「原创健康科普」或
// 「原创营销推送」表单里正在输入的内容一并清空。
function findRow(attr: string, value: string) {
  const buttons = document.querySelectorAll<HTMLButtonElement>(`[data-${attr}]`);
  for (const btn of buttons) {
    if (btn.dataset[attrToCamel(attr)] === value) {
      return btn.closest("tr");
    }
  }
  return null;
}

function attrToCamel(attr: string) {
  return attr.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * 在某行把按钮"目标状态/文案"翻转成新状态对应的样子；
 * 状态列在 0=title,1=category,2=summary,3=status 处。
 */
function paintStatusRow(row: HTMLTableRowElement, statusCellIndex: number, statusLabel: string, newStatus: string, toggleButton: HTMLButtonElement) {
  const statusCell = row.cells[statusCellIndex];
  if (statusCell) statusCell.textContent = statusLabel;
  const nextTarget = newStatus === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
  toggleButton.dataset.target = nextTarget;
  toggleButton.textContent = newStatus === "PUBLISHED" ? "转草稿" : "转发布";
}

function replaceRowWithEmptyState(row: HTMLTableRowElement, tbody: HTMLTableSectionElement, colspan: number) {
  row.parentElement?.removeChild(row);
  if (tbody.children.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="muted">暂无数据</td></tr>`;
  }
}

async function toggleArticleStatus(button: HTMLButtonElement) {
  const articleId = button.dataset.articleStatus!;
  const newStatus = button.dataset.target!;
  try {
    state.error = undefined;
    const result = await api<{ article: any }>(`/api/clinic/articles/${encodeURIComponent(articleId)}`, {
      method: "PATCH",
      bodyJson: { status: newStatus }
    });
    if (state.data?.clinicArticles) {
      const idx = state.data.clinicArticles.findIndex((a: any) => a.id === articleId);
      if (idx >= 0) state.data.clinicArticles[idx] = { ...state.data.clinicArticles[idx], ...result.article };
    }
    const row = findRow("article-status", articleId);
    if (row) {
      paintStatusRow(row, 3, labelOf(ARTICLE_STATUS_LABELS, newStatus, "草稿"), newStatus, button);
    }
    showToast("文章状态已更新", "success");
  } catch (error: any) {
    showToast(error.message, "error");
  }
}

async function deleteArticleRow(button: HTMLButtonElement) {
  const articleId = button.dataset.articleArchive!;
  const ok = await confirmDialog({
    title: "删除文章",
    message: "确定要删除这篇文章吗？删除后患者端将立即看不到。",
    okText: "确定删除",
    danger: true
  });
  if (!ok) return;
  try {
    state.error = undefined;
    await api(`/api/clinic/articles/${encodeURIComponent(articleId)}`, { method: "DELETE" });
    if (state.data?.clinicArticles) {
      state.data.clinicArticles = state.data.clinicArticles.filter((a: any) => a.id !== articleId);
    }
    const row = findRow("article-archive", articleId);
    if (row) {
      const tbody = row.parentElement as HTMLTableSectionElement | null;
      if (tbody) replaceRowWithEmptyState(row, tbody, 6);
    }
    showToast("文章已删除", "success");
  } catch (error: any) {
    showToast(error.message, "error");
  }
}

async function toggleMarketingStatus(button: HTMLButtonElement) {
  const postId = button.dataset.marketingStatus!;
  const newStatus = button.dataset.target!;
  try {
    state.error = undefined;
    const result = await api<{ marketingPost: any }>(`/api/clinic/marketing-posts/${encodeURIComponent(postId)}`, {
      method: "PATCH",
      bodyJson: { status: newStatus }
    });
    if (state.data?.clinicMarketingPosts) {
      const idx = state.data.clinicMarketingPosts.findIndex((p: any) => p.id === postId);
      if (idx >= 0) state.data.clinicMarketingPosts[idx] = { ...state.data.clinicMarketingPosts[idx], ...result.marketingPost };
    }
    const row = findRow("marketing-status", postId);
    if (row) {
      paintStatusRow(row, 3, labelOf(MARKETING_POST_STATUS_LABELS, newStatus, "草稿"), newStatus, button);
    }
    showToast("营销稿状态已更新", "success");
  } catch (error: any) {
    showToast(error.message, "error");
  }
}

async function deleteMarketingRow(button: HTMLButtonElement) {
  const postId = button.dataset.marketingArchive!;
  const ok = await confirmDialog({
    title: "删除营销稿",
    message: "确定要删除这条营销稿吗？删除后患者端将立即看不到。",
    okText: "确定删除",
    danger: true
  });
  if (!ok) return;
  try {
    state.error = undefined;
    await api(`/api/clinic/marketing-posts/${encodeURIComponent(postId)}`, { method: "DELETE" });
    if (state.data?.clinicMarketingPosts) {
      state.data.clinicMarketingPosts = state.data.clinicMarketingPosts.filter((p: any) => p.id !== postId);
    }
    const row = findRow("marketing-archive", postId);
    if (row) {
      const tbody = row.parentElement as HTMLTableSectionElement | null;
      if (tbody) replaceRowWithEmptyState(row, tbody, 6);
    }
    showToast("营销稿已删除", "success");
  } catch (error: any) {
    showToast(error.message, "error");
  }
}

async function call(path: string, body: unknown, message: string, method = "POST") {
  try {
    state.error = undefined;
    await api(path, { method, bodyJson: body });
    showToast(message, "success");
    if (state.active === "invites") {
      // 邀请管理 tab：增量刷新，不重建 DOM
      await loadInvites();
    } else {
      await load();
    }
  } catch (error: any) {
    showToast(error.message, "error");
  }
}

function realtimeRenderAllowed() {
  const tag = (document.activeElement?.tagName ?? "").toLowerCase();
  return !["input", "textarea", "select"].includes(tag) && !state.activeNotification;
}

async function refreshClinicRealtime() {
  if (!state.data || document.hidden || !realtimeRenderAllowed()) return;
  try {
    const [messages, treatmentData] = await Promise.all([
      api<{ messages: any[]; unread: number }>("/api/clinic/messages?limit=30"),
      api<{ treatments: any[]; templates: any[] }>("/api/clinic/treatments")
    ]);
    const before = `${state.unread}:${state.notifications[0]?.id ?? ""}:${state.data.treatments?.map((item) => `${item.id}:${item.status}:${item.feedbacks?.length ?? 0}`).join("|")}`;
    const after = `${messages.unread}:${messages.messages[0]?.id ?? ""}:${treatmentData.treatments.map((item) => `${item.id}:${item.status}:${item.feedbacks?.length ?? 0}`).join("|")}`;
    if (before === after) return;
    state.notifications = messages.messages;
    state.unread = messages.unread;
    state.data.treatments = treatmentData.treatments;
    state.data.treatmentTemplates = treatmentData.templates;
    renderApp();
  } catch {
    // Keep the current screen usable if a background refresh fails.
  }
}

load().then(() => window.setInterval(refreshClinicRealtime, 5000)).catch(() => renderLogin());
