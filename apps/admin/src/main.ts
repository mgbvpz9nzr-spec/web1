import "../../shared/styles.css";
import { API_BASE_URL, api, generateArticleCopy, generateMarketingPostCopy, loginWithPassword, logout, money, withFormLoading, withLoading } from "../../shared/api";
import { confirmDialog } from "../../shared/confirm";

type MarketingStats = {
  total: number;
  published: number;
  byType: Record<string, number>;
  byClinic: Array<{ id: string; name: string; city: string; total: number; published: number }>;
};
type ArticleStats = {
  total: number;
  byCategory: Record<string, number>;
  byClinic: Array<{ id: string; name: string; city: string; total: number; byCategory: Record<string, number> }>;
};
type ClinicUserCount = { clinicId: string; clinicName: string; city: string; userCount: number; patientCount: number };
type InactiveClinic = { clinicId: string; name: string; city: string; status: string; level: string; daysSinceLastLogin: number | null; daysSinceLastActivity: number | null; danger: "normal" | "warning" | "danger" };
type HealthScore = { clinicId: string; name: string; city: string; score: number; trend: "up" | "stable" | "down" };

type Dashboard = {
  company: any;
  admin: any;
  metrics: Record<string, number>;
  agentMetrics?: {
    agentCount: number;
    activeAgentCount: number;
    newClinicsLast30d: number;
    totalSalesByAgent: number;
    monthSalesByAgent: number;
    totalEnrollmentsByAgent: number;
    monthEnrollmentsByAgent: number;
    avgRevenuePerAgent: number;
    unassignedSummary?: { clinicCount: number; activeClinicCount: number } | null;
  };
  agentBreakdown?: Array<{
    id: string;
    name: string;
    adminRole: string;
    phone: string;
    managedCities: string[];
    province: string;
    status: string;
    clinicCount: number;
    activeClinicCount: number;
    newClinicsLast30d: number;
    totalSales: number;
    monthSales: number;
    totalEnrollments: number;
    monthEnrollments: number;
    converted: number;
    conversionRate: number;
    lastActiveAt: string | null;
  }>;
  clinics: any[];
  users: any[];
  campaignTemplates: any[];
  campaigns: any[];
  drugKits: any[];
  operationTasks: any[];
  taskProgress: any[];
  packagePurchases: any[];
  auditLogs: any[];
  funnel: Array<{
    campaignId: string;
    title: string;
    clinicId?: string;
    total: number;
    breakdown: Record<string, number>;
    conversionRate: number;
  }>;
  marketingStats: MarketingStats;
  articleStats: ArticleStats;
  clinicUserCounts: ClinicUserCount[];
  inactiveClinics: InactiveClinic[];
  healthScore: HealthScore[];
};

type ResourceKey = "clinics" | "users" | "kits" | "tasks" | "taskTemplates" | "templates" | "articles" | "marketingPosts" | "purchases";

type AgentRow = {
  id: string;
  name: string;
  adminRole: string;
  phone: string;
  managedCities: string[];
  province: string;
  status: string;
  clinicCount: number;
  activeClinicCount: number;
  newClinicsLast30d: number;
  totalSales: number;
  monthSales: number;
  totalEnrollments: number;
  monthEnrollments: number;
  converted: number;
  conversionRate: number;
  lastActiveAt: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
};

type AgentDetail = {
  agent: AgentRow;
  monthly: Array<{ month: string; sales: number; enrollments: number; newClinics: number; conversionRate: number }>;
  clinics: Array<{ id: string; name: string; city: string; status: string; createdAt: string }>;
};

type AdminCityRow = { id: string; name: string; province: string; district?: string; status?: string };
type RegionCityOption = { name: string; districts: string[] };
type RegionGroup = { name: string; cities: RegionCityOption[] };

type NotifHistoryItem = {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: string;
};
type FieldKind = "text" | "number" | "textarea" | "select" | "tags" | "checklist" | "cascade" | "business-hours";

type Field = {
  name: string;
  label: string;
  kind?: FieldKind;
  required?: boolean;
  full?: boolean;
  options?: () => Array<{ value: string; label: string }>;
  createOnly?: boolean;
  // 仅当 item 的 role 为 PLATFORM_ADMIN 时才显示此字段
  showAdminOnly?: boolean;
  // 仅当 item 的 role 不为 PLATFORM_ADMIN 时才显示此字段
  showNonAdminOnly?: boolean;
  // 字段默认值（创建时无 item 时使用）
  defaultValue?: string | string[];
  // cascade 类型：province / city / district
  cascade?: "province" | "city" | "district";
  // 字段下方辅助说明（仅创建时显示，除非 createOnlyHint=false）
  hint?: string;
  hintAlways?: boolean;
};

type ResourceConfig = {
  key: ResourceKey;
  label: string;
  title: string;
  subtitle: string;
  endpoint: string;
  listKey: string;
  createMethod?: "POST" | "PATCH";
  deleteLabel?: string;
  importEndpoint?: string;
  importClinicEndpoint?: string;
  dispatchEndpoint?: string;
  dispatchStatus?: string;
  columns: ResourceColumn[];
  fields: Field[];
};

type ResourceColumn = { label: string; value: (item: any) => string };

type DrawerState = {
  resource: ResourceKey;
  mode: "create" | "edit";
  item?: any;
};

const root = document.querySelector<HTMLDivElement>("#app")!;

type DispatchPayload = {
  taskDispatches: Array<{
    id: string;
    title: string;
    category: string;
    priority: string;
    status: string;
    dueAt?: string;
    targetClinics: number;
    completedClinics: number;
    pendingClinics: number;
    completionRate: number;
    lateCount: number;
    createdAt: string;
    recipients: Array<{ clinicId: string; clinicName: string; phone: string; status: string; completedAt?: string; overdue: boolean }>;
  }>;
  templateDispatches: Array<{
    id: string;
    title: string;
    category: string;
    status: string;
    targetClinics: number;
    version: number;
    enrollments: { total: number; NEW: number; CONTACTED: number; ATTENDED: number; CONVERTED: number; CANCELLED: number };
    conversionRate: number;
  }>;
  marketingDispatches: Array<{
    id: string;
    title: string;
    type: string;
    sourcePostId?: string;
    adoptedClinics: number;
    publishedClinics: number;
    pushedClinics: number;
    createdAt: string;
    pushedAt?: string;
  }>;
  summary: {
    taskCount: number;
    taskAvgCompletion: number;
    taskOverdue: number;
    templateCount: number;
    templateTotalEnrollments: number;
    marketingTemplateCount: number;
    marketingAdoptedTotal: number;
  };
};

const state: {
  active: string;
  workspaceTabs: Array<{ key: string; label: string }>;
  sidebarScrollTop: number;
  workspaceScrollLeft: number;
  subTab: string;
  data?: Dashboard;
  resources: Partial<Record<ResourceKey, any[]>>;
  administrativeCities: AdminCityRow[];
  administrativeRegions: RegionGroup[];
  drawer?: DrawerState;
  message?: string;
  error?: string;
  query: string;
  clinicFilter: string;
  statusFilter: string;
  notifOpen: boolean;
  notifications: any[];
  unread: number;
  sidebarOpen: Record<string, boolean>;
  accountTab: "platform" | "province" | "city" | "clinic";
  selectedUserIds: string[];
  selectedResourceIds: Partial<Record<ResourceKey, string[]>>;
  batchMenuOpen: boolean;
  clinicCityFilter: string;
  clinicDetailId?: string;
  clinicDetail?: { clinic: any; firstUser: any; stats: any };
  dispatch?: DispatchPayload;
  dispatchDetail?: { title: string; recipients: DispatchPayload["taskDispatches"][number]["recipients"] };
  reports?: ReportPayload;
  reportsCityFilter?: string;
  reportsFrom?: string;
  reportsTo?: string;
  reportsQuery: string;
  reportsRiskFilter: "ALL" | "ATTENTION" | "CRITICAL" | "HEALTHY";
  reportsSort: "sales" | "conversion" | "tasks" | "patients" | "risk";
  loginHistory?: Array<{ id: string; userId?: string; userName?: string; userPhone?: string; action: string; ip?: string; createdAt: string }>;
  agents?: AgentRow[];
  knowledgeDocuments?: any[];
  knowledgeBases?: any[];
  selectedKnowledgeBaseId?: string;
  knowledgeDocumentEditor?: any;
  knowledgeSearchResults?: any[];
  knowledgeSearchMode?: "single" | "all";
  agentsLoading?: boolean;
  agentDetailLoading?: boolean;
  agentDetail?: AgentDetail;
  notifDraft: { title: string; content: string; targetType: "AGENTS_ALL" | "CLINICS_ALL" | "ALL_USERS" | "SELECTED_USERS"; userIds: string[]; broadcastSelf: boolean; includePatients: boolean; sendTo: "clinic" | "agent"; scope: "ALL" | "SELECTED"; clinicIds: string[]; agentIds: string[] };
  notifAudience?: { canBroadcastAllUsers: boolean; counts: { agents: number; clinics: number; selectableUsers: number }; selectableUsers: any[] };
  activeNotification?: any;
  notifHistory: NotifHistoryItem[];
  toasts: Array<{ id: number; text: string; kind: "info" | "success" | "error" | "warn" }>;
} = {
  active: "overview",
  workspaceTabs: [{ key: "overview", label: "数据看板" }],
  sidebarScrollTop: 0,
  workspaceScrollLeft: 0,
  subTab: "dashboard",
  resources: {},
  administrativeCities: [],
  administrativeRegions: [],
  query: "",
  notifOpen: false,
  notifications: [],
  unread: 0,
  clinicFilter: "",
  statusFilter: "",
  reportsCityFilter: "",
  reportsFrom: "",
  reportsTo: "",
  reportsQuery: "",
  reportsRiskFilter: "ALL",
  reportsSort: "risk",
  sidebarOpen: { overview: true, clinics: true, content: true, tasks: true, system: true },
  accountTab: "clinic",
  selectedUserIds: [],
  selectedResourceIds: {},
  batchMenuOpen: false,
  clinicCityFilter: "",
  notifDraft: { title: "", content: "", targetType: "CLINICS_ALL", userIds: [], broadcastSelf: true, includePatients: false, sendTo: "clinic", scope: "ALL", clinicIds: [], agentIds: [] },
  notifHistory: [],
  toasts: []
};

// 顶层板块 4 个：运营总览 / 终端诊所 / 总部任务 / 审计日志
// 每个顶层板块内挂 sub-tab，sub-tab 才是真正渲染的 ResourceKey
const SUB_TABS: Record<string, Array<{ key: string; label: string }>> = {
  overview: [
    { key: "dashboard", label: "数据看板" },
    { key: "reports", label: "经营汇总" }
  ],
  clinics: [
    { key: "clinics", label: "终端诊所" },
    { key: "users", label: "账号管理" },
    { key: "kits", label: "产品包" },
    { key: "templates", label: "活动模板" },
    { key: "articles", label: "科普文章" },
    { key: "marketingPosts", label: "营销推送" }
  ],
  tasks: [
    { key: "tasks", label: "任务下发" },
    { key: "taskTemplates", label: "任务模板" },
    { key: "dispatch", label: "下发追踪" }
  ],
  audit: []
};

const DEFAULT_SUB_TABS: Record<string, string> = {
  overview: "dashboard",
  clinics: "clinics",
  tasks: "tasks",
  audit: ""
};

// 侧边栏 5 大板块分组。active key 与之前保持兼容，权限过滤沿用同一规则。
// permKey 用来对齐后端 admin-scope.ts 里的 MenuPermission（coarse-grained key）。
interface SidebarItem {
  key: string;
  label: string;
  permKey?: string; // 菜单权限里的 key，默认 = key
}
interface SidebarSection {
  id: string;
  label: string;
  icon: string;
  defaultOpen: boolean;
  items: SidebarItem[];
}

const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    id: "overview",
    label: "运营总览",
    icon: "📊",
    defaultOpen: true,
    items: [{ key: "overview", label: "数据看板", permKey: "dashboard" }]
  },
  {
    id: "clinics",
    label: "终端诊所",
    icon: "🏥",
    defaultOpen: true,
    items: [
      { key: "clinics", label: "终端诊所", permKey: "clinics" },
      { key: "users", label: "账号管理", permKey: "accounts" }
    ]
  },
  {
    id: "content",
    label: "内容与营销",
    icon: "📢",
    defaultOpen: true,
    items: [
      { key: "templates", label: "活动模板", permKey: "marketing" },
      { key: "articles", label: "科普文章", permKey: "marketing" },
      { key: "marketingPosts", label: "营销推送", permKey: "marketing" },
      { key: "knowledgeBase", label: "医学知识库", permKey: "marketing" },
      { key: "kits", label: "产品包", permKey: "marketing" }
    ]
  },
  {
    id: "tasks",
    label: "任务与监控",
    icon: "📋",
    defaultOpen: true,
    items: [
      { key: "tasks", label: "总部任务", permKey: "tasks" },
      { key: "taskTemplates", label: "任务模板", permKey: "tasks" },
      { key: "reports", label: "经营汇总", permKey: "analytics" },
      { key: "purchases", label: "采购订单", permKey: "purchases" },
      { key: "dispatch", label: "下发追踪", permKey: "tasks" }
    ]
  },
  {
    id: "system",
    label: "系统",
    icon: "🔐",
    defaultOpen: false,
    items: [
      { key: "notifications", label: "消息下发", permKey: "dashboard" },
      { key: "agents", label: "代理账号", permKey: "clinics" },
      { key: "audit", label: "审计日志", permKey: "audit" }
    ]
  }
];

// 过滤一个 section 的 items：按 menuPermissions 白名单裁剪
function visibleItemsOf(section: SidebarSection): SidebarItem[] {
  const perms = state.data?.admin?.menuPermissions as string[] | undefined;
  if (!perms || perms.length === 0) return section.items;
  return section.items.filter((item) => {
    const expected = item.permKey ?? item.key;
    return perms.includes(expected);
  });
}

// 当前登录管理员的 adminRole（规范化后）
function currentAdminRole(): "NATIONAL_ADMIN" | "PROVINCE_ADMIN" | "CITY_ADMIN" | null {
  const role = state.data?.admin?.adminRole;
  if (role === "NATIONAL_ADMIN" || role === "PROVINCE_ADMIN" || role === "CITY_ADMIN") return role;
  // 兜底：如果 state 没拿到 adminRole，从 user 推
  if (state.data?.admin?.role === "PLATFORM_ADMIN") return "NATIONAL_ADMIN";
  return null;
}

// 当前管理员的省份（PROVINCE_ADMIN 用）
function currentAdminProvince(): string | null {
  const cities = (state.data?.admin?.cityIds ?? state.data?.admin?.managedCities ?? []) as string[];
  if (cities.length === 0) return null;
  const first = cities[0];
  return provinceByCityName(first) ?? null;
}

// 当前管理员的辖区城市列表
function currentAdminCities(): string[] {
  return ((state.data?.admin?.cityIds ?? state.data?.admin?.managedCities ?? []) as string[]) ?? [];
}

// 当前激活项所在的 section id
function activeSectionId(): string | null {
  for (const section of SIDEBAR_SECTIONS) {
    if (section.items.some((item) => item.key === state.active)) return section.id;
  }
  return null;
}

// 渲染侧边栏：分 5 大板块，可折叠；当前 active 所在板块自动展开
function renderSidebar(): string {
  return SIDEBAR_SECTIONS.map((section) => {
    const items = visibleItemsOf(section);
    if (items.length === 0) return "";
    const isActiveSection = section.id === activeSectionId();
    // 当前 active 项展开 / 板块默认展开 / 用户手动展开过
    const isOpen = isActiveSection || state.sidebarOpen[section.id] || false;
    const cls = `sidebar-section ${isOpen ? "is-open" : ""}`.trim();
    return `
      <div class="${cls}" data-section="${section.id}">
        <button class="sidebar-section__head" data-toggle-section="${section.id}" type="button">
          <span><span class="sidebar-section__icon">${section.icon}</span> ${section.label}</span>
          <span class="sidebar-section__caret">▶</span>
        </button>
        <div class="sidebar-section__items">
          ${items.map((item) => `<button type="button" data-tab="${item.key}" class="${state.active === item.key ? "active" : ""}">${item.label}</button>`).join("")}
        </div>
      </div>`;
  }).join("");
}

// 当前页对应的板块（面包屑用）
function pageSection(): SidebarSection | null {
  for (const section of SIDEBAR_SECTIONS) {
    if (section.items.some((item) => item.key === state.active)) return section;
  }
  return null;
}

// 当前页的标题/副标题/面包屑
function pageMeta(): { title: string; subtitle: string; section: SidebarSection | null } {
  const section = pageSection();
  if (state.active === "overview") {
    return { title: "数据看板", subtitle: "总部视角的关键经营指标和动态", section };
  }
  if (state.active === "reports") {
    return { title: "经营汇总", subtitle: "按终端诊所聚合经营数据，识别活跃门店与潜在风险", section };
  }
  if (state.active === "audit") {
    return { title: "审计日志", subtitle: "记录总部对终端诊所、账号、产品包和任务的关键操作", section };
  }
  if (state.active === "notifications") {
    return { title: "消息下发", subtitle: "向所辖范围的代理账号（省级/市级）/ 终端诊所发送通知，可选同步留存总部", section };
  }
  if (state.active === "agents") {
    return { title: "代理账号管理", subtitle: "省级 / 市级代理账号档案、销售与推广统计、月度走势", section };
  }
  if (state.active === "knowledgeBase") {
    return { title: "医学知识库", subtitle: "管理宫颈疾病指南、专家共识与内部诊疗规范，供医生端方案智能体检索引用", section };
  }
  if (state.active === "users") {
    if (state.accountTab === "platform") return { title: "账号管理 · 管辖区域", subtitle: "查看和管理账号所辖区域", section };
    if (state.accountTab === "province") return { title: "账号管理 · 省级账号", subtitle: "管理所辖省份的省级管理员账号", section };
    if (state.accountTab === "city") return { title: "账号管理 · 地市账号", subtitle: "管理所辖地市的城市管理员账号", section };
    return { title: "账号管理 · 门店账号", subtitle: "管理终端诊所的医生、前台、店长账号", section };
  }
  const config = configs[state.active as ResourceKey];
  if (config) return { title: config.title, subtitle: config.subtitle, section };
  return { title: state.active, subtitle: "", section };
}

// 面包屑
function renderBreadcrumb(): string {
  const section = pageSection();
  const meta = pageMeta();
  if (!section) {
    return `<div class="breadcrumb"><span>首页</span><span class="breadcrumb__sep">/</span><span class="breadcrumb__current">${html(meta.title)}</span></div>`;
  }
  return `
    <div class="breadcrumb">
      <button data-tab="overview">首页</button>
      <span class="breadcrumb__sep">/</span>
      <span>${html(section.label)}</span>
      <span class="breadcrumb__sep">/</span>
      <span class="breadcrumb__current">${html(meta.title)}</span>
    </div>`;
}

// 统一页面头：面包屑 + 标题 + 副标题 + 右侧操作区
function renderPageHeader(actionsHtml = ""): string {
  const meta = pageMeta();
  return `
    ${renderBreadcrumb()}
    <div class="page-header">
      <div class="page-header__main">
        <h2 class="page-title">${html(meta.title)}</h2>
        <p class="page-sub">${html(meta.subtitle)}</p>
      </div>
      <div class="page-actions">${actionsHtml}</div>
    </div>`;
}

// 账号管理 4 个子 tab：总部 / 省级 / 地市 / 门店
// 可见性按当前 admin 层级裁剪：比自己高的 tab 直接隐藏
function renderAccountSubTabs(): string {
  const allUsers = state.resources.users ?? [];
  const role = currentAdminRole();
  const counts = {
    platform: allUsers.filter((u) => u.role === "PLATFORM_ADMIN" && u.adminRole === "NATIONAL_ADMIN").length,
    province: allUsers.filter((u) => u.role === "PLATFORM_ADMIN" && u.adminRole === "PROVINCE_ADMIN").length,
    city: allUsers.filter((u) => u.role === "PLATFORM_ADMIN" && (u.adminRole ?? "CITY_ADMIN") === "CITY_ADMIN").length,
    clinic: allUsers.filter((u) => u.role !== "PLATFORM_ADMIN").length
  };
  const allTabs: Array<{ key: "platform" | "province" | "city" | "clinic"; label: string; count: number }> = [
    { key: "platform", label: "管辖区域", count: counts.platform },
    { key: "province", label: "省级账号", count: counts.province },
    { key: "city", label: "地市账号", count: counts.city },
    { key: "clinic", label: "门店账号", count: counts.clinic }
  ];
  // 层级裁剪：NATIONAL 全部可见，PROVINCE 隐藏 platform+province，CITY 只剩 clinic
  const tabs = allTabs.filter((t) => {
    if (role === "NATIONAL_ADMIN") return true;
    if (role === "PROVINCE_ADMIN") return t.key === "city" || t.key === "clinic";
    if (role === "CITY_ADMIN") return t.key === "clinic";
    return t.key === "clinic"; // 非 admin
  });
  // 自动纠正：当前 tab 被裁掉时落到第一个可见 tab
  if (!tabs.find((t) => t.key === state.accountTab)) {
    state.accountTab = tabs[0]?.key ?? "clinic";
  }
  return `<div class="subtabs">${tabs.map((t) => `<button data-account-tab="${t.key}" class="${state.accountTab === t.key ? "active" : ""}">${t.label} <span class="muted">(${t.count})</span></button>`).join("")}</div>`;
}

function getActiveResourceKey(): ResourceKey | null {
  if (state.subTab === "dashboard" || state.subTab === "reports" || state.subTab === "dispatch") return null;
  return state.subTab as ResourceKey;
}

function html(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
}

function badge(value: unknown, tone = "") {
  return `<span class="pill ${tone}">${html(value || "-")}</span>`;
}

// 内容/营销 scope 派发范围标签：NATIONAL=全国、PROVINCE=省、CITY=市
const SCOPE_LEVEL_LABELS: Record<string, string> = {
  NATIONAL: "全国",
  PROVINCE: "省级",
  CITY: "地市"
};

const SCOPE_OWNER_LABELS: Record<string, string> = {
  NATIONAL_ADMIN: "总部",
  PROVINCE_ADMIN: "省级",
  CITY_ADMIN: "地市"
};

function scopeBadge(scopeLevel: unknown, scopeProvince?: string | null, scopeCity?: string | null) {
  const level = (scopeLevel as string) ?? "NATIONAL";
  const label = SCOPE_LEVEL_LABELS[level] ?? level;
  const tone = level === "NATIONAL" ? "gold" : level === "PROVINCE" ? "blue" : "muted";
  const detail = level === "PROVINCE" ? scopeProvince : level === "CITY" ? scopeCity : null;
  return badge(detail ? `${label}·${detail}` : label, tone);
}

function scopeOwnerBadge(createdByAdminRole: unknown) {
  if (!createdByAdminRole) return "";
  const label = SCOPE_OWNER_LABELS[createdByAdminRole as string] ?? createdByAdminRole;
  return `<span class="pill muted" style="margin-left:8px" title="派发方">${html(label)}发布</span>`;
}

// 镜像后端 canViewContent / canEditContent / canCreateContent 的前端版
// 用于：禁用编辑/删除按钮 + 显示只读标识 + 控制「下发」按钮
const KNOWLEDGE_SOURCE_TYPE_OPTIONS = [
  { value: "GUIDELINE", label: "临床指南" },
  { value: "CONSENSUS", label: "专家共识" },
  { value: "PRODUCT_MANUAL", label: "产品资料" },
  { value: "RULE", label: "规则边界" },
  { value: "COURSE_TEMPLATE", label: "疗程模板" },
  { value: "INTERVENTION", label: "综合干预" },
  { value: "CASE", label: "病例资料" },
  { value: "REPORT", label: "检查报告" },
  { value: "DOCUMENT", label: "通用文档" },
  { value: "LITERATURE", label: "医学文献" }
] as const;

const KNOWLEDGE_MODALITY_OPTIONS = [
  { value: "TEXT", label: "文本资料" },
  { value: "REPORT", label: "报告资料" },
  { value: "TABLE", label: "结构化表格" },
  { value: "IMAGE_CASE", label: "影像病例" }
] as const;

const KNOWLEDGE_REVIEW_STATUS_OPTIONS = [
  { value: "PENDING", label: "待审核" },
  { value: "APPROVED", label: "审核通过" },
  { value: "REJECTED", label: "审核不通过" }
] as const;

const KNOWLEDGE_STATUS_OPTIONS = [
  { value: "DRAFT", label: "草稿" },
  { value: "PUBLISHED", label: "已发布" },
  { value: "ARCHIVED", label: "已归档" }
] as const;

const KNOWLEDGE_COMPOSITE_STRATEGY_OPTIONS = [
  { value: "single_primary", label: "保留主文档" },
  { value: "split_recommended", label: "自动分片归类" }
] as const;

function getCurrentAdmin() {
  return state.data?.admin ?? null;
}

function isPlatformAdmin(): boolean {
  const admin = getCurrentAdmin();
  return Boolean(admin && admin.role === "PLATFORM_ADMIN");
}

function getAdminRole(): string | null {
  const admin: any = getCurrentAdmin();
  return admin?.adminRole ?? null;
}

function getManagedCities(): string[] {
  const admin: any = getCurrentAdmin();
  if (!admin) return [];
  return admin.cityIds?.length ? admin.cityIds : (admin.managedCities ?? []);
}

function getActorProvince(): string | null {
  const admin: any = getCurrentAdmin();
  if (!admin) return null;
  if (admin.province) return admin.province;
  const cities = getManagedCities();
  if (cities.length === 0) return null;
  return provinceByCityName(cities[0]) ?? null;
}

function canViewContentFrontend(item: any): boolean {
  const admin: any = getCurrentAdmin();
  if (!admin || admin.role !== "PLATFORM_ADMIN") return false;
  const level = item?.scopeLevel ?? "NATIONAL";
  if (level === "NATIONAL") return true;
  if (admin.adminRole === "NATIONAL_ADMIN") return true;
  if (admin.adminRole === "PROVINCE_ADMIN") {
    const actorProvince = getActorProvince();
    if (!actorProvince) return false;
    if (level === "PROVINCE") return item?.scopeProvince === actorProvince;
    if (level === "CITY") {
      return provinceByCityName(item?.scopeCity ?? "") === actorProvince;
    }
  }
  if (admin.adminRole === "CITY_ADMIN") {
    const cities = new Set(getManagedCities());
    if (level === "CITY") return cities.has(item?.scopeCity ?? "");
  }
  return false;
}

function canEditContentFrontend(item: any): boolean {
  const admin: any = getCurrentAdmin();
  if (!admin || admin.role !== "PLATFORM_ADMIN") return false;
  // 总部：所有内容都可改/删（放在最前，避免其它分支误判）
  if (admin.adminRole === "NATIONAL_ADMIN") return true;
  const level = item?.scopeLevel ?? "NATIONAL";
  // 诊所专属：要求 clinic 在 admin 辖区（kits/templates/articles/marketingPosts 中以 clinicId 表示）
  if (item?.clinicId) {
    const clinic = currentClinics().find((c) => c.id === item.clinicId);
    return Boolean(clinic);
  }
  // 创建者本人 + 仍在自己可管辖的范围内
  if (item?.createdByAdminId && item.createdByAdminId === admin.id) {
    if (admin.adminRole === "PROVINCE_ADMIN") {
      const actorProvince = getActorProvince();
      if (!actorProvince) return false;
      if (level === "PROVINCE") return item?.scopeProvince === actorProvince;
      if (level === "CITY") {
        return provinceByCityName(item?.scopeCity ?? "") === actorProvince;
      }
    }
    if (admin.adminRole === "CITY_ADMIN") {
      const cities = new Set(getManagedCities());
      if (level === "CITY") return cities.has(item?.scopeCity ?? "");
    }
  }
  // 省级：可改本省非自己创建的省级内容
  if (admin.adminRole === "PROVINCE_ADMIN") {
    const actorProvince = getActorProvince();
    if (!actorProvince) return false;
    if (level === "PROVINCE" && item?.scopeProvince === actorProvince) return true;
  }
  return false;
}

function canCreateContentFrontend(): boolean {
  const admin: any = getCurrentAdmin();
  if (!admin || admin.role !== "PLATFORM_ADMIN") return false;
  return true; // 任何 PLATFORM_ADMIN 都可创建；后端会按角色自动锁定 scope
}

function canPromoteToNational(item: any): boolean {
  // 总部可将 PROVINCE/CITY 内容提升为全国推送
  if (getAdminRole() !== "NATIONAL_ADMIN") return false;
  const level = item?.scopeLevel ?? "NATIONAL";
  return level === "PROVINCE" || level === "CITY";
}

async function promoteContentToNational(resource: ResourceKey, item: any) {
  const config = configs[resource];
  if (!config?.endpoint) return;
  const ok = await confirmDialog({
    title: "提升为全国推送",
    message: `确定将「${item.title}」提升为全国推送吗？省级和地市将只能只读浏览。`
  });
  if (!ok) return;
  try {
    const result = await api<{ message?: string }>(config.endpoint, {
      method: "PATCH",
      bodyJson: { id: item.id, scopeLevel: "NATIONAL", scopeProvince: null, scopeCity: null }
    });
    showToast(result?.message ?? "已提升为全国推送", "success");
    await loadResource(resource);
  } catch (err: any) {
    showToast(err?.message ?? "提升失败", "error");
  } finally {
    renderApp();
  }
}

let statusDismissTimer: ReturnType<typeof setTimeout> | undefined;

function status() {
  if (!state.message && !state.error) return "";
  // 自动消失：成功提示 3 秒后清除，错误提示由用户关闭（点击）
  if (state.message && !statusDismissTimer) {
    statusDismissTimer = setTimeout(() => {
      state.message = undefined;
      statusDismissTimer = undefined;
      renderApp();
    }, 3000);
  }
  // 浮层定位：position:fixed 避免状态条出现/消失时撑动主内容区
  return `<div class="status ${state.error ? "error" : ""}" data-dismiss-status style="position:fixed;top:80px;right:24px;z-index:200;max-width:420px;box-shadow:0 8px 24px rgba(15,42,51,.18)">${html(state.error ?? state.message)}${state.error ? ` <a href="#" data-dismiss-status-link style="margin-left:8px">关闭</a>` : ""}</div>`;
}

// ─── Toast 通知（自建，admin 此前无 toast 基建，showToast 引用是 ReferenceError）───
let toastSeq = 0;

// 通知中心点外关闭：bindActions 每次 render 都会执行，用 flag 防止重复注册 document click
let notifOutsideClickBound = false;

function showToast(text: string, kind: "info" | "success" | "error" | "warn" = "info", ttlMs = 3000) {
  const id = ++toastSeq;
  state.toasts.push({ id, text, kind });
  renderToastWrap();
  setTimeout(() => {
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

function compactDateTime(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("zh-CN", { hour12: false });
}

function sortCn(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function buildRegionsFromCities(rows: AdminCityRow[]): RegionGroup[] {
  const provinceMap = new Map<string, Map<string, Set<string>>>();
  for (const row of rows) {
    if (row.status === "INACTIVE") continue;
    const province = String(row.province ?? "").trim();
    const city = String(row.name ?? "").trim();
    const district = String(row.district ?? "").trim();
    if (!province || !city) continue;
    if (!provinceMap.has(province)) provinceMap.set(province, new Map());
    const cityMap = provinceMap.get(province)!;
    if (!cityMap.has(city)) cityMap.set(city, new Set());
    if (district) cityMap.get(city)!.add(district);
  }
  return sortCn(Array.from(provinceMap.keys())).map((province) => {
    const cityMap = provinceMap.get(province)!;
    return {
      name: province,
      cities: sortCn(Array.from(cityMap.keys())).map((city) => ({
        name: city,
        districts: sortCn(Array.from(cityMap.get(city) ?? []))
      }))
    };
  });
}

function regions() {
  return state.administrativeRegions;
}

function getCitiesByProvince(province: string) {
  return regions().find((region) => region.name === province)?.cities.map((city) => city.name) ?? [];
}

function getDistrictsByCity(city: string) {
  const districts: string[] = [];
  for (const region of regions()) {
    for (const candidate of region.cities) {
      if (candidate.name === city) districts.push(...candidate.districts);
    }
  }
  return sortCn(districts);
}

function currentClinics() {
  return state.resources.clinics ?? state.data?.clinics ?? [];
}

function clinicName(id?: string) {
  return currentClinics().find((item) => item.id === id)?.name ?? "总部";
}

async function loadClinicDetail(id: string) {
  const result = await api<{ clinic: any; firstUser: any; stats: any; error?: string }>(`/api/admin/clinics/${encodeURIComponent(id)}`);
  if (result.error) { state.error = result.error; return; }
  state.clinicDetail = result;
}

async function loadAdministrativeRegions() {
  const result = await api<{ cities: AdminCityRow[] }>("/api/admin/cities");
  state.administrativeCities = result.cities ?? [];
  state.administrativeRegions = buildRegionsFromCities(state.administrativeCities);
}

function renderClinicDetail() {
  const d = state.clinicDetail!;
  const c = d.clinic;
  const u = d.firstUser;
  const s = d.stats;
  const healthSignals = [
    { label: "账号配置", ok: s.userCount > 0, detail: s.userCount > 0 ? `${s.userCount} 个启用账号` : "暂无启用账号" },
    { label: "线索转化", ok: s.enrollmentCount < 3 || s.conversionRate >= 20, detail: s.enrollmentCount ? `${s.conversionRate}% 转化率` : "暂无转化样本" },
    { label: "任务执行", ok: s.taskTotal === 0 || s.taskCompletionRate >= 70, detail: s.taskTotal ? `${s.taskDone}/${s.taskTotal} 已完成` : "暂无总部任务" },
    { label: "门店状态", ok: c.status === "ACTIVE", detail: labelOf(CLINIC_STATUS_LABELS, c.status) }
  ];
  const healthyCount = healthSignals.filter((item) => item.ok).length;
  const healthScore = Math.round((healthyCount / healthSignals.length) * 100);
  const healthTone = healthScore >= 75 ? "green" : healthScore >= 50 ? "gold" : "rose";
  const healthLabel = healthScore >= 75 ? "经营稳定" : healthScore >= 50 ? "需要跟进" : "重点处置";
  const conversionWidth = Math.max(0, Math.min(100, s.conversionRate));
  const taskWidth = Math.max(0, Math.min(100, s.taskCompletionRate));
  return `
    ${renderPageHeader(`<button data-back-to-clinics class="secondary">返回经营台账</button>`)}
    <section class="clinic-dossier">
      <div class="clinic-dossier__hero">
        <div class="clinic-dossier__identity">
          <div class="clinic-dossier__mark">${html(String(c.name || "门店").slice(0, 1))}</div>
          <div>
            <div class="clinic-dossier__tags">${badge(c.level, "gold")}${badge(labelOf(CLINIC_STATUS_LABELS, c.status), c.status === "ACTIVE" ? "green" : "rose")}</div>
            <h2>${html(c.name)}</h2>
            <p>${html(c.city)}${c.district ? ` · ${html(c.district)}` : ""} · ${html(c.owner || "未设置负责人")} · ${html(c.phone || "未设置电话")}</p>
          </div>
        </div>
        <div class="clinic-dossier__health">
          <span>经营健康度</span>
          <strong>${healthScore}</strong>
          ${badge(healthLabel, healthTone)}
        </div>
      </div>
      <div class="clinic-dossier__metrics">
        <div><span>累计销售</span><strong>${money(s.purchaseAmount)}</strong><small>${s.purchaseCount} 笔成交</small></div>
        <div><span>月度销售</span><strong>${money(c.monthlySales)}</strong><small>当前门店月度汇总</small></div>
        <div><span>患者规模</span><strong>${s.patientCount}</strong><small>${c.activePatients ?? 0} 位活跃患者</small></div>
        <div><span>线索转化</span><strong>${s.conversionRate}%</strong><small>${s.convertedCount}/${s.enrollmentCount} 已成交</small></div>
        <div><span>任务完成</span><strong>${s.taskCompletionRate}%</strong><small>${s.taskDone}/${s.taskTotal} 已完成</small></div>
        <div><span>活动数量</span><strong>${s.campaignCount}</strong><small>${s.userCount} 个启用账号</small></div>
      </div>
    </section>
    <section class="clinic-dossier-grid">
      <div class="clinic-dossier-panel clinic-dossier-panel--wide">
        <div class="clinic-dossier-panel__head"><div><span>管理诊断</span><h3>经营状态判断</h3></div>${badge(`${healthyCount}/${healthSignals.length} 项正常`, healthTone)}</div>
        <div class="clinic-health-list">${healthSignals.map((item) => `<div class="clinic-health-item clinic-health-item--${item.ok ? "good" : "risk"}"><span>${item.ok ? "正常" : "关注"}</span><div><strong>${html(item.label)}</strong><small>${html(item.detail)}</small></div></div>`).join("")}</div>
      </div>
      <div class="clinic-dossier-panel">
        <div class="clinic-dossier-panel__head"><div><span>执行进度</span><h3>运营动作完成度</h3></div></div>
        <div class="clinic-progress-list">
          <div><div><span>线索转化</span><strong>${s.conversionRate}%</strong></div><i><b style="width:${conversionWidth}%"></b></i><small>${s.convertedCount} 个成交 / ${s.enrollmentCount} 条线索</small></div>
          <div><div><span>总部任务</span><strong>${s.taskCompletionRate}%</strong></div><i><b style="width:${taskWidth}%"></b></i><small>${s.taskDone} 个完成 / ${s.taskTotal} 个任务</small></div>
        </div>
      </div>
      <div class="clinic-dossier-panel">
        <div class="clinic-dossier-panel__head"><div><span>门店档案</span><h3>基础经营资料</h3></div></div>
        <dl class="clinic-info-list">
          <div><dt>详细地址</dt><dd>${html(c.address || "-")}</dd></div>
          <div><dt>负责人</dt><dd>${html(c.owner || "-")}</dd></div>
          <div><dt>联系电话</dt><dd>${html(c.phone || "-")}</dd></div>
          <div><dt>营业时间</dt><dd>${html(c.businessHours || `${c.openTime ?? "08:00"} - ${c.closeTime ?? "22:00"}`)}</dd></div>
        </dl>
      </div>
      <div class="clinic-dossier-panel clinic-dossier-panel--account">
        <div class="clinic-dossier-panel__head"><div><span>主账号</span><h3>门店管理账号</h3></div>${u ? badge(labelOf(ACCOUNT_STATUS_LABELS, u.status), u.status === "ACTIVE" ? "green" : "rose") : ""}</div>
        ${u ? `<div class="clinic-account-card"><div class="clinic-account-card__avatar">${html(String(u.name || "账").slice(0, 1))}</div><div><strong>${html(u.name)}</strong><span>${html(u.phone)} · ${html(roleName(u.role))}</span><small>最近登录 ${compactDateTime(u.lastLoginAt) || "暂无记录"}</small></div></div>` : `<div class="empty-state"><div class="empty-state__title">暂无门店账号</div><div class="empty-state__sub">请在账号管理中为该门店配置管理账号。</div></div>`}
      </div>
    </section>`;
}

function clinicOptions() {
  return currentClinics().filter((clinic) => clinic.status !== "CLOSED").map((clinic) => ({
    value: clinic.id,
    label: `${clinic.name} · ${clinic.city}`
  }));
}

function kitOptions() {
  return (state.resources.kits ?? []).filter((kit) => kit.status !== "DISCONTINUED").map((kit) => ({
    value: kit.id,
    label: `${kit.name}${kit.retailPrice != null ? ` / ${money(kit.retailPrice)}` : ""}`
  }));
}

function fixedOptions(values: string[]) {
  return () => values.map((value) => ({ value, label: value }));
}

function roleName(role: string) {
  return ({
    CLINIC_DOCTOR: "医生",
    CLINIC_FRONT_DESK: "前台",
    CLINIC_MANAGER: "店长",
    PLATFORM_ADMIN: "总部账号"
  } as Record<string, string>)[role] ?? role;
}

function accountManagedCities(item: any): string[] {
  const raw = item?.cityIds ?? item?.managedCities ?? [];
  if (Array.isArray(raw)) return raw.map(String).map((city) => city.trim()).filter(Boolean);
  return String(raw)
    .split(/[,，/、\s]+/)
    .map((city) => city.trim())
    .filter(Boolean);
}

function provinceByCityName(city: string) {
  return regions().find((region) => region.cities.some((candidate) => candidate.name === city))?.name;
}

function accountScopeCell(item: any): string {
  if (item.role !== "PLATFORM_ADMIN") return html(clinicName(item.clinicId));
  const cities = accountManagedCities(item);
  const adminRole = item.adminRole ?? (cities.length > 0 ? "CITY_ADMIN" : "NATIONAL_ADMIN");
  if (adminRole === "NATIONAL_ADMIN") return badge("全国", "blue");
  if (adminRole === "PROVINCE_ADMIN") {
    if (item.province) return badge(item.province, "indigo");
    if (cities.length === 0) return `<span class="muted">未分配</span>`;
    return badge(provinceByCityName(cities[0]) ?? cities[0], "indigo");
  }
  if (cities.length === 0) return `<span class="muted">未分配</span>`;
  return html(cities.join("、"));
}

function resourceColumns(resource: ResourceKey): ResourceColumn[] {
  const columns = configs[resource].columns;
  if (resource !== "users") return columns;
  const [accountColumn, roleColumn, scopeColumn, ...restColumns] = columns;
  const normalizedScopeColumn = {
    label: state.accountTab === "province" || state.accountTab === "city" ? "管辖区域" : scopeColumn.label,
    value: accountScopeCell
  };
  if (state.accountTab === "province" || state.accountTab === "city") return [accountColumn, normalizedScopeColumn, ...restColumns];
  return [accountColumn, roleColumn, normalizedScopeColumn, ...restColumns];
}

const ROLE_LABELS: Record<string, string> = {
  PATIENT: "患者",
  CLINIC_DOCTOR: "医生",
  CLINIC_FRONT_DESK: "前台",
  CLINIC_MANAGER: "店长",
  PLATFORM_ADMIN: "总部"
};

function taskCompletion(taskId: string) {
  const rows = state.data?.taskProgress.filter((item) => item.taskId === taskId) ?? [];
  if (!rows.length) return "未下发";
  const done = rows.filter((item) => item.status === "DONE").length;
  return `${done}/${rows.length}`;
}

const configs: Record<ResourceKey, ResourceConfig> = {
  clinics: {
    key: "clinics",
    label: "诊所",
    title: "终端诊所",
    subtitle: "总后台只维护终端诊所基础资料、辖区、等级、状态和经营开通情况。",
    endpoint: "/api/admin/clinics",
    listKey: "clinics",
    importEndpoint: "/api/admin/clinics/import",
    columns: [
      { label: "诊所", value: (item) => `<a class="clinic-detail-link" data-clinic-detail="${html(item.id)}" style="cursor:pointer;text-decoration:none;color:var(--brand)">${html(item.name)}</a><br><span class="muted">${html(item.city)}${item.district ? ` · ${html(item.district)}` : ""}</span>` },
      { label: "负责人", value: (item) => `${html(item.owner || "-")}<br><span class="muted">${html(item.phone || "-")}</span>` },
      { label: "等级", value: (item) => badge(item.level, "gold") },
      { label: "状态", value: (item) => badge(labelOf(CLINIC_STATUS_LABELS, item.status), item.status === "ACTIVE" ? "green" : "rose") },
      { label: "门店销售额", value: (item) => money(item.monthlySales) }
    ],
    fields: [
      { name: "name", label: "诊所名称", required: true },
      { name: "province", label: "省份", kind: "cascade", cascade: "province" },
      { name: "city", label: "城市", kind: "cascade", cascade: "city", required: true },
      { name: "district", label: "区县", kind: "cascade", cascade: "district" },
      { name: "address", label: "详细地址", required: true, full: true, hint: "街道、门牌号、地图定位等，便于患者导航" },
      { name: "owner", label: "负责人" },
      { name: "phone", label: "联系电话", hint: "11 位手机号将自动为该门店创建医生账号（默认密码 qwe123456）", hintAlways: true },
      { name: "businessHours", label: "营业时间", kind: "business-hours", defaultValue: "周一至周日 08:00-22:00", hint: "固定保存为：周一至周日 HH:mm-HH:mm", hintAlways: true },
      { name: "level", label: "终端等级", kind: "select", options: fixedOptions(["A类", "B类", "C类", "D类"]) }
    ]
  },
  users: {
    key: "users",
    label: "账号",
    title: "账号管理",
    subtitle: "为终端诊所配置医生、前台、店长和总部运营账号，统一管理权限、辖区和启停状态。",
    endpoint: "/api/admin/users",
    listKey: "users",
    importEndpoint: "/api/admin/users/import",
    importClinicEndpoint: "/api/admin/users/clinic/import",
    columns: [
      { label: "账号", value: (item) => `${html(item.name)}<br><span class="muted">${html(item.phone)}</span>` },
      { label: "角色", value: (item) => badge(roleName(item.role), item.role === "PLATFORM_ADMIN" ? "blue" : "green") },
      { label: "管辖范围", value: (item) => {
        if (item.role !== "PLATFORM_ADMIN") return html(clinicName(item.clinicId));
        if (item.adminRole === "NATIONAL_ADMIN") return badge("全国", "blue");
        if (item.adminRole === "PROVINCE_ADMIN") {
          const cids = (item.cityIds ?? item.managedCities ?? []) as string[];
          if (cids.length === 0) return `<span class="muted">未分配</span>`;
          // 优先用后端返回的 province 字段（从 UserCity → city.province 派生），
          // 兜底再用 cityIds[0] 反查数据库行政区划（兼容老数据没有 province 字段的情况）
          if (item.province) return badge(item.province, "indigo");
          const firstCity = cids[0];
          const prov = provinceByCityName(firstCity);
          return badge(prov ?? cids[0], "indigo");
        }
        const cids = (item.cityIds ?? item.managedCities ?? []) as string[];
        return html(cids.length > 0 ? cids.join("、") : `<span class="muted">未分配</span>`);
      } },
      { label: "菜单权限", value: (item) => {
        const perms = (item.menuPermissions ?? []) as string[];
        if (perms.length === 0) return `<span class="muted">全开（按角色）</span>`;
        return perms.slice(0, 4).map((p) => badge(labelOf(MENU_PERMISSION_OPTIONS, p, p), "blue")).join("") + (perms.length > 4 ? `<span class="muted">+${perms.length - 4}</span>` : "");
      } },
      { label: "状态", value: (item) => badge(labelOf(ACCOUNT_STATUS_LABELS, item.status), item.status === "ACTIVE" ? "green" : "rose") },
      { label: "最近登录", value: (item) => compactDateTime(item.lastLoginAt) || "-" }
    ],
    fields: [
      { name: "name", label: "姓名", required: true },
      { name: "phone", label: "手机号", required: true },
      { name: "password", label: "初始/重置密码", defaultValue: "qwe123456" },
      { name: "clinicId", label: "所属诊所", kind: "select", options: clinicOptions },
      // 省份/城市级联仅在地市/省级 tab 创建时显示（renderDrawer 按 accountTab 过滤）
      { name: "province", label: "管辖省份", kind: "cascade", cascade: "province", showAdminOnly: true },
      { name: "managedCities", label: "管辖城市", kind: "cascade", cascade: "city", showAdminOnly: true },
      { name: "status", label: "状态", kind: "select", options: () => Object.entries(ACCOUNT_STATUS_LABELS).map(([value, label]) => ({ value, label })) }
    ]
  },
  kits: {
    key: "kits",
    label: "产品包",
    title: "产品包",
    subtitle: "维护总部统一产品包、建议零售价、门店价和基础说明，供终端诊所使用。",
    endpoint: "/api/admin/kits",
    listKey: "kits",
    columns: [
      { label: "产品包", value: (item) => `${html(item.name)}<br><span class="muted">${html(item.target || "-")}</span>` },
      { label: "疗程", value: (item) => html(item.duration || "-") },
      { label: "门店价", value: (item) => money(item.clinicPrice) },
      { label: "零售价", value: (item) => money(item.retailPrice) },
      { label: "派发方", value: (item) => scopeOwnerBadge(item.createdByAdminRole) || badge("总部", "gold") },
      { label: "派发范围", value: (item) => `${scopeBadge(item.scopeLevel, item.scopeProvince, item.scopeCity)}${canEditContentFrontend(item) ? "" : `<span class="pill muted" style="margin-left:8px" title="省级/市级以下只读">只读</span>`}` },
      { label: "状态", value: (item) => badge(labelOf(DRUG_KIT_STATUS_LABELS, item.status), item.status === "ACTIVE" ? "green" : "rose") },
      { label: "说明", value: (item) => html(item.explain || "-") }
    ],
    fields: [
      { name: "name", label: "产品包名称", required: true },
      { name: "target", label: "适用场景" },
      { name: "duration", label: "疗程周期" },
      { name: "drugs", label: "组合内容", kind: "textarea", full: true },
      { name: "costPrice", label: "成本价", kind: "number" },
      { name: "clinicPrice", label: "门店价", kind: "number" },
      { name: "retailPrice", label: "零售价", kind: "number" },
      { name: "defaultFollowUpDays", label: "默认随访天数", kind: "number" },
      { name: "treatmentRepeatCount", label: "标准疗程执行次数", kind: "number", defaultValue: "6" },
      { name: "treatmentMinIntervalDays", label: "最短间隔天数", kind: "number", defaultValue: "3" },
      { name: "treatmentMaxIntervalDays", label: "最长间隔天数", kind: "number", defaultValue: "5" },
      { name: "treatmentActionType", label: "标准执行方式", kind: "select", defaultValue: "CLINIC_APPLICATION", options: () => [{ value: "CLINIC_APPLICATION", label: "到店上药" }, { value: "HOME_MEDICATION", label: "居家用药" }, { value: "RECHECK", label: "到店复查" }, { value: "OBSERVATION", label: "居家观察" }] },
      { name: "status", label: "状态", kind: "select", options: () => Object.entries(DRUG_KIT_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
      { name: "explain", label: "产品说明", kind: "textarea", full: true }
    ]
  },
  templates: {
    key: "templates",
    label: "活动模板",
    title: "活动模板",
    subtitle: "维护总部统一活动模板，发布后可下发到辖区诊所，版本更新会留下审计记录。",
    endpoint: "/api/admin/templates",
    listKey: "templates",
    dispatchEndpoint: "/api/admin/templates/dispatch",
    columns: [
      { label: "模板", value: (item) => `${html(item.title)}<br><span class="muted">${html(item.category || "-")} · v${html(item.version ?? 1)}</span>` },
      { label: "目标", value: (item) => html(item.target || "-") },
      { label: "活动价", value: (item) => money(item.promoPrice) },
      { label: "派发方", value: (item) => scopeOwnerBadge(item.createdByAdminRole) || badge("总部", "gold") },
      { label: "派发范围", value: (item) => `${scopeBadge(item.scopeLevel, item.scopeProvince, item.scopeCity)}${canEditContentFrontend(item) ? "" : `<span class="pill muted" style="margin-left:8px" title="省级/市级以下只读">只读</span>`}` },
      { label: "状态", value: (item) => badge(labelOf(TEMPLATE_STATUS_LABELS, item.status), item.status === "PUBLISHED" ? "green" : "blue") },
      { label: "内容", value: (item) => html(item.copy || "-") }
    ],
    fields: [
      { name: "title", label: "模板标题", required: true },
      { name: "category", label: "分类" },
      { name: "target", label: "目标人群" },
      { name: "originalPrice", label: "原价", kind: "number" },
      { name: "promoPrice", label: "活动价", kind: "number" },
      { name: "items", label: "项目清单", kind: "tags", full: true },
      { name: "kitId", label: "关联产品包" },
      { name: "copy", label: "活动说明", kind: "textarea", full: true },
      { name: "status", label: "状态", kind: "select", options: () => Object.entries(TEMPLATE_STATUS_LABELS).map(([value, label]) => ({ value, label })) }
    ]
  },
  articles: {
    key: "articles",
    label: "文章",
    title: "科普文章",
    subtitle: "维护患者端可见的健康科普内容，默认草稿，发布后患者端展示。",
    endpoint: "/api/admin/articles",
    listKey: "articles",
    columns: [
      { label: "文章", value: (item) => `${html(item.title)}<br><span class="muted">${html(item.category || "-")}</span>` },
      { label: "摘要", value: (item) => html(item.summary || "-") },
      { label: "派发方", value: (item) => scopeOwnerBadge(item.createdByAdminRole) || (item.clinicId ? badge("诊所", "muted") : badge("总部", "gold")) },
      { label: "派发范围", value: (item) => item.clinicId ? badge("诊所专属", "muted") : `${scopeBadge(item.scopeLevel, item.scopeProvince, item.scopeCity)}${canEditContentFrontend(item) ? "" : `<span class="pill muted" style="margin-left:8px" title="省级/市级以下只读">只读</span>`}` },
      { label: "状态", value: (item) => badge(labelOf(ARTICLE_STATUS_LABELS, item.status), item.status === "PUBLISHED" ? "green" : "blue") },
      { label: "创建时间", value: (item) => compactDateTime(item.createdAt) }
    ],
    fields: [
      { name: "title", label: "标题", required: true },
      { name: "category", label: "分类" },
      { name: "summary", label: "摘要", kind: "textarea", full: true },
      { name: "content", label: "正文", kind: "textarea", full: true },
      { name: "status", label: "状态", kind: "select", options: () => Object.entries(ARTICLE_STATUS_LABELS).map(([value, label]) => ({ value, label })) }
    ]
  },
  marketingPosts: {
    key: "marketingPosts",
    label: "营销推送",
    title: "营销推送",
    subtitle: "结构化宣传稿：首图/内容/中心图/内容/尾图/权益 + 活动信息 + 留空。状态 TEMPLATE 仅给诊所采纳，PUBLISHED 全量推送给全国患者。",
    endpoint: "/api/admin/marketing-posts",
    listKey: "marketingPosts",
    dispatchEndpoint: "/api/admin/marketing-posts/dispatch",
    dispatchStatus: "TEMPLATE",
    columns: [
      { label: "标题", value: (item) => `${html(item.title)}<br><span class="muted">${html(item.subtitle || item.introText?.slice(0, 30) || "-")}</span>` },
      { label: "类型", value: (item) => badge(labelOf(MARKETING_POST_TYPE_LABELS, item.type, "公告")) },
      { label: "派发方", value: (item) => scopeOwnerBadge(item.createdByAdminRole) || badge("总部", "gold") },
      { label: "派发范围", value: (item) => item.clinicId ? badge("诊所专属", "muted") : `${scopeBadge(item.scopeLevel, item.scopeProvince, item.scopeCity)}${canEditContentFrontend(item) ? "" : `<span class="pill muted" style="margin-left:8px" title="省级/市级以下只读">只读</span>`}` },
      { label: "状态", value: (item) => badge(labelOf(MARKETING_POST_STATUS_LABELS, item.status), item.status === "PUBLISHED" ? "green" : "blue") },
      { label: "创建时间", value: (item) => compactDateTime(item.createdAt) }
    ],
    fields: [
      { name: "title", label: "标题", required: true },
      { name: "subtitle", label: "副标题" },
      { name: "coverImageUrl", label: "首图 URL（可选）", full: true },
      { name: "introText", label: "首图后正文", kind: "textarea", required: true, full: true },
      { name: "centerImageUrl", label: "中心图 URL（可选）", full: true },
      { name: "bodyText", label: "中心图后正文（可选）", kind: "textarea", full: true },
      { name: "footerImageUrl", label: "尾图 URL（可选）", full: true },
      { name: "benefits", label: "活动权益（一段话）", kind: "textarea", full: true },
      { name: "activityInfo", label: "活动信息（时间/门槛/价格）", full: true },
      { name: "notes", label: "底部留空 1-2 行", kind: "textarea", full: true },
      { name: "type", label: "类型", kind: "select", options: () => Object.entries(MARKETING_POST_TYPE_LABELS).map(([value, label]) => ({ value, label })) },
      { name: "status", label: "状态", kind: "select", options: () => Object.entries(MARKETING_POST_STATUS_LABELS).map(([value, label]) => ({ value, label })) }
    ]
  },
  tasks: {
    key: "tasks",
    label: "总部任务",
    title: "总部任务",
    subtitle: "总部向终端诊所下发运营动作、物料要求和活动执行任务，并查看完成率。",
    endpoint: "/api/admin/tasks",
    listKey: "tasks",
    columns: [
      { label: "任务", value: (item) => `${html(item.title)}<br><span class="muted">${html(item.content || "-")}</span>` },
      { label: "下发范围", value: (item) => item.clinicId ? html(clinicName(item.clinicId)) : "辖区内诊所" },
      { label: "优先级", value: (item) => badge(labelOf(PRIORITY_LABELS, item.priority || "NORMAL", "普通"), item.priority === "HIGH" || item.priority === "URGENT" ? "rose" : "blue") },
      { label: "截止时间", value: (item) => item.dueAt ? compactDateTime(item.dueAt) : "-" },
      { label: "状态", value: (item) => badge(labelOf(TASK_STATUS_LABELS, item.status), item.status === "DONE" ? "green" : "blue") },
      { label: "完成率", value: (item) => badge(taskCompletion(item.id), "gold") },
      { label: "创建时间", value: (item) => compactDateTime(item.createdAt) }
    ],
    fields: [
      { name: "title", label: "任务标题", required: true },
      { name: "content", label: "任务内容", kind: "textarea", required: true, full: true },
      { name: "category", label: "任务分类", kind: "select", options: () => Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })) },
      { name: "priority", label: "优先级", kind: "select", options: () => Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label })) },
      { name: "dueAt", label: "截止时间" },
      { name: "mode", label: "下发方式", kind: "select", options: () => [{ value: "all", label: "辖区全部" }, { value: "one", label: "指定门店" }], createOnly: true },
      { name: "clinicId", label: "指定诊所", kind: "select", options: clinicOptions, createOnly: true },
      { name: "status", label: "状态", kind: "select", options: () => Object.entries(TASK_STATUS_LABELS).map(([value, label]) => ({ value, label })) }
    ]
  },
  taskTemplates: {
    key: "taskTemplates",
    label: "任务模板",
    title: "总部任务模板库",
    subtitle: "把反复下发的运营任务沉淀为模板，诊所可一键采纳为待办，节省总部与门店的沟通成本。",
    endpoint: "/api/admin/task-templates",
    listKey: "templates",
    dispatchEndpoint: "/api/admin/task-templates/dispatch",
    columns: [
      { label: "模板", value: (item) => `${html(item.title)}<br><span class="muted">${html((item.content || "").slice(0, 60))}${(item.content || "").length > 60 ? "…" : ""}</span>` },
      { label: "分类", value: (item) => badge(labelOf(CATEGORY_LABELS, item.category || "OPERATIONS", "运营"), "blue") },
      { label: "优先级", value: (item) => badge(labelOf(PRIORITY_LABELS, item.priority || "NORMAL", "普通"), item.priority === "HIGH" || item.priority === "URGENT" ? "rose" : "blue") },
      { label: "版本", value: (item) => badge(`v${item.version ?? 1}`, "muted") },
      { label: "状态", value: (item) => badge(labelOf(TASK_TEMPLATE_STATUS_LABELS, item.status), item.status === "PUBLISHED" ? "green" : item.status === "ARCHIVED" ? "rose" : "blue") },
      { label: "创建时间", value: (item) => compactDateTime(item.createdAt) }
    ],
    fields: [
      { name: "title", label: "模板标题", required: true },
      { name: "content", label: "模板说明", kind: "textarea", required: true, full: true },
      { name: "category", label: "任务分类", kind: "select", options: () => Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })) },
      { name: "priority", label: "优先级", kind: "select", options: () => Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label })) },
      { name: "status", label: "状态", kind: "select", options: () => Object.entries(TASK_TEMPLATE_STATUS_LABELS).map(([value, label]) => ({ value, label })) }
    ]
  },
  purchases: {
    key: "purchases",
    label: "采购订单",
    title: "采购订单",
    subtitle: "查看所有门店采购订单，包含产品、金额、支付状态和到店状态。",
    endpoint: "/api/admin/purchases",
    listKey: "purchases",
    columns: [
      { label: "订单号", value: (item) => html(item.id.slice(0, 8)) },
      { label: "诊所", value: (item) => html(clinicName(item.clinicId)) },
      { label: "患者", value: (item) => html(item.patientName) },
      { label: "产品", value: (item) => html(item.kitName) },
      { label: "金额", value: (item) => money(item.amount) },
      { label: "状态", value: (item) => badge(labelOf(PURCHASE_STATUS_LABELS, item.status), item.status === "COMPLETED" ? "green" : item.status === "REFUNDED" ? "rose" : "gold") },
      { label: "到店", value: (item) => badge(labelOf(REVISIT_STATUS_LABELS, item.revisitStatus), item.revisitStatus === "REVISITED" ? "green" : "gold") },
      { label: "时间", value: (item) => compactDateTime(item.purchasedAt) }
    ],
    fields: []
  }
};

// W5a 通知中心：拉取/渲染/标记已读
async function loadNotifications() {
  try {
    const data = await api<{ messages: any[]; unread: number }>("/api/admin/messages?limit=30");
    state.notifications = data.messages;
    state.unread = data.unread;
  } catch (error) {
    state.notifications = [];
    state.unread = 0;
  }
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
            <div class="notif-item__time">${compactDateTime(msg.createdAt) || ""}</div>
          </div>
        `).join("")}
      </div>
    </div>`;
}

function renderNotificationDetail(message: any) {
  if (!message) return "";
  return `<div class="message-detail-backdrop" data-close-message-detail><section class="message-detail" onclick="event.stopPropagation()"><button type="button" data-close-message-detail>关闭</button><span>${message.read ? "已读通知" : "新通知"}</span><h2>${html(message.title)}</h2><time>${html(compactDateTime(message.createdAt))}</time><p>${html(message.content)}</p></section></div>`;
}

async function loadDashboard() {
  state.data = await api<Dashboard>("/api/admin/dashboard");
  state.resources.clinics = state.data.clinics;
}

async function loadResource(resource: ResourceKey) {
  const config = configs[resource];
  if (!config) return;
  try {
    const result = await api<any>(config.endpoint);
    state.resources[resource] = result[config.listKey] ?? [];
    if (resource === "tasks" && state.data) state.data.taskProgress = result.progress ?? state.data.taskProgress;
  } catch (error: any) {
    if (error?.message === "Forbidden") {
      state.resources[resource] = [];
      showToast("当前账号没有该板块权限", "warn");
      return;
    }
    throw error;
  }
}

async function loadDispatch() {
  state.dispatch = await api<DispatchPayload>("/api/admin/dashboard/dispatch");
}

async function loadLoginHistory() {
  const result = await api<{ logs: NonNullable<typeof state.loginHistory> }>("/api/admin/audit-logs/login-history?limit=100");
  state.loginHistory = result.logs;
}

async function loadReports() {
  const params = new URLSearchParams();
  if (state.reportsCityFilter) params.set("city", state.reportsCityFilter);
  if (state.reportsFrom) params.set("from", state.reportsFrom);
  if (state.reportsTo) params.set("to", state.reportsTo);
  const query = params.toString();
  state.reports = await api<ReportPayload>(`/api/admin/reports${query ? "?" + query : ""}`);
}

async function loadAgents() {
  state.agentsLoading = true;
  try {
    const data = await api<{ agents: AgentRow[] }>("/api/admin/agents");
    state.agents = data.agents;
  } catch (error) {
    state.agents = [];
    showToast((error as Error).message, "error");
  } finally {
    state.agentsLoading = false;
  }
}

async function loadKnowledgeDocuments() {
  try {
    const data = await api<{ documents: any[] }>("/api/admin/knowledge-documents");
    state.knowledgeDocuments = data.documents;
  } catch (error) {
    state.knowledgeDocuments = [];
    showToast((error as Error).message, "error");
  }
}

async function loadKnowledgeBases() {
  try {
    const data = await api<{ bases: any[] }>("/api/admin/knowledge-bases");
    state.knowledgeBases = data.bases;
    if (!state.selectedKnowledgeBaseId || !data.bases.some((item) => item.id === state.selectedKnowledgeBaseId)) {
      state.selectedKnowledgeBaseId = data.bases[0]?.id;
    }
  } catch (error) {
    state.knowledgeBases = [];
    showToast((error as Error).message, "error");
  }
}

async function loadAgentDetail(id: string) {
  state.agentDetailLoading = true;
  renderApp();
  try {
    const data = await api<{ detail: AgentDetail }>(`/api/admin/agents/${encodeURIComponent(id)}`);
    state.agentDetail = data.detail;
  } catch (error) {
    showToast((error as Error).message, "error");
  } finally {
    state.agentDetailLoading = false;
    renderApp();
  }
}

async function loadNotifHistory() {
  try {
    const data = await api<{ messages: NotifHistoryItem[] }>("/api/admin/messages?limit=20");
    state.notifHistory = data.messages;
  } catch {
    state.notifHistory = [];
  }
}

async function loadAll() {
  state.error = undefined;
  await loadAdministrativeRegions();
  await loadDashboard();
  await Promise.all((["clinics", "users", "kits", "templates", "articles", "marketingPosts", "tasks", "taskTemplates", "purchases"] as ResourceKey[]).map(loadResource));
  await loadDispatch();
  await loadReports();
  await loadNotifications();
  await loadAgents();
  await loadNotifHistory();
}

function renderLogin() {
  root.innerHTML = `
    <div class="login">
      <section class="panel">
        <div class="brand" style="margin-bottom:16px">
          <div class="brand-mark">清</div>
          <div class="brand-copy"><strong>总后台登录</strong><span>终端诊所运营管理平台</span></div>
        </div>
        ${status()}
        <form id="loginForm" class="form">
          <div class="field"><label>手机号</label><input name="phone" autocomplete="username" placeholder="请输入手机号" /></div>
          <div class="field"><label>密码</label><input name="password" type="password" autocomplete="current-password" placeholder="请输入密码" /></div>
          <div class="actions"><button type="submit">登录总后台</button></div>
        </form>
      </section>
    </div>`;

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
        // 不写入 state.message，避免登录后顶部常驻"登录成功"
        await loadAll();
        renderApp();
      } catch (error: any) {
        state.error = error.message;
        renderLogin();
      }
    });
  };
}

function renderApp() {
  if (!state.data) return renderLogin();
  state.sidebarScrollTop = document.querySelector<HTMLElement>(".sidebar")?.scrollTop ?? state.sidebarScrollTop;
  state.workspaceScrollLeft = document.querySelector<HTMLElement>(".workspace-tabs__rail")?.scrollLeft ?? state.workspaceScrollLeft;
  // 保存当前焦点（id + selectionStart/End），render 后恢复，避免输入框失焦
  const active = document.activeElement as HTMLElement | null;
  const focusKey = active?.id || active?.dataset?.focusKey;
  const selStart = (active as HTMLInputElement | HTMLTextAreaElement | null)?.selectionStart ?? null;
  const selEnd = (active as HTMLInputElement | HTMLTextAreaElement | null)?.selectionEnd ?? null;
  const role = currentAdminRole();
  const roleLabel = role ? ADMIN_ROLE_LABELS[role] : "管理员";
  const scopeLabel = role === "NATIONAL_ADMIN" ? "全国"
    : role === "PROVINCE_ADMIN" ? (currentAdminProvince() ?? "未分配省份")
    : role === "CITY_ADMIN" ? (currentAdminCities().join("、") || "未分配地市")
    : (state.data.admin?.scope ?? "");
  root.innerHTML = `
    <div class="app app--admin">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">清</div>
          <div class="brand-copy">
            <strong>清愫美终端诊所管理台</strong>
            <span>${html(state.data.company?.name)} · 当前视角：<strong>${html(scopeLabel)}</strong> · ${html(roleLabel)}</span>
          </div>
        </div>
        <div class="actions">
          <div class="shell-signal"><span></span><strong>运营在线</strong><small>数据实时同步</small></div>
          ${badge(roleLabel, role === "NATIONAL_ADMIN" ? "blue" : role === "PROVINCE_ADMIN" ? "indigo" : "gold")}
          <div class="notif-wrap">
            <button id="notifBtn" class="secondary notif-btn" aria-label="通知"><span class="notif-bell">🔔</span>${state.unread > 0 ? `<span class="notif-dot">${state.unread > 99 ? "99+" : state.unread}</span>` : ""}</button>
            ${state.notifOpen ? renderNotifPanel() : ""}
          </div>
          <button id="refreshBtn" class="secondary">刷新</button>
          <button id="logoutBtn" class="secondary">退出</button>
        </div>
      </header>
      <div class="layout">
        <aside class="sidebar sidebar--admin">
          ${renderSidebar()}
          <div class="sidebar-intelligence">
            <span class="sidebar-intelligence__eyebrow">运营雷达</span>
            <strong>${state.unread > 0 ? `${state.unread} 条新动态` : "当前运行平稳"}</strong>
            <small>关注门店健康、任务执行与活动转化</small>
            <button type="button" data-tab="reports">查看经营汇总</button>
          </div>
        </aside>
        <main class="main">
          ${renderAdminWorkspaceTabs()}
          ${status()}
          <div class="content-stage content-stage--admin">
            ${state.clinicDetail ? renderClinicDetail() : renderActive()}
          </div>
        </main>
      </div>
      ${state.drawer ? renderDrawer() : ""}
      ${state.knowledgeDocumentEditor ? renderKnowledgeDocumentEditor() : ""}
      ${renderNotificationDetail(state.activeNotification)}
      ${state.agentDetailLoading ? `<div class="global-loading-mask" role="status" aria-live="polite"><div class="global-loading-mask__card"><span></span><strong>正在加载经营数据</strong><small>正在汇总代理商门店、销售与转化情况，请稍候</small></div></div>` : ""}
    </div>`;
  bindActions();
  bindAdminTableRowDetails();
  const sidebar = document.querySelector<HTMLElement>(".sidebar");
  if (sidebar) sidebar.scrollTop = state.sidebarScrollTop;
  const workspaceRail = document.querySelector<HTMLElement>(".workspace-tabs__rail");
  if (workspaceRail) {
    workspaceRail.scrollLeft = state.workspaceScrollLeft;
    workspaceRail.querySelector<HTMLElement>(".workspace-tab.is-active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
    state.workspaceScrollLeft = workspaceRail.scrollLeft;
  }
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
  // 维护 toast 容器（toast 是挂在 document.body 上的，不参与主 DOM 重建）
  renderToastWrap();
}

function renderActive() {
  if (state.active === "overview") return renderOverviewHub();
  if (state.active === "reports") return renderReportsManagement();
  if (state.active === "dispatch") return renderDispatch();
  if (state.active === "audit") return renderAudit();
  if (state.active === "notifications") return renderNotificationsManagement();
  if (state.active === "agents") return renderAgentsManagement();
  if (state.active === "knowledgeBase") return renderKnowledgeBaseWorkspace();
  if (["clinics", "users", "kits", "templates", "articles", "marketingPosts", "tasks", "taskTemplates", "purchases"].includes(state.active)) return renderResource(state.active as ResourceKey);
  return "";
}

function adminWorkspaceLabel(key: string): string {
  for (const section of SIDEBAR_SECTIONS) {
    const item = section.items.find((candidate) => candidate.key === key);
    if (item) return item.label;
  }
  return key;
}

function ensureAdminWorkspaceTab(key: string) {
  if (!state.workspaceTabs.some((tab) => tab.key === key)) {
    state.workspaceTabs.push({ key, label: adminWorkspaceLabel(key) });
  }
}

function renderAdminWorkspaceTabs(): string {
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

async function activateAdminWorkspaceTab(key: string) {
  ensureAdminWorkspaceTab(key);
  state.active = key;
  state.query = "";
  state.clinicFilter = "";
  state.statusFilter = "";
  state.clinicDetail = undefined;
  state.clinicDetailId = undefined;
  if (["clinics", "users", "kits", "templates", "articles", "marketingPosts", "tasks", "taskTemplates", "purchases"].includes(state.active)) await loadResource(state.active as ResourceKey);
  if (state.active === "dispatch" && !state.dispatch) await loadDispatch();
  if (state.active === "reports" && !state.reports) await loadReports();
  if (state.active === "audit" && !state.loginHistory) await loadLoginHistory();
  if (state.active === "agents" && !state.agents) await loadAgents();
  if (state.active === "knowledgeBase" && (!state.knowledgeDocuments || !state.knowledgeBases)) await Promise.all([loadKnowledgeBases(), loadKnowledgeDocuments()]);
  if (state.active === "notifications") await Promise.all([loadNotifHistory(), loadNotifAudience()]);
  renderApp();
}

async function closeAdminWorkspaceTab(key: string) {
  if (state.workspaceTabs.length === 1) return;
  const index = state.workspaceTabs.findIndex((tab) => tab.key === key);
  if (index < 0) return;
  const wasActive = state.active === key;
  state.workspaceTabs.splice(index, 1);
  if (wasActive) {
    const next = state.workspaceTabs[index] ?? state.workspaceTabs[index - 1];
    await activateAdminWorkspaceTab(next.key);
    return;
  }
  renderApp();
}

function bindAdminTableRowDetails() {
  document.querySelectorAll<HTMLTableRowElement>(".content-stage .table-wrap tbody tr").forEach((row) => {
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

function renderOverviewHub() {
  const data = state.data!;
  const clinics = currentClinics();
  const activeClinics = clinics.filter((item) => item.status === "ACTIVE").length;
  const sales = clinics.reduce((sum, item) => sum + Number(item.monthlySales ?? 0), 0) || data.metrics.purchaseAmount || 0;
  const funnel = data.funnel ?? [];
  const leads = funnel.reduce((sum, row) => sum + row.total, 0);
  const conversions = funnel.reduce((sum, row) => sum + (row.breakdown.CONVERTED ?? 0), 0);
  const conversionRate = leads ? Math.round((conversions / leads) * 100) : 0;
  const tasks = state.resources.tasks ?? [];
  const openTasks = tasks.filter((item) => item.status !== "DONE").length;
  const taskCompletionRate = data.metrics.taskCompletionRate ?? 0;
  const health = data.healthScore ?? [];
  const healthGood = health.filter((item) => item.score >= 70).length;
  const healthRisk = health.filter((item) => item.score < 40).length;
  const inactive = (data.inactiveClinics ?? []).slice().sort((a, b) => (b.daysSinceLastActivity ?? 0) - (a.daysSinceLastActivity ?? 0));
  const attention = inactive.slice(0, 5);
  const topClinics = [...clinics]
    .sort((a, b) => Number(b.monthlySales ?? 0) - Number(a.monthlySales ?? 0))
    .slice(0, 6);
  const maxSales = Math.max(1, ...topClinics.map((item) => Number(item.monthlySales ?? 0)));
  const topFunnel = [...funnel].sort((a, b) => b.total - a.total).slice(0, 6);
  const agentMetrics = data.agentMetrics ?? { agentCount: 0, activeAgentCount: 0, newClinicsLast30d: 0 };
  const marketing = data.marketingStats ?? { total: 0, published: 0, byType: {}, byClinic: [] };

  return `
    ${renderPageHeader()}
    <section class="overview-hub">
      <div class="overview-metrics">
        <div class="overview-metric overview-metric--primary">
          <span>经营规模</span>
          <strong>${activeClinics}<small> / ${clinics.length} 家</small></strong>
          <p>活跃终端诊所</p>
        </div>
        <div class="overview-metric">
          <span>累计销售额</span>
          <strong>${money(sales)}</strong>
          <p>${data.metrics.packagePurchases ?? 0} 笔采购订单</p>
        </div>
        <div class="overview-metric">
          <span>活动转化率</span>
          <strong>${conversionRate}%</strong>
          <p>${leads} 条线索，${conversions} 条成交</p>
        </div>
        <div class="overview-metric">
          <span>任务完成率</span>
          <strong>${taskCompletionRate}%</strong>
          <p>${openTasks} 项任务进行中</p>
        </div>
        <div class="overview-metric overview-metric--risk">
          <span>风险门店</span>
          <strong>${healthRisk}</strong>
          <p>${healthGood} 家健康状态良好</p>
        </div>
      </div>

      <div class="overview-main-grid">
        <section class="overview-surface overview-performance">
          <div class="overview-section-head">
            <div><span>经营表现</span><h3>终端销售分布</h3></div>
            <p>按门店累计销售额排序</p>
          </div>
          <div class="overview-bars">
            ${topClinics.length === 0 ? `<div class="empty-state"><div class="empty-state__title">暂无销售数据</div></div>` : topClinics.map((item, index) => {
              const value = Number(item.monthlySales ?? 0);
              const height = Math.max(8, Math.round((value / maxSales) * 100));
              return `<div class="overview-bar-item">
                <div class="overview-bar-value">${money(value)}</div>
                <div class="overview-bar-track"><div style="height:${height}%"></div></div>
                <strong>${index + 1}. ${html(item.name)}</strong>
                <small>${html(item.city ?? "")}</small>
              </div>`;
            }).join("")}
          </div>
          <div class="overview-performance-foot">
            <span>代理网络 <strong>${agentMetrics.activeAgentCount}/${agentMetrics.agentCount}</strong></span>
            <span>近 30 天新签 <strong>${agentMetrics.newClinicsLast30d}</strong></span>
            <span>营销发布 <strong>${marketing.published}/${marketing.total}</strong></span>
          </div>
        </section>

        <section class="overview-surface overview-ranking">
          <div class="overview-section-head">
            <div><span>门店排行</span><h3>高表现终端</h3></div>
            <button type="button" data-tab="reports" class="ghost sm">查看经营汇总</button>
          </div>
          <div class="overview-rank-list">
            ${topClinics.map((item, index) => `<div class="overview-rank-row">
              <b>${String(index + 1).padStart(2, "0")}</b>
              <div><strong>${html(item.name)}</strong><small>${html(item.city ?? "")} · ${html(item.level ?? "终端")}</small></div>
              <span>${money(item.monthlySales ?? 0)}</span>
            </div>`).join("") || `<div class="empty-state"><div class="empty-state__title">暂无排行数据</div></div>`}
          </div>
        </section>
      </div>

      <div class="overview-lower-grid">
        <section class="overview-surface overview-funnel">
          <div class="overview-section-head">
            <div><span>活动效率</span><h3>重点活动转化</h3></div>
            <p>${funnel.length} 个活动正在汇聚数据</p>
          </div>
          <div class="overview-funnel-table">
            <div class="overview-funnel-header"><span>活动 / 门店</span><span>线索</span><span>到店</span><span>成交</span><span>转化率</span></div>
            ${topFunnel.map((row) => {
              const rate = row.total ? Math.round(((row.breakdown.CONVERTED ?? 0) / row.total) * 100) : 0;
              return `<div class="overview-funnel-row">
                <div><strong>${html(row.title)}</strong><small>${html(clinicName(row.clinicId))}</small></div>
                <span>${row.total}</span>
                <span>${row.breakdown.ATTENDED ?? 0}</span>
                <span>${row.breakdown.CONVERTED ?? 0}</span>
                <b>${rate}%</b>
              </div>`;
            }).join("") || `<div class="empty-state"><div class="empty-state__title">暂无活动数据</div></div>`}
          </div>
        </section>

        <section class="overview-surface overview-attention">
          <div class="overview-section-head">
            <div><span>行动提醒</span><h3>需要关注</h3></div>
            <strong>${attention.length} 项</strong>
          </div>
          <div class="overview-attention-list">
            ${attention.map((item) => `<div class="overview-attention-row">
              <span class="health-indicator health-indicator--${item.danger}"></span>
              <div><strong>${html(item.name)}</strong><small>${html(item.city)} · ${item.daysSinceLastActivity == null ? "暂无活动记录" : `${item.daysSinceLastActivity} 天未活跃`}</small></div>
            </div>`).join("") || `<div class="overview-calm"><strong>当前没有高风险提醒</strong><span>门店整体运营状态稳定</span></div>`}
          </div>
        </section>
      </div>
    </section>`;
}

function metric(label: string, value: string | number, hint: string) {
  return `<div class="panel metric"><span class="muted">${html(label)}</span><strong>${html(value)}</strong><small>${html(hint)}</small></div>`;
}

function barChart(rows: Array<{ label: string; sub: string; value: number; max: number; tone?: string }>) {
  return rows.map((r) => {
    const pct = r.max > 0 ? Math.round((r.value / r.max) * 100) : 0;
    return `<div class="bar-chart">
      <div class="bar-chart__label"><span><strong>${html(r.label)}</strong><small class="muted">${html(r.sub)}</small></span><span>${r.value}</span></div>
      <div class="bar-chart__track"><div class="bar-chart__bar ${r.tone ? `bar-chart__bar--${r.tone}` : ""}" style="transform:scaleX(${(pct / 100).toFixed(3)})"></div></div>
    </div>`;
  }).join("");
}

function renderOverview() {
  const data = state.data!;
  const clinics = currentClinics();
  const users = state.resources.users ?? [];
  const platformAdmins = users.filter((u) => u.role === "PLATFORM_ADMIN" && u.adminRole === "NATIONAL_ADMIN").length;
  const provinceAdmins = users.filter((u) => u.role === "PLATFORM_ADMIN" && u.adminRole === "PROVINCE_ADMIN").length;
  const cityAdmins = users.filter((u) => u.role === "PLATFORM_ADMIN" && (u.adminRole ?? "CITY_ADMIN") === "CITY_ADMIN").length;
  const storeUsers = users.filter((u) => u.role !== "PLATFORM_ADMIN").length;
  const active = clinics.filter((item) => item.status === "ACTIVE").length;
  const sales = clinics.reduce((sum, item) => sum + Number(item.monthlySales ?? 0), 0);
  const tasksOpen = (state.resources.tasks ?? []).filter((item) => item.status !== "DONE").length;
  const funnel = data.funnel ?? [];
  const conv = funnel.reduce((s, r) => s + r.breakdown.CONVERTED, 0);
  const newLeads = funnel.reduce((s, r) => s + r.total, 0);
  const ms = data.marketingStats ?? { total: 0, published: 0, byType: {} as Record<string,number>, byClinic: [] };
  const as = data.articleStats ?? { total: 0, byCategory: {} as Record<string,number>, byClinic: [] };
  const ucs = data.clinicUserCounts ?? [];
  const ics = data.inactiveClinics ?? [];
  const hs = data.healthScore ?? [];
  const conversionRate = newLeads ? Math.round((conv / newLeads) * 100) : 0;
  const avgHealth = hs.length > 0 ? Math.round(hs.reduce((s, x) => s + x.score, 0) / hs.length) : 0;
  // 代理商维度（来自 dashboard 接口的 agentMetrics / agentBreakdown）
  const am = data.agentMetrics ?? { agentCount: 0, activeAgentCount: 0, newClinicsLast30d: 0, totalSalesByAgent: 0, monthSalesByAgent: 0, totalEnrollmentsByAgent: 0, monthEnrollmentsByAgent: 0, avgRevenuePerAgent: 0 };
  const agentRows = (data.agentBreakdown ?? []).slice(0, 8);
  const agentMaxSales = Math.max(1, ...agentRows.map((r) => r.totalSales));

  // 汇总：把每个诊所的「营销发布 + 内容发布」合并成单行
  const publishMap = new Map<string, { name: string; city: string; marketing: number; articles: number }>();
  for (const m of ms.byClinic) {
    publishMap.set(m.id, { name: m.name, city: m.city, marketing: m.total, articles: 0 });
  }
  for (const a of as.byClinic) {
    const cur = publishMap.get(a.id) ?? { name: a.name, city: a.city, marketing: 0, articles: 0 };
    cur.articles = a.total;
    publishMap.set(a.id, cur);
  }
  const publishRows = Array.from(publishMap.values())
    .map((r) => ({ ...r, total: r.marketing + r.articles }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  // 健康评分 Top 6
  const healthTop = [...hs].sort((a, b) => a.score - b.score).slice(0, 6);
  const healthGood = hs.filter((x) => x.score >= 70).length;
  const healthMid = hs.filter((x) => x.score >= 40 && x.score < 70).length;
  const healthBad = hs.filter((x) => x.score < 40).length;

  // 终端诊所 Top 8 by 销售额
  const topClinics = [...clinics]
    .filter((c) => Number(c.monthlySales ?? 0) > 0)
    .sort((a, b) => Number(b.monthlySales ?? 0) - Number(a.monthlySales ?? 0))
    .slice(0, 8);

  // 活动漏斗 Top 5（mini funnel）
  const funnelTop5 = [...funnel].sort((a, b) => b.total - a.total).slice(0, 5);
  const funnelTop5Max = funnelTop5.reduce((m, r) => Math.max(m, r.total), 1);

  return `
    ${renderPageHeader()}
    <!-- 行 1：8 个核心 KPI（一行） -->
    <section class="dash-kpi-row">
      <div class="kpi-card"><div class="kpi-card__label">终端诊所</div><div class="kpi-card__value">${clinics.length}</div><div class="kpi-card__hint">${active} 启用 / ${clinics.length - active} 暂停</div></div>
      <div class="kpi-card kpi-card--indigo"><div class="kpi-card__label">活跃账号</div><div class="kpi-card__value">${users.length}</div><div class="kpi-card__hint">总部 ${platformAdmins} · 省级 ${provinceAdmins} · 地市 ${cityAdmins} · 门店 ${storeUsers}</div></div>
      <div class="kpi-card kpi-card--teal"><div class="kpi-card__label">营销发布</div><div class="kpi-card__value">${ms.total}</div><div class="kpi-card__hint">已发布 ${ms.published}</div></div>
      <div class="kpi-card kpi-card--amber"><div class="kpi-card__label">采购金额</div><div class="kpi-card__value">${money(sales || data.metrics.purchaseAmount)}</div><div class="kpi-card__hint">${data.metrics.packagePurchases ?? 0} 笔</div></div>
      <div class="kpi-card kpi-card--rose"><div class="kpi-card__label">进行中任务</div><div class="kpi-card__value">${tasksOpen}</div><div class="kpi-card__hint">完成率 ${data.metrics.taskCompletionRate ?? 0}%</div></div>
      <div class="kpi-card"><div class="kpi-card__label">活动转化</div><div class="kpi-card__value">${conversionRate}%</div><div class="kpi-card__hint">${newLeads} 线索 / ${conv} 成交</div></div>
      <div class="kpi-card kpi-card--indigo"><div class="kpi-card__label">内容文章</div><div class="kpi-card__value">${as.total}</div><div class="kpi-card__hint">分类 ${Object.keys(as.byCategory ?? {}).length} 个</div></div>
      <div class="kpi-card kpi-card--teal"><div class="kpi-card__label">健康均分</div><div class="kpi-card__value">${avgHealth}</div><div class="kpi-card__hint">良好 ${healthGood} · 预警 ${healthMid} · 风险 ${healthBad}</div></div>
    </section>

    <!-- 行 2：3 列 — 健康 / 发布 / 漏斗 -->
    <section class="dash-3col">
      <div class="panel">
        <h3>🏥 门诊健康评分 <span class="meta">${hs.length} 家 · ${healthGood} 良好</span></h3>
        <div class="dash-health-bars">
          ${healthTop.length === 0 ? `<div class="empty-state" style="padding:20px"><div class="empty-state__title">暂无数据</div></div>` : healthTop.map((h) => {
            const tone = h.score >= 70 ? "green" : h.score >= 40 ? "gold" : "rose";
            return `<div class="bar-chart">
              <div class="bar-chart__label"><span><strong>${html(h.name)}</strong><small class="muted">${html(h.city)}</small></span><span>${badge(`${h.score}分`, tone)}</span></div>
              <div class="bar-chart__track"><div class="bar-chart__bar bar-chart__bar--${tone}" style="transform:scaleX(${(h.score / 100).toFixed(3)})"></div></div>
            </div>`;
          }).join("")}
        </div>
      </div>

      <div class="panel">
        <h3>📢 内容 · 各门诊发布 <span class="meta">营销 + 文章</span></h3>
        ${publishRows.length === 0 ? `<div class="empty-state" style="padding:20px"><div class="empty-state__title">暂无发布</div></div>` : `<table class="dash-mini-table">
          <thead><tr><th>诊所</th><th>营销</th><th>文章</th></tr></thead>
          <tbody>${publishRows.map((r) => `<tr>
            <td><strong>${html(r.name)}</strong><br><span class="muted" style="font-size:11px">${html(r.city)}</span></td>
            <td class="num">${r.marketing}</td>
            <td class="num">${r.articles}</td>
          </tr>`).join("")}</tbody>
        </table>`}
      </div>

      <div class="panel">
        <h3>📈 活动漏斗 <span class="meta">Top ${funnelTop5.length} 活动</span></h3>
        <div class="dash-funnel-mini">
          ${funnelTop5.length === 0 ? `<div class="empty-state" style="padding:20px"><div class="empty-state__title">暂无活动</div></div>` : funnelTop5.map((row) => {
            const pct = Math.round((row.total / funnelTop5Max) * 100);
            const conv = row.breakdown.CONVERTED ?? 0;
            const convPct = row.total ? Math.round((conv / row.total) * 100) : 0;
            return `<div class="dash-funnel-mini__row">
              <div class="stage">${html(row.title.length > 8 ? row.title.slice(0, 7) + "…" : row.title)}</div>
              <div class="bar"><div style="width:${pct}%"></div></div>
              <div class="num">${row.total}</div>
              <div class="pct">${convPct}%</div>
            </div>`;
          }).join("")}
        </div>
      </div>
    </section>

    <!-- 行 3：2 列 — 活动漏斗详表 / 终端诊所 Top 8 -->
    <section class="dash-2col">
      <div class="panel">
        <h3>📊 活动漏斗（按报名数倒序，Top 8）<span class="meta">${funnel.length} 个活动</span></h3>
        ${funnel.length === 0 ? `<div class="empty-state" style="padding:24px"><div class="empty-state__title">暂无活动数据</div><div class="empty-state__sub">门店端采纳活动模板后会在此汇聚</div></div>` : `<table class="dash-mini-table">
          <thead><tr><th>活动</th><th>报名</th><th>已联系</th><th>到店</th><th>成交</th><th>转化</th></tr></thead>
          <tbody>${[...funnel].sort((a, b) => b.total - a.total).slice(0, 8).map((row) => {
            const convPct = row.total ? Math.round((row.breakdown.CONVERTED / row.total) * 100) : 0;
            const tone = convPct >= 30 ? "green" : convPct >= 10 ? "gold" : "rose";
            return `<tr>
              <td><strong>${html(row.title)}</strong><br><span class="muted" style="font-size:11px">${html(clinicName(row.clinicId))}</span></td>
              <td class="num">${row.total}</td>
              <td class="num">${row.breakdown.CONTACTED ?? 0}</td>
              <td class="num">${row.breakdown.ATTENDED ?? 0}</td>
              <td class="num">${row.breakdown.CONVERTED ?? 0}</td>
              <td class="num">${badge(`${convPct}%`, tone)}</td>
            </tr>`;
          }).join("")}</tbody>
        </table>`}
      </div>

      <div class="panel">
        <h3>🏪 终端诊所 Top 8<span class="meta">按销售额</span></h3>
        ${topClinics.length === 0 ? `<div class="empty-state" style="padding:24px"><div class="empty-state__title">暂无销售数据</div></div>` : `<div class="dash-clinic-list">
          ${topClinics.map((item, i) => `<div class="dash-clinic-list__row">
            <div class="idx">${i + 1}</div>
            <div class="name">${html(item.name)}<small>${html(item.city)} · ${html(item.level || "")}</small></div>
            <div class="val">${money(item.monthlySales)}</div>
            <div class="delta">${badge(labelOf(CLINIC_STATUS_LABELS, item.status), item.status === "ACTIVE" ? "green" : "rose")}</div>
          </div>`).join("")}
        </div>`}
      </div>
    </section>

    <!-- 行 4：代理商 KPI（5 张卡） -->
    <section class="dash-kpi-row">
      <div class="kpi-card"><div class="kpi-card__label">代理商总数</div><div class="kpi-card__value">${am.agentCount}</div><div class="kpi-card__hint">活跃 ${am.activeAgentCount} 家</div></div>
      <div class="kpi-card kpi-card--indigo"><div class="kpi-card__label">新签终端（30 天）</div><div class="kpi-card__value">${am.newClinicsLast30d}</div><div class="kpi-card__hint">按代理商归属汇总</div></div>
      <div class="kpi-card kpi-card--teal"><div class="kpi-card__label">代理商累计销售</div><div class="kpi-card__value" style="font-size:22px">${money(am.totalSalesByAgent)}</div><div class="kpi-card__hint">所有代理商合计</div></div>
      <div class="kpi-card kpi-card--amber"><div class="kpi-card__label">本月代理商销售</div><div class="kpi-card__value" style="font-size:22px">${money(am.monthSalesByAgent)}</div><div class="kpi-card__hint">当月新成交</div></div>
      <div class="kpi-card kpi-card--rose"><div class="kpi-card__label">代理商均销售</div><div class="kpi-card__value" style="font-size:22px">${money(am.avgRevenuePerAgent)}</div><div class="kpi-card__hint">代理商均值</div></div>
    </section>

    <!-- 行 5：代理账号（省级/市级）概览（Top 8 by 累计销售） + 推广漏斗 -->
    <section class="dash-2col">
      <div class="panel">
        <h3>🏢 代理账号概览 <span class="meta">省级 / 市级管理员，按累计销售倒序</span></h3>
        ${agentRows.length === 0 ? `<div class="empty-state" style="padding:24px"><div class="empty-state__title">暂无代理账号数据</div><div class="empty-state__sub">当前所辖范围内无省级 / 市级账号</div></div>` : `<div class="table-wrap"><table class="dash-mini-table">
          <thead><tr><th>代理</th><th>角色</th><th>辖区</th><th>终端数</th><th>本月销售</th><th>累计销售</th><th>推广</th><th>转化</th></tr></thead>
          <tbody>${agentRows.map((r) => {
            const tone = r.conversionRate >= 30 ? "green" : r.conversionRate >= 10 ? "gold" : "rose";
            const roleLabel = r.adminRole === "PROVINCE_ADMIN" ? "省级" : r.adminRole === "CITY_ADMIN" ? "市级" : r.adminRole;
            const roleTone = r.adminRole === "PROVINCE_ADMIN" ? "indigo" : "blue";
            const scope = r.managedCities.length > 0
              ? r.managedCities.slice(0, 3).join("、") + (r.managedCities.length > 3 ? ` 等 ${r.managedCities.length} 个` : "")
              : (r.province || "—");
            return `<tr>
              <td><strong>${html(r.name)}</strong><br><span class="muted" style="font-size:11px">活跃 ${r.activeClinicCount} / 新签 ${r.newClinicsLast30d}</span></td>
              <td>${badge(roleLabel, roleTone)}</td>
              <td><span class="muted" style="font-size:12px">${html(scope)}</span></td>
              <td class="num">${r.clinicCount}</td>
              <td class="num">${money(r.monthSales)}</td>
              <td class="num">
                <div class="bar-chart" style="margin:0">
                  <div class="bar-chart__label"><span><strong>${money(r.totalSales)}</strong></span><span class="muted">${Math.round((r.totalSales / agentMaxSales) * 100)}%</span></div>
                  <div class="bar-chart__track"><div class="bar-chart__bar bar-chart__bar--green" style="transform:scaleX(${(r.totalSales / agentMaxSales).toFixed(3)})"></div></div>
                </div>
              </td>
              <td class="num">${r.totalEnrollments}<br><span class="muted" style="font-size:11px">本月 ${r.monthEnrollments}</span></td>
              <td class="num">${badge(`${r.conversionRate}%`, tone)}</td>
            </tr>`;
          }).join("")}</tbody>
        </table></div>`}
      </div>

      <div class="panel">
        <h3>📣 代理推广效果 <span class="meta">累计 / 本月</span></h3>
        <div class="dash-funnel-mini">
          <div class="dash-funnel-mini__row">
            <div class="stage">累计线索</div>
            <div class="bar"><div style="width:100%"></div></div>
            <div class="num">${am.totalEnrollmentsByAgent}</div>
            <div class="pct muted">—</div>
          </div>
          <div class="dash-funnel-mini__row">
            <div class="stage">本月线索</div>
            <div class="bar"><div style="width:${am.totalEnrollmentsByAgent > 0 ? Math.round((am.monthEnrollmentsByAgent / am.totalEnrollmentsByAgent) * 100) : 0}%"></div></div>
            <div class="num">${am.monthEnrollmentsByAgent}</div>
            <div class="pct muted">—</div>
          </div>
          <div class="dash-funnel-mini__row">
            <div class="stage">本月销售</div>
            <div class="bar"><div style="width:${am.totalSalesByAgent > 0 ? Math.round((am.monthSalesByAgent / am.totalSalesByAgent) * 100) : 0}%"></div></div>
            <div class="num">${money(am.monthSalesByAgent)}</div>
            <div class="pct muted">—</div>
          </div>
          <div class="dash-funnel-mini__row">
            <div class="stage">代理商数</div>
            <div class="bar"><div style="width:100%"></div></div>
            <div class="num">${am.agentCount}</div>
            <div class="pct muted">活跃 ${am.activeAgentCount}</div>
          </div>
        </div>
      </div>
    </section>
  `;
}

type ReportPayload = {
  rows: Array<{
    clinicId: string; name: string; city: string; level: string; status: string;
    userCount: number; campaignCount: number; enrollmentCount: number; conversionCount: number; conversionRate: number;
    followUpDone: number; followUpTotal: number; taskDone: number; taskTotal: number; taskCompletionRate: number;
    purchaseAmount: number; purchaseCount: number; patientCount: number; revisitPending: number;
  }>;
  funnel: Array<{ status: string; count: number }>;
  range: { from: string | null; to: string | null; applied: boolean };
  topPerformers: Array<{ clinicId: string; name: string; city: string; purchaseAmount: number; conversionRate: number }>;
  leaderboards: {
    bySales: Array<{ clinicId: string; name: string; city: string; value: number; secondary: number }>;
    byConversion: Array<{ clinicId: string; name: string; city: string; value: number; secondary: number }>;
    byTaskCompletion: Array<{ clinicId: string; name: string; city: string; value: number; secondary: number }>;
    byPatients: Array<{ clinicId: string; name: string; city: string; value: number; secondary: number }>;
    byEnrollments: Array<{ clinicId: string; name: string; city: string; value: number; secondary: number }>;
    needsAttention: Array<{ clinicId: string; name: string; city: string; value: number; secondary: number; taskTotal: number }>;
  };
  cities: string[];
  summary: {
    clinicCount: number; activeClinicCount: number; totalSales: number; totalEnrollments: number;
    totalConversions: number; overallConversionRate: number; totalPatients: number;
    totalTaskDone: number; totalTask: number; taskCompletionRate: number; avgRevenuePerClinic: number;
  };
};

function leaderboardPanel(title: string, hint: string, rows: Array<{ clinicId: string; name: string; city: string; value: number; secondary: number; taskTotal?: number }>, valueFormatter: (v: number) => string, secondaryLabel: (s: number, taskTotal?: number) => string, secondaryTone: (s: number) => "green" | "gold" | "rose" | "muted", empty: string) {
  if (rows.length === 0) {
    return `<div class="panel"><div class="toolbar"><h3>${html(title)}</h3>${badge(hint, "blue")}</div><div class="empty-state"><div class="empty-state__title">${html(empty)}</div></div></div>`;
  }
  return `
    <div class="panel">
      <div class="toolbar"><h3>${html(title)}</h3>${badge(hint, "blue")}</div>
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>诊所</th><th>城市</th><th>数值</th><th>辅值</th></tr></thead>
        <tbody>${rows.map((r, i) => {
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
          return `<tr>
            <td><strong>${medal}</strong></td>
            <td><strong>${html(r.name)}</strong></td>
            <td>${html(r.city)}</td>
            <td><strong>${html(valueFormatter(r.value))}</strong></td>
            <td>${badge(secondaryLabel(r.secondary, r.taskTotal), secondaryTone(r.secondary))}</td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>
    </div>`;
}

function renderReports() {
  const data = state.reports;
  if (!data) {
    return `${renderPageHeader()}<div class="empty-state"><div class="empty-state__title">加载中…</div></div>`;
  }
  const s = data.summary;
  return `
    ${renderPageHeader()}
    <section class="panel">
      <div class="toolbar">
        <h3>时间范围</h3>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="secondary" data-reports-preset="7" type="button">近 7 天</button>
          <button class="secondary" data-reports-preset="30" type="button">近 30 天</button>
          <button class="secondary" data-reports-preset="90" type="button">近 90 天</button>
          <button class="secondary" data-reports-preset="all" type="button">全部</button>
          <span class="muted">自定义：</span>
          <input type="date" id="reportsFrom" value="${state.reportsFrom ?? ""}" />
          <span class="muted">至</span>
          <input type="date" id="reportsTo" value="${state.reportsTo ?? ""}" />
          ${data.range.applied ? badge(`${(data.range.from ?? "").slice(0, 10)} → ${(data.range.to ?? "").slice(0, 10)}`, "blue") : badge("全部时间", "muted")}
        </div>
      </div>
    </section>
    <section class="kpi-grid">
      <div class="kpi-card"><div class="kpi-card__label">终端诊所</div><div class="kpi-card__value">${s.clinicCount}</div><div class="kpi-card__hint">${s.activeClinicCount} 家启用</div></div>
      <div class="kpi-card kpi-card--indigo"><div class="kpi-card__label">总销售额</div><div class="kpi-card__value">${money(s.totalSales)}</div><div class="kpi-card__hint">门店均值 ${money(s.avgRevenuePerClinic)}</div></div>
      <div class="kpi-card kpi-card--teal"><div class="kpi-card__label">总线索 / 总成交</div><div class="kpi-card__value">${s.totalEnrollments} / ${s.totalConversions}</div><div class="kpi-card__hint">整体转化率 ${s.overallConversionRate}%</div></div>
      <div class="kpi-card kpi-card--amber"><div class="kpi-card__label">总部任务完成率</div><div class="kpi-card__value">${s.taskCompletionRate}%</div><div class="kpi-card__hint">${s.totalTaskDone}/${s.totalTask}</div></div>
    </section>
    <section class="split">
      <div class="panel">
        <div class="toolbar"><h3>Top 5 门店（按成交额）</h3></div>
        <div class="table-wrap"><table>
          <thead><tr><th>诊所</th><th>城市</th><th>成交额</th><th>转化率</th></tr></thead>
          <tbody>${data.topPerformers.map((r) => `<tr>
            <td><strong>${html(r.name)}</strong></td>
            <td>${html(r.city)}</td>
            <td><strong>${money(r.purchaseAmount)}</strong></td>
            <td>${badge(`${r.conversionRate}%`, r.conversionRate >= 30 ? "green" : r.conversionRate >= 10 ? "gold" : "rose")}</td>
          </tr>`).join("") || `<tr><td colspan="4" class="muted">暂无数据</td></tr>`}</tbody>
        </table></div>
      </div>
      <div class="panel">
        <h3>活动漏斗（scope 内全部）</h3>
        <p class="muted">NEW → CONTACTED → ATTENDED → CONVERTED</p>
        <div class="table-wrap"><table>
          <thead><tr><th>阶段</th><th>数量</th></tr></thead>
          <tbody>${data.funnel.map((f) => {
            const labelMap: Record<string, string> = { NEW: "线索", CONTACTED: "已联系", ATTENDED: "已到店", CONVERTED: "已成交", CANCELLED: "已取消" };
            return `<tr><td>${labelMap[f.status] ?? f.status}</td><td><strong>${f.count}</strong></td></tr>`;
          }).join("")}</tbody>
        </table></div>
      </div>
    </section>
    <section class="split">
      ${leaderboardPanel("成交额 Top 10", "按销售总额", data.leaderboards.bySales, (v) => money(v), (s) => `转化率 ${s}%`, (s) => s >= 30 ? "green" : s >= 10 ? "gold" : "muted", "暂无销售数据")}
      ${leaderboardPanel("转化率 Top 10", "线索 ≥ 3", data.leaderboards.byConversion, (v) => `${v}%`, (s) => `${s} 条线索`, (s) => s >= 10 ? "green" : "muted", "暂无足够线索样本")}
    </section>
    <section class="split">
      ${leaderboardPanel("任务完成率 Top 10", "按完成率", data.leaderboards.byTaskCompletion, (v) => `${v}%`, (s) => `${s} 个已完成`, (s) => s >= 10 ? "green" : "muted", "暂无任务数据")}
      ${leaderboardPanel("患者规模 Top 10", "按患者数", data.leaderboards.byPatients, (v) => `${v} 人`, (s) => `${s} 待复查`, (s) => s > 0 ? "rose" : "green", "暂无患者数据")}
    </section>
    <section class="split">
      ${leaderboardPanel("活跃度 Top 10", "按线索数", data.leaderboards.byEnrollments, (v) => `${v} 条`, (s) => `${s} 已成交`, (s) => s > 0 ? "green" : "muted", "暂无线索数据")}
      ${leaderboardPanel("⚠ 需关注门店", "任务完成率最低 5 家", data.leaderboards.needsAttention, (v) => `${v}%`, (s, t) => `${s}/${t ?? "?"} 完成`, (s) => s === 0 ? "rose" : "gold", "无")}
    </section>
    <section class="panel">
      <div class="toolbar">
        <h3>全部门店经营数据</h3>
        <select id="reportsCityFilter">
          <option value="">全部城市</option>
          ${data.cities.map((c) => `<option value="${html(c)}" ${state.reportsCityFilter === c ? "selected" : ""}>${html(c)}</option>`).join("")}
        </select>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>诊所</th><th>城市</th><th>等级</th><th>状态</th><th>账号</th><th>活动</th><th>线索</th><th>成交</th><th>转化率</th><th>复诊</th><th>任务完成</th><th>套餐 / 销售额</th><th>患者</th></tr></thead>
        <tbody>${data.rows.map((r) => {
          const convTone = r.conversionRate >= 30 ? "green" : r.conversionRate >= 10 ? "gold" : "rose";
          const taskTone = r.taskCompletionRate >= 80 ? "green" : r.taskCompletionRate >= 40 ? "gold" : "rose";
          return `<tr>
            <td><strong>${html(r.name)}</strong></td>
            <td>${html(r.city)}</td>
            <td>${badge(r.level, "gold")}</td>
            <td>${badge(r.status, r.status === "ACTIVE" ? "green" : "rose")}</td>
            <td>${r.userCount}</td>
            <td>${r.campaignCount}</td>
            <td>${r.enrollmentCount}</td>
            <td><strong>${r.conversionCount}</strong></td>
            <td>${badge(r.enrollmentCount ? `${r.conversionRate}%` : "-", r.enrollmentCount ? convTone : "muted")}</td>
            <td>${r.followUpTotal ? `${r.followUpDone}/${r.followUpTotal}` : "-"}</td>
            <td>${r.taskTotal ? `${r.taskDone}/${r.taskTotal} (${r.taskCompletionRate}%)` : "-"}</td>
            <td>${r.purchaseCount} / <strong>${money(r.purchaseAmount)}</strong></td>
            <td>${r.patientCount}${r.revisitPending > 0 ? ` <span class="muted">(${r.revisitPending} 待复查)</span>` : ""}</td>
          </tr>`;
        }).join("") || `<tr><td colspan="13" class="muted">暂无诊所</td></tr>`}</tbody>
      </table></div>
    </section>`;
}

function renderReportsManagement() {
  const data = state.reports;
  if (!data) {
    return `${renderPageHeader()}<div class="empty-state"><div class="empty-state__title">加载中…</div></div>`;
  }
  const s = data.summary;
  const riskOf = (row: ReportPayload["rows"][number]) => {
    let score = 0;
    const reasons: string[] = [];
    if (row.status !== "ACTIVE") { score += 4; reasons.push("门店未启用"); }
    if (row.taskTotal > 0 && row.taskCompletionRate < 40) { score += 3; reasons.push("任务推进慢"); }
    else if (row.taskTotal > 0 && row.taskCompletionRate < 70) { score += 1; reasons.push("任务待跟进"); }
    if (row.enrollmentCount >= 3 && row.conversionRate < 10) { score += 3; reasons.push("转化偏低"); }
    else if (row.enrollmentCount >= 3 && row.conversionRate < 20) { score += 1; reasons.push("转化待提升"); }
    if (row.revisitPending >= 5) { score += 3; reasons.push("复诊积压"); }
    else if (row.revisitPending > 0) { score += 1; reasons.push("有待复诊"); }
    if (row.userCount === 0) { score += 3; reasons.push("无启用账号"); }
    const level = score >= 5 ? "CRITICAL" : score >= 2 ? "ATTENTION" : "HEALTHY";
    return { score, level: level as "CRITICAL" | "ATTENTION" | "HEALTHY", reasons };
  };
  const riskMeta = {
    CRITICAL: { label: "重点处置", tone: "rose" as const },
    ATTENTION: { label: "持续跟进", tone: "gold" as const },
    HEALTHY: { label: "经营正常", tone: "green" as const }
  };
  const query = state.reportsQuery.trim().toLowerCase();
  const rowsWithRisk = data.rows.map((row) => ({ row, risk: riskOf(row) }));
  const riskCounts = rowsWithRisk.reduce((acc, item) => {
    acc[item.risk.level] += 1;
    return acc;
  }, { CRITICAL: 0, ATTENTION: 0, HEALTHY: 0 });
  const visibleRows = rowsWithRisk
    .filter(({ row, risk }) => !query || `${row.name} ${row.city} ${row.level}`.toLowerCase().includes(query) || risk.reasons.some((reason) => reason.includes(query)))
    .filter(({ risk }) => state.reportsRiskFilter === "ALL" || risk.level === state.reportsRiskFilter)
    .sort((a, b) => {
      if (state.reportsSort === "sales") return b.row.purchaseAmount - a.row.purchaseAmount;
      if (state.reportsSort === "conversion") return b.row.conversionRate - a.row.conversionRate;
      if (state.reportsSort === "tasks") return b.row.taskCompletionRate - a.row.taskCompletionRate;
      if (state.reportsSort === "patients") return b.row.patientCount - a.row.patientCount;
      return b.risk.score - a.risk.score || b.row.purchaseAmount - a.row.purchaseAmount;
    });
  const funnelMap = Object.fromEntries(data.funnel.map((item) => [item.status, item.count]));
  const rangeLabel = data.range.applied
    ? `${(data.range.from ?? "").slice(0, 10)} 至 ${(data.range.to ?? "").slice(0, 10)}`
    : "全部经营周期";

  return `
    ${renderPageHeader()}
    <section class="reports-command">
      <div class="reports-command__heading">
        <div>
          <span class="reports-command__eyebrow">经营统筹中心</span>
          <h2>门店经营管理台账</h2>
          <p>统一查看门店产出、转化效率、任务执行和患者运营风险。</p>
        </div>
        <div class="reports-command__range"><span>当前统计周期</span><strong>${html(rangeLabel)}</strong></div>
      </div>
      <div class="reports-summary-strip">
        <div class="reports-summary-item"><span>管理门店</span><strong>${s.clinicCount}</strong><small>${s.activeClinicCount} 家正常启用</small></div>
        <div class="reports-summary-item is-primary"><span>经营产出</span><strong>${money(s.totalSales)}</strong><small>店均 ${money(s.avgRevenuePerClinic)}</small></div>
        <div class="reports-summary-item"><span>线索转化</span><strong>${s.overallConversionRate}%</strong><small>${s.totalConversions} / ${s.totalEnrollments} 成交</small></div>
        <div class="reports-summary-item"><span>任务执行</span><strong>${s.taskCompletionRate}%</strong><small>${s.totalTaskDone} / ${s.totalTask} 完成</small></div>
        <div class="reports-summary-item is-alert"><span>重点处置</span><strong>${riskCounts.CRITICAL}</strong><small>${riskCounts.ATTENTION} 家持续跟进</small></div>
      </div>
    </section>
    <section class="reports-operations">
      <div class="reports-filterbar">
        <div class="reports-filterbar__presets">
          <button class="secondary" data-reports-preset="7" type="button">近 7 天</button>
          <button class="secondary" data-reports-preset="30" type="button">近 30 天</button>
          <button class="secondary" data-reports-preset="90" type="button">近 90 天</button>
          <button class="secondary" data-reports-preset="all" type="button">全部</button>
        </div>
        <div class="reports-filterbar__fields">
          <input type="date" id="reportsFrom" value="${state.reportsFrom ?? ""}" aria-label="统计开始日期" />
          <span>至</span>
          <input type="date" id="reportsTo" value="${state.reportsTo ?? ""}" aria-label="统计结束日期" />
          <select id="reportsCityFilter" aria-label="城市筛选">
            <option value="">全部城市</option>
            ${data.cities.map((city) => `<option value="${html(city)}" ${state.reportsCityFilter === city ? "selected" : ""}>${html(city)}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="reports-controlbar">
        <div class="reports-risk-tabs">
          ${([
            ["ALL", "全部门店", s.clinicCount],
            ["CRITICAL", "重点处置", riskCounts.CRITICAL],
            ["ATTENTION", "持续跟进", riskCounts.ATTENTION],
            ["HEALTHY", "经营正常", riskCounts.HEALTHY]
          ] as Array<[typeof state.reportsRiskFilter, string, number]>).map(([key, label, count]) => `<button type="button" data-reports-risk="${key}" class="${state.reportsRiskFilter === key ? "active" : ""}"><span>${label}</span><strong>${count}</strong></button>`).join("")}
        </div>
        <div class="reports-controlbar__tools">
          <input id="reportsQuery" value="${html(state.reportsQuery)}" placeholder="搜索门店、城市或风险原因" />
          <select id="reportsSort" aria-label="经营数据排序">
            <option value="risk" ${state.reportsSort === "risk" ? "selected" : ""}>风险优先</option>
            <option value="sales" ${state.reportsSort === "sales" ? "selected" : ""}>销售额从高到低</option>
            <option value="conversion" ${state.reportsSort === "conversion" ? "selected" : ""}>转化率从高到低</option>
            <option value="tasks" ${state.reportsSort === "tasks" ? "selected" : ""}>任务完成率从高到低</option>
            <option value="patients" ${state.reportsSort === "patients" ? "selected" : ""}>患者规模从高到低</option>
          </select>
        </div>
      </div>
      <div class="reports-funnel-line">
        <span>线索漏斗</span><strong>${funnelMap.NEW ?? 0}</strong><small>新增</small><i></i>
        <strong>${funnelMap.CONTACTED ?? 0}</strong><small>已联系</small><i></i>
        <strong>${funnelMap.ATTENDED ?? 0}</strong><small>已到店</small><i></i>
        <strong>${funnelMap.CONVERTED ?? 0}</strong><small>已成交</small>
      </div>
      <div class="reports-ledger-head">
        <div><h3>门店经营台账</h3><p>当前展示 ${visibleRows.length} 家门店，点击门店名称查看详细档案。</p></div>
        ${badge(`患者总量 ${s.totalPatients}`, "blue")}
      </div>
      <div class="table-wrap reports-ledger"><table>
        <thead><tr><th>门店 / 管理状态</th><th>风险判断</th><th>销售产出</th><th>线索转化</th><th>任务执行</th><th>患者运营</th><th>人员 / 活动</th><th>管理动作</th></tr></thead>
        <tbody>${visibleRows.map(({ row, risk }) => {
          const riskStyle = riskMeta[risk.level];
          const conversionTone = row.conversionRate >= 30 ? "green" : row.conversionRate >= 10 ? "gold" : "rose";
          const taskTone = row.taskCompletionRate >= 80 ? "green" : row.taskCompletionRate >= 40 ? "gold" : "rose";
          return `<tr class="reports-ledger__row reports-ledger__row--${risk.level.toLowerCase()}">
            <td><button class="reports-clinic-link" type="button" data-clinic-detail="${html(row.clinicId)}">${html(row.name)}</button><div class="reports-cell-meta">${html(row.city)} · ${html(row.level)} · ${badge(row.status === "ACTIVE" ? "启用" : row.status, row.status === "ACTIVE" ? "green" : "rose")}</div></td>
            <td>${badge(riskStyle.label, riskStyle.tone)}<div class="reports-cell-meta">${html(risk.reasons.slice(0, 2).join("、") || "指标稳定")}</div></td>
            <td><strong class="reports-metric">${money(row.purchaseAmount)}</strong><div class="reports-cell-meta">${row.purchaseCount} 笔成交</div></td>
            <td><strong class="reports-metric">${row.conversionRate}%</strong><div class="reports-cell-meta">${row.conversionCount}/${row.enrollmentCount} · ${badge(row.enrollmentCount ? `${row.conversionRate}%` : "无样本", row.enrollmentCount ? conversionTone : "muted")}</div></td>
            <td><strong class="reports-metric">${row.taskCompletionRate}%</strong><div class="reports-cell-meta">${row.taskDone}/${row.taskTotal} · ${badge(row.taskTotal ? `${row.taskCompletionRate}%` : "无任务", row.taskTotal ? taskTone : "muted")}</div></td>
            <td><strong class="reports-metric">${row.patientCount}</strong><div class="reports-cell-meta">${row.revisitPending > 0 ? badge(`${row.revisitPending} 待复诊`, "rose") : badge("无复诊积压", "green")}</div></td>
            <td><strong>${row.userCount}</strong> 个账号<div class="reports-cell-meta">${row.campaignCount} 个活动</div></td>
            <td><button class="secondary sm" type="button" data-clinic-detail="${html(row.clinicId)}">查看门店</button></td>
          </tr>`;
        }).join("") || `<tr><td colspan="8"><div class="empty-state"><div class="empty-state__title">没有符合条件的门店</div><div class="empty-state__sub">调整城市、风险等级或搜索条件后再试。</div></div></td></tr>`}</tbody>
      </table></div>
    </section>`;
}

async function loadNotifAudience() {
  state.notifAudience = await api("/api/admin/notifications");
}

function progressBar(rate: number) {
  const clamped = Math.max(0, Math.min(100, rate));
  const tone = clamped >= 80 ? "green" : clamped >= 40 ? "gold" : "rose";
  return `<div class="progress" title="${clamped}%"><div class="progress__bar progress__bar--${tone}" style="width:${clamped}%"></div></div>`;
}

function renderDispatchSection(title: string, hint: string, rows: Array<{ id: string; primary: string; secondary?: string; meta: string; rate: number; badge?: string; rateTone?: "good" | "warn" | "bad"; canViewDetail?: boolean }>, empty: string) {
  return `
    <div class="panel">
      <div class="toolbar"><h3>${html(title)}</h3>${badge(hint, "blue")}</div>
      ${rows.length === 0
        ? `<div class="empty-state"><div class="empty-state__title">${html(empty)}</div></div>`
        : `<div class="table-wrap"><table>
            <thead><tr><th>名称</th><th>下发对象 / 进度</th><th>完成率</th><th>状态 / 操作</th></tr></thead>
            <tbody>${rows.map((row) => `<tr>
              <td><strong>${html(row.primary)}</strong>${row.secondary ? `<br><span class="muted">${html(row.secondary)}</span>` : ""}</td>
              <td>${html(row.meta)}</td>
              <td style="min-width:140px">${progressBar(row.rate)}${row.rateTone ? badge(`${row.rate}%`, row.rateTone === "good" ? "green" : row.rateTone === "warn" ? "gold" : "rose") : ""}</td>
              <td>${row.badge ?? "-"}${row.canViewDetail ? `<button class="secondary sm dispatch-detail-button" type="button" data-dispatch-detail="${html(row.id)}">查看明细</button>` : ""}</td>
            </tr>`).join("")}</tbody>
          </table></div>`}
    </div>`;
}

function renderDispatch() {
  const data = state.dispatch;
  if (!data) {
    return `${renderPageHeader()}<div class="empty-state"><div class="empty-state__title">加载中…</div></div>`;
  }
  const s = data.summary;
  return `
    ${renderPageHeader()}
    <section class="kpi-grid">
      <div class="kpi-card"><div class="kpi-card__label">总部任务下发</div><div class="kpi-card__value">${s.taskCount}</div><div class="kpi-card__hint">平均完成率 ${s.taskAvgCompletion}%</div></div>
      <div class="kpi-card kpi-card--${s.taskOverdue > 0 ? "rose" : "teal"}"><div class="kpi-card__label">逾期任务</div><div class="kpi-card__value">${s.taskOverdue}</div><div class="kpi-card__hint">已超过截止时间的任务数</div></div>
      <div class="kpi-card kpi-card--indigo"><div class="kpi-card__label">活动模板下发</div><div class="kpi-card__value">${s.templateCount}</div><div class="kpi-card__hint">共产生 ${s.templateTotalEnrollments} 条线索</div></div>
      <div class="kpi-card kpi-card--amber"><div class="kpi-card__label">营销稿模板</div><div class="kpi-card__value">${s.marketingTemplateCount}</div><div class="kpi-card__hint">已采纳门店 ${s.marketingAdoptedTotal}</div></div>
    </section>
    ${renderDispatchSection(
      "任务下发进度",
      `${s.taskCount} 个`,
      data.taskDispatches.map((row) => ({
        id: row.id,
        primary: row.title,
        secondary: `${row.category} · ${row.priority}${row.dueAt ? " · 截止 " + new Date(row.dueAt).toLocaleDateString("zh-CN") : ""}`,
        meta: `${row.completedClinics}/${row.targetClinics} 已完成${row.lateCount > 0 ? " · 逾期 " + row.lateCount : ""}`,
        rate: row.completionRate,
        rateTone: row.completionRate >= 80 ? "good" : row.completionRate >= 40 ? "warn" : "bad",
        badge: row.status === "DONE" ? badge("已结束", "green") : row.lateCount > 0 ? badge("有逾期", "rose") : badge("进行中", "blue"),
        canViewDetail: true
      })),
      "暂无下发任务"
    )}
    ${renderDispatchSection(
      "活动模板下发追踪",
      `${s.templateCount} 个模板`,
      data.templateDispatches.map((row) => ({
        id: row.id,
        primary: row.title,
        secondary: `${row.category} · v${row.version} · 已采纳 ${row.targetClinics} 家`,
        meta: `线索 ${row.enrollments.total} · 已成交 ${row.enrollments.CONVERTED} · 转化 ${row.conversionRate}%`,
        rate: row.conversionRate,
        rateTone: row.conversionRate >= 30 ? "good" : row.conversionRate >= 10 ? "warn" : "bad",
        badge: badge(labelOf(CLINIC_STATUS_LABELS, row.status), row.status === "PUBLISHED" ? "green" : "gold")
      })),
      "暂无下发活动模板"
    )}
    ${renderDispatchSection(
      "营销稿模板采纳追踪",
      `${s.marketingTemplateCount} 个`,
      data.marketingDispatches.map((row) => ({
        id: row.id,
        primary: row.title,
        secondary: `${row.type} · 已采纳 ${row.adoptedClinics} 家 · 已发布 ${row.publishedClinics}`,
        meta: `推送记录 ${row.pushedClinics} 条${row.pushedAt ? " · 推送时间 " + compactDateTime(row.pushedAt) : ""}`,
        rate: row.adoptedClinics > 0 ? Math.round((row.publishedClinics / row.adoptedClinics) * 100) : 0,
        rateTone: row.adoptedClinics > 0 && row.publishedClinics === row.adoptedClinics ? "good" : "warn",
        badge: badge(`${row.adoptedClinics} 家采纳`, "blue")
      })),
      "暂无下发营销稿"
    )}
    ${state.dispatchDetail ? `<div class="drawer-backdrop" data-close-dispatch-detail><aside class="drawer dispatch-detail-drawer" onclick="event.stopPropagation()"><div class="drawer__head"><div><span>下发追踪明细</span><h2>${html(state.dispatchDetail.title)}</h2></div><button class="secondary" type="button" data-close-dispatch-detail>关闭</button></div><div class="dispatch-detail-summary"><strong>${state.dispatchDetail.recipients.filter((item) => item.status === "DONE").length}</strong><span>已完成</span><strong>${state.dispatchDetail.recipients.filter((item) => item.status !== "DONE").length}</strong><span>未完成</span></div><div class="table-wrap"><table><thead><tr><th>诊所</th><th>注册手机号</th><th>状态</th><th>完成时间</th></tr></thead><tbody>${state.dispatchDetail.recipients.map((item) => `<tr><td><strong>${html(item.clinicName)}</strong></td><td>${html(item.phone)}</td><td>${item.status === "DONE" ? badge(item.overdue ? "逾期完成" : "已完成", item.overdue ? "gold" : "green") : badge(item.overdue ? "逾期未完成" : "未完成", item.overdue ? "rose" : "blue")}</td><td>${html(item.completedAt ? compactDateTime(item.completedAt) : "-")}</td></tr>`).join("") || `<tr><td colspan="4">暂无追踪对象</td></tr>`}</tbody></table></div></aside></div>` : ""}`;
}

function renderResource(resource: ResourceKey) {
  const config = configs[resource];
  const columns = resourceColumns(resource);
  const rows = filteredRows(resource);
  const supportsDelete = resource !== "purchases";
  const scopedResource = ["kits", "templates", "articles", "marketingPosts"].includes(resource);
  const deletableIds = rows.filter((item) => !scopedResource || canEditContentFrontend(item)).map((item) => item.id);
  const selectedResourceIds = (state.selectedResourceIds[resource] ?? []).filter((id) => deletableIds.includes(id));
  const actions: string[] = [];
  if (config.importEndpoint) actions.push(`<button id="importBtn" class="secondary" type="button">批量导入</button>`);
  if (config.importClinicEndpoint) actions.push(`<button id="importClinicBtn" class="secondary" type="button">批量导入门店医生</button>`);
  if (config.dispatchEndpoint) actions.push(`<button id="dispatchBtn" class="secondary" type="button">下发</button>`);
  // 账号页根据当前 tab 给出更具体的创建按钮文案
  if (config.fields.length > 0) {
    let createLabel = `新增${config.label}`;
    if (resource === "users") {
      if (state.accountTab === "platform") createLabel = "新增总部账号";
      else if (state.accountTab === "province") createLabel = "新增省级账号";
      else if (state.accountTab === "city") createLabel = "新增地市账号";
      else createLabel = "新增门店账号";
    }
    actions.push(`<button data-create="${resource}">${createLabel}</button>`);
  }
  return `
    ${renderPageHeader(actions.join(""))}
    ${resource === "users" ? renderAccountSubTabs() : ""}
    ${config.importEndpoint ? `
    <section id="importPanel" class="panel" style="display:none">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <input type="file" id="importFileInput" accept=".csv,text/csv" />
        <button id="downloadTemplateBtn" class="secondary" type="button">下载模板</button>
        <button id="doImportBtn" class="primary" type="button">解析预览</button>
      </div>
      <div id="importResult"></div>
      <div id="importPreview" class="table-wrap" style="display:none"></div>
    </section>` : ""}
    ${config.importClinicEndpoint ? `
    <section id="importClinicPanel" class="panel" style="display:none">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <input type="file" id="importClinicFileInput" accept=".csv,text/csv" />
        <button id="downloadClinicTemplateBtn" class="secondary" type="button">下载门店医生模板</button>
        <button id="doImportClinicBtn" class="primary" type="button">解析预览</button>
      </div>
      <div id="importClinicResult"></div>
      <div id="importClinicPreview" class="table-wrap" style="display:none"></div>
    </section>` : ""}
    ${config.dispatchEndpoint ? `
    <section id="dispatchModal" class="panel" style="display:none">
      <h3 style="margin-top:0">下发${html(config.label)}</h3>
      <div style="margin-bottom:12px">
        <label>选择模板：</label>
        <select id="dispatchTemplateSelect" style="min-width:240px">
          <option value="">— 选择一个${html(config.dispatchStatus === "TEMPLATE" ? "总部模板" : "已发布")}的模板 —</option>
          ${((state.resources[resource] ?? []) as any[]).filter((t: any) => t.status === (config.dispatchStatus ?? "PUBLISHED")).map((t: any) => `<option value="${html(t.id)}">${html(t.title)}${t.version != null ? ` (v${t.version})` : ""}</option>`).join("")}
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <label>下发范围：</label>
        <select id="dispatchMode">
          <option value="all">辖区全部诊所</option>
          <option value="one">指定诊所</option>
        </select>
        <select id="dispatchClinic" style="display:none">
          <option value="">选择诊所</option>
          ${clinicOptions().map((item) => `<option value="${html(item.value)}">${html(item.label)}</option>`).join("")}
        </select>
      </div>
      <div id="dispatchResult" class="muted" style="margin-bottom:12px"></div>
      <button id="confirmDispatchBtn" class="primary" type="button">确认下发</button>
      <button id="cancelDispatchBtn" class="secondary" type="button">取消</button>
    </section>` : ""}
    <section class="resource-workspace">
      <div class="resource-controlbar">
        <div class="resource-controlbar__intro">
          <span class="eyebrow">数据工作区</span>
          <strong>${html(config.label)} · ${rows.length} 条结果</strong>
          <small>${html(config.subtitle)}</small>
        </div>
        <div class="filters">
        <input id="queryInput" value="${html(state.query)}" placeholder="搜索名称、城市、手机号、任务标题" />
        ${hasClinicFilter(resource) ? `
        <select id="clinicFilter">
          <option value="">全部诊所</option>
          ${clinicOptions().map((item) => `<option value="${html(item.value)}" ${state.clinicFilter === item.value ? "selected" : ""}>${html(item.label)}</option>`).join("")}
        </select>` : ""}
        ${resource === "clinics" ? `
        <select id="clinicCityFilter">
          <option value="">全部城市</option>
          ${Array.from(new Set(currentClinics().map((c) => c.city as string))).sort().map((city) => `<option value="${html(city)}" ${state.clinicCityFilter === city ? "selected" : ""}>${html(city)}</option>`).join("")}
        </select>` : ""}
        <select id="statusFilter">
          <option value="">全部状态</option>
          ${resourceStatuses(resource).map((item) => `<option value="${html(item)}" ${state.statusFilter === item ? "selected" : ""}>${html(statusLabel(item))}</option>`).join("")}
        </select>
        <button id="clearFilters" class="secondary" type="button">清空</button>
        </div>
      </div>
      ${resource === "users" && state.selectedUserIds.length > 0 ? `
      <div class="batch-bar">
        <span class="muted">已选 ${state.selectedUserIds.length} 个账号</span>
        <button class="secondary" data-batch-status="ACTIVE" type="button">批量启用</button>
        <button class="secondary" data-batch-status="DISABLED" type="button">批量停用</button>
        <button class="secondary" data-batch-permissions type="button">批量授权</button>
        <button class="danger" data-batch-delete-users type="button">批量删除</button>
        <button class="secondary" data-batch-clear type="button">清空选择</button>
      </div>` : ""}
      ${resource !== "users" && supportsDelete && selectedResourceIds.length > 0 ? `
      <div class="batch-bar">
        <span class="muted">已选 ${selectedResourceIds.length} 条内容</span>
        <button class="danger" data-batch-delete-resource="${resource}" type="button">批量删除</button>
        <button class="secondary" data-batch-clear-resource="${resource}" type="button">清空选择</button>
      </div>` : ""}
      <div class="table-wrap resource-table">
        <table>
          <thead><tr>${resource === "users" ? `<th style="width:32px"><input type="checkbox" data-select-all-users ${state.selectedUserIds.length > 0 && state.selectedUserIds.length === rows.length ? "checked" : ""} /></th>` : supportsDelete ? `<th style="width:32px"><input type="checkbox" data-select-all-resource="${resource}" ${deletableIds.length > 0 && selectedResourceIds.length === deletableIds.length ? "checked" : ""} ${deletableIds.length ? "" : "disabled"} /></th>` : ""}${columns.map((column) => `<th>${html(column.label)}</th>`).join("")}<th>操作</th></tr></thead>
          <tbody>${rows.map((item) => {
            const isScopedResource = ["kits", "templates", "articles", "marketingPosts"].includes(resource);
            const editable = isScopedResource ? canEditContentFrontend(item) : true;
            const promotable = isScopedResource && !item.clinicId && canPromoteToNational(item);
            return `<tr>
            ${resource === "users" ? `<td><input type="checkbox" data-select-user data-id="${html(item.id)}" ${state.selectedUserIds.includes(item.id) ? "checked" : ""} /></td>` : ""}
            ${resource !== "users" && supportsDelete ? `<td><input type="checkbox" data-select-resource="${resource}" data-id="${html(item.id)}" ${selectedResourceIds.includes(item.id) ? "checked" : ""} ${editable ? "" : "disabled title='无权删除'"} /></td>` : ""}
            ${columns.map((column) => `<td>${column.value(item)}</td>`).join("")}
            <td><div class="row-actions">
              ${resource === "users" ? `<button class="secondary" data-reset-password data-id="${html(item.id)}" data-name="${html(item.name)}" data-phone="${html(item.phone)}">重置密码</button><button class="secondary" data-kick-user data-id="${html(item.id)}" data-name="${html(item.name)}">踢下线</button>` : ""}
              ${resource === "purchases" ? "" : `<button class="secondary" data-edit="${resource}" data-id="${html(item.id)}" ${editable ? "" : "disabled title='无权编辑'"}>编辑</button>`}
              ${promotable ? `<button class="secondary" data-promote="${resource}" data-id="${html(item.id)}" data-name="${html(item.title || "")}" type="button">提升为全国</button>` : ""}
              ${supportsDelete ? `<button class="danger" data-delete="${resource}" data-id="${html(item.id)}" ${editable ? "" : "disabled title='无权删除'"}>${html(config.deleteLabel ?? "删除")}</button>` : ""}
            </div></td>
          </tr>`;
          }).join("") || `<tr><td colspan="${columns.length + (supportsDelete ? 2 : 1)}"><div class="empty-state"><div class="empty-state__title">暂无数据</div><div class="empty-state__sub">${html(emptyHint(resource))}</div></div></td></tr>`}</tbody>
        </table>
      </div>
      ${resource === "users" && state.batchMenuOpen ? `
      <section id="batchPermissionsPanel" class="panel">
        <h3 style="margin-top:0">批量授权 · 选 ${state.selectedUserIds.length} 个账号</h3>
        <div class="muted" style="margin-bottom:12px">勾选要分配的菜单权限（不勾选 = 清空所有权限）</div>
        <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:12px">
          ${([
            { key: "dashboard", label: "运营总览" },
            { key: "clinics", label: "终端诊所" },
            { key: "accounts", label: "账号管理" },
            { key: "purchases", label: "采购订单" },
            { key: "marketing", label: "营销中心" },
            { key: "tasks", label: "任务中心" },
            { key: "analytics", label: "经营分析" },
            { key: "audit", label: "审计中心" }
          ]).map((m) => `<label style="display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid #dcdcdc;border-radius:6px;cursor:pointer">
            <input type="checkbox" data-batch-menu value="${m.key}" />
            <span>${m.label}</span>
          </label>`).join("")}
        </div>
        <div id="batchPermissionsResult" class="muted" style="margin-bottom:12px"></div>
        <div style="display:flex;gap:8px">
          <button class="primary" id="confirmBatchPermissionsBtn" type="button">确认授权</button>
          <button class="secondary" id="cancelBatchPermissionsBtn" type="button">取消</button>
        </div>
      </section>` : ""}
    </section>`;
}

// 哪些资源支持按诊所筛选
// - 账号管理：仅「门店账号」tab 有意义（其它 tab 的账号没有 clinicId）
// - 营销推送、采购、任务：都可能带 clinicId
function hasClinicFilter(resource: ResourceKey) {
  if (resource === "users") return state.accountTab === "clinic";
  return resource === "marketingPosts" || resource === "purchases" || resource === "tasks";
}

// 空表时的引导文案
function emptyHint(resource: ResourceKey) {
  switch (resource) {
    case "users": return "点击右上角「新增账号」或「批量导入门店医生」开始";
    case "clinics": return "点击右上角「新增诊所」或「批量导入」开始";
    case "kits": return "维护总部统一产品包、建议零售价和门店价";
    case "templates": return "维护总部统一活动模板，发布后可下发门店";
    case "articles": return "维护患者端可见的健康科普内容";
    case "marketingPosts": return "结构化宣传稿，发布后全量推送给全国患者";
    case "tasks": return "总部向终端诊所下发运营任务并跟踪完成率";
    case "taskTemplates": return "把反复下发的运营任务沉淀为模板";
    case "purchases": return "门店通过患者端下单后会在此汇总";
    default: return "";
  }
}

function resourceStatuses(resource: ResourceKey) {
  if (resource === "clinics") return ["ACTIVE", "SUSPENDED", "CLOSED"];
  if (resource === "users") return ["ACTIVE", "DISABLED"];
  if (resource === "kits") return ["ACTIVE", "DISCONTINUED"];
  if (resource === "templates") return ["DRAFT", "PUBLISHED"];
  if (resource === "articles") return ["DRAFT", "PUBLISHED", "ARCHIVED"];
  if (resource === "marketingPosts") return ["DRAFT", "TEMPLATE", "PUBLISHED", "ARCHIVED"];
  if (resource === "tasks") return ["PENDING", "DONE"];
  if (resource === "taskTemplates") return ["DRAFT", "PUBLISHED", "ARCHIVED"];
  if (resource === "purchases") return ["COMPLETED", "PENDING", "REFUNDED"];
  return [];
}

function statusLabel(value: string) {
  return ({ ACTIVE: "启用", DISCONTINUED: "停用", SUSPENDED: "暂停", CLOSED: "关闭", DISABLED: "禁用", DRAFT: "草稿", PUBLISHED: "已发布", ARCHIVED: "已归档", PENDING: "进行中", DONE: "已完成", TEMPLATE: "模板", COMPLETED: "已完成", REFUNDED: "已退款", UNREVISITED: "未到店", REVISITED: "已到店" } as Record<string, string>)[value] ?? value;
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "低",
  NORMAL: "普通",
  HIGH: "高",
  URGENT: "紧急"
};

const CATEGORY_LABELS: Record<string, string> = {
  OPERATIONS: "运营",
  MARKETING: "营销",
  TRAINING: "培训",
  COMPLIANCE: "合规"
};

const CLINIC_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "正常",
  SUSPENDED: "暂停",
  CLOSED: "已关闭"
};

const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "启用",
  DISABLED: "已停用"
};

const DRUG_KIT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "在售",
  DISCONTINUED: "已下架"
};

const TEMPLATE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布"
};

const ARTICLE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档"
};

const MARKETING_POST_TYPE_LABELS: Record<string, string> = {
  ANNOUNCEMENT: "公告",
  PROMOTION: "营销",
  ACTIVITY: "活动"
};

const MARKETING_POST_STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  TEMPLATE: "总部模板",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档"
};

const ADMIN_ROLE_LABELS: Record<string, string> = {
  NATIONAL_ADMIN: "全国管理",
  PROVINCE_ADMIN: "省级管理",
  CITY_ADMIN: "地市管理"
};



const PURCHASE_STATUS_LABELS: Record<string, string> = {
  COMPLETED: "已完成",
  PENDING: "待支付",
  REFUNDED: "已退款"
};

const REVISIT_STATUS_LABELS: Record<string, string> = {
  UNREVISITED: "未到店",
  REVISITED: "已到店"
};

const TASK_STATUS_LABELS: Record<string, string> = {
  PENDING: "进行中",
  DONE: "已完成"
};

// 菜单权限的可选项：与后端 admin-scope.ts 的 allMenuPermissions 对齐
const MENU_PERMISSION_OPTIONS: Record<string, string> = {
  dashboard: "数据总览",
  clinics: "门店管理",
  accounts: "账号权限",
  marketing: "营销素材",
  tasks: "运营任务",
  analytics: "经营分析",
  purchases: "套餐患者",
  audit: "审计日志"
};

const TASK_TEMPLATE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档"
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  "auth.request_code": "请求验证码",
  "auth.login": "登录",
  "auth.password_login": "密码登录",
  "auth.logout": "退出",
  "patient.view_dashboard": "查看患者端",
  "patient.create_appointment": "创建预约",
  "patient.cancel_appointment": "取消预约",
  "patient.query_appointments": "查询预约",
  "patient.enroll_campaign": "报名活动",
  "patient.create_referral": "推荐好友",
  "clinic.view_dashboard": "查看诊所端",
  "clinic.create_patient": "登记患者",
  "clinic.update_patient": "更新患者",
  "clinic.update_appointment": "更新预约",
  "clinic.query_appointments": "查询预约",
  "clinic.complete_followup": "完成随访",
  "clinic.complete_operation_task": "完成任务",
  "clinic.adopt_campaign_template": "采用活动模板",
  "clinic.create_poster": "发布海报",
  "clinic.update_poster_status": "更新海报状态",
  "clinic.generate_marketing_copy": "生成营销文案",
  "admin.view_dashboard": "查看总后台",
  "admin.create_clinic": "创建门店",
  "admin.update_clinic": "更新门店",
  "admin.delete_clinic": "停用门店",
  "admin.create_user": "创建账号",
  "admin.update_user": "更新账号",
  "admin.disable_user": "停用账号",
  "admin.create_kit": "创建药品套餐",
  "admin.update_kit": "更新药品套餐",
  "admin.delete_kit": "下架药品套餐",
  "admin.create_article": "创建文章",
  "admin.dispatch_template": "下发活动模板",
  "admin.dispatch_task": "下发任务",
  "admin.update_task": "更新任务",
  "admin.delete_task": "删除任务"
};

function labelOf(map: Record<string, string>, value: unknown, fallback = "—") {
  const text = value == null ? "" : String(value);
  if (!text) return fallback;
  return map[text] ?? text;
}

function filteredRows(resource: ResourceKey) {
  let rows = state.resources[resource] ?? [];
  // 账号管理 3 个 tab 分别走不同角色过滤
  if (resource === "users") {
    if (state.accountTab === "platform") {
      rows = rows.filter((u) => u.role === "PLATFORM_ADMIN" && u.adminRole === "NATIONAL_ADMIN");
    } else if (state.accountTab === "province") {
      rows = rows.filter((u) => u.role === "PLATFORM_ADMIN" && u.adminRole === "PROVINCE_ADMIN");
    } else if (state.accountTab === "city") {
      rows = rows.filter((u) => u.role === "PLATFORM_ADMIN" && (u.adminRole ?? "CITY_ADMIN") === "CITY_ADMIN");
    } else {
      rows = rows.filter((u) => u.role !== "PLATFORM_ADMIN");
    }
  }
  const q = state.query.trim().toLowerCase();
  return rows.filter((item) => {
    if (state.clinicFilter && item.clinicId !== state.clinicFilter && item.id !== state.clinicFilter) return false;
    if (state.statusFilter && item.status !== state.statusFilter) return false;
    if (resource === "clinics" && state.clinicCityFilter && (item.city ?? item.city) !== state.clinicCityFilter) return false;
    if (!q) return true;
    return JSON.stringify(item).toLowerCase().includes(q);
  });
}

function renderAudit() {
  const logs = state.data?.auditLogs ?? [];
  const loginLogs = state.loginHistory ?? [];
  const actionLabel = (a: string) => a === "auth.login" ? "短信验证码登录" : a === "auth.password_login" ? "密码登录" : a === "auth.logout" ? "登出" : a;
  const actionTone = (a: string) => a === "auth.logout" ? "blue" : "green";
  return `
    ${renderPageHeader()}
    <section class="panel">
      <div class="toolbar">
        <h3>登录历史</h3>
        <button class="secondary" data-refresh-login-history type="button">刷新</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>时间</th><th>账号</th><th>方式</th><th>IP</th></tr></thead>
        <tbody>${loginLogs.map((log) => `<tr>
          <td>${html(compactDateTime(log.createdAt))}</td>
          <td>${log.userName ? `${html(log.userName)}<br><span class="muted">${html(log.userPhone ?? "")}</span>` : `<span class="muted">${html(log.userPhone ?? "未知")}</span>`}</td>
          <td>${badge(actionLabel(log.action), actionTone(log.action))}</td>
          <td>${html(log.ip || "—")}</td>
        </tr>`).join("") || `<tr><td colspan="4"><div class="empty-state">暂无登录记录</div></td></tr>`}</tbody>
      </table></div>
    </section>
    <section class="panel">
      <h3>全部审计日志</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>时间</th><th>角色</th><th>动作</th><th>对象</th></tr></thead>
        <tbody>${logs.map((log) => `<tr><td>${html(compactDateTime(log.createdAt))}</td><td>${html(labelOf(ROLE_LABELS, log.role, "系统"))}</td><td>${html(labelOf(AUDIT_ACTION_LABELS, log.action))}</td><td>${html(log.target)}</td></tr>`).join("") || `<tr><td colspan="4"><div class="empty-state">暂无审计记录</div></td></tr>`}</tbody>
      </table></div>
    </section>`;
}

function renderNotifications() {
  const d = state.notifDraft;
  const clinics = currentClinics();
  const activeClinics = clinics.filter((c) => c.status !== "CLOSED");
  const allAgents = state.agents ?? [];
  const selectedCount = d.sendTo === "clinic"
    ? (d.scope === "ALL" ? activeClinics.length : d.clinicIds.length)
    : (d.scope === "ALL" ? allAgents.length : d.agentIds.length);
  const history = state.notifHistory ?? [];
  return `
    ${renderPageHeader()}
    <section class="grid two">
      <div class="panel">
        <h3>📨 发送通知</h3>
        <p class="muted">向所辖范围的目标发送通知。目标支持「终端诊所」或「代理账号（省级/市级）」。代理目标 = 该代理下辖诊所的所有医生 / 前台 / 店长账号。</p>
        <form id="notifForm" class="form">
          <label>通知标题 *<input class="field" name="title" maxlength="60" required placeholder="如：本月新政策上线通知" value="${html(d.title)}" /></label>
          <label>通知内容 *<textarea class="field" name="content" maxlength="500" required rows="4" placeholder="请输入通知内容，500 字内">${html(d.content)}</textarea></label>
          <div class="form-grid">
            <label>目标类型
              <select class="field" name="sendTo">
                <option value="clinic" ${d.sendTo === "clinic" ? "selected" : ""}>终端诊所</option>
                <option value="agent" ${d.sendTo === "agent" ? "selected" : ""}>代理账号（其下所有诊所）</option>
              </select>
            </label>
            <label>发送范围
              <select class="field" name="scope">
                <option value="ALL" ${d.scope === "ALL" ? "selected" : ""}>所辖全部（${activeClinics.length} 家诊所 / ${allAgents.length} 个代理）</option>
                <option value="SELECTED" ${d.scope === "SELECTED" ? "selected" : ""}>仅所选目标</option>
              </select>
            </label>
          </div>
          <div id="notifTargets" style="margin-top:8px">
            ${d.scope === "SELECTED" && d.sendTo === "clinic" ? `
              <label>选择诊所
                <div class="table-wrap" style="max-height:240px;overflow:auto;border:1px solid var(--border)">
                  <table>
                    <thead><tr><th style="width:32px"></th><th>诊所</th><th>城市</th></tr></thead>
                    <tbody>${activeClinics.map((c) => `<tr>
                      <td><input type="checkbox" name="clinicId" value="${html(c.id)}" ${d.clinicIds.includes(c.id) ? "checked" : ""} /></td>
                      <td>${html(c.name)}</td>
                      <td>${html(c.city)}</td>
                    </tr>`).join("") || `<tr><td colspan="3"><div class="empty-state">无诊所可选</div></td></tr>`}</tbody>
                  </table>
                </div>
                <div class="muted" style="margin-top:4px">已选 <span id="notifClinicCount">${d.clinicIds.length}</span> 家</div>
              </label>
            ` : ""}
            ${d.scope === "SELECTED" && d.sendTo === "agent" ? `
              <label>选择代理账号
                <div class="table-wrap" style="max-height:240px;overflow:auto;border:1px solid var(--border)">
                  <table>
                    <thead><tr><th style="width:32px"></th><th>账号</th><th>角色</th><th>辖区</th><th>终端数</th></tr></thead>
                    <tbody>${allAgents.map((a) => {
                      const rl = a.adminRole === "PROVINCE_ADMIN" ? "省级" : a.adminRole === "CITY_ADMIN" ? "市级" : a.adminRole;
                      const sc = a.managedCities.slice(0, 3).join("、") + (a.managedCities.length > 3 ? ` 等${a.managedCities.length}` : "");
                      return `<tr>
                      <td><input type="checkbox" name="agentId" value="${html(a.id)}" ${d.agentIds.includes(a.id) ? "checked" : ""} /></td>
                      <td><strong>${html(a.name)}</strong><br><span class="muted" style="font-size:11px">${html(a.phone)}</span></td>
                      <td>${rl}</td>
                      <td><span class="muted" style="font-size:12px">${html(sc || a.province || "—")}</span></td>
                      <td>${a.clinicCount}</td>
                    </tr>`;
                    }).join("") || `<tr><td colspan="5"><div class="empty-state">无代理可选</div></td></tr>`}</tbody>
                  </table>
                </div>
                <div class="muted" style="margin-top:4px">已选 <span id="notifAgentCount">${d.agentIds.length}</span> 个</div>
              </label>
            ` : ""}
          </div>
          <label class="form-row" style="display:flex;gap:8px;align-items:center;margin-top:8px">
            <input type="checkbox" name="broadcastSelf" ${d.broadcastSelf ? "checked" : ""} />
            <span>同时存为我的通知（推荐，便于回看）</span>
          </label>
          <p class="muted" style="margin-top:6px">将送达 <strong>${selectedCount}</strong> 个目标（实际触达账号数 = 目标下所有 CLINIC_* 用户的总和）。</p>
          <div class="actions"><button type="submit">📤 发送通知</button></div>
        </form>
      </div>

      <div class="panel">
        <h3>📜 最近发送 <span class="meta">${history.length} 条</span></h3>
        ${history.length === 0 ? `<div class="empty-state"><div class="empty-state__title">暂无发送记录</div><div class="empty-state__sub">发送通知后会显示在这里</div></div>` : `<div class="table-wrap"><table>
          <thead><tr><th>时间</th><th>标题</th><th>内容</th></tr></thead>
          <tbody>${history.slice(0, 20).map((h) => `<tr>
            <td>${html(compactDateTime(h.createdAt))}</td>
            <td><strong>${html(h.title)}</strong></td>
            <td class="muted" style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${html(h.content)}</td>
          </tr>`).join("")}</tbody>
        </table></div>`}
      </div>
    </section>`;
}

function renderNotificationsManagement() {
  const d = state.notifDraft;
  const audience = state.notifAudience;
  const users = audience?.selectableUsers ?? [];
  const history = state.notifHistory ?? [];
  const options = [
    { key: "AGENTS_ALL", title: "辖区全部代理商", desc: `${audience?.counts.agents ?? 0} 个省级 / 市级代理账号`, tone: "indigo", disabled: false },
    { key: "CLINICS_ALL", title: "辖区全部诊所", desc: `${audience?.counts.clinics ?? 0} 家诊所的全部在岗账号`, tone: "teal", disabled: false },
    { key: "ALL_USERS", title: "平台全部用户（含患者）", desc: "仅在明确确认后发送给患者端", tone: "rose", disabled: !audience?.canBroadcastAllUsers },
    { key: "SELECTED_USERS", title: "选择指定用户", desc: "仅支持辖区代理商和医生", tone: "gold", disabled: false }
  ] as const;
  const selectedCount = d.targetType === "SELECTED_USERS" ? d.userIds.length : (
    d.targetType === "AGENTS_ALL" ? audience?.counts.agents :
    d.targetType === "CLINICS_ALL" ? audience?.counts.clinics : "全部"
  );
  return `
    ${renderPageHeader()}
    <section class="notification-command">
      <div class="notification-command__head"><div><span>通知调度中心</span><h2>选择通知触达范围</h2><p>通知发送后将进入对应用户的消息中心，并以未读红点提醒。</p></div>${badge(`最近发送 ${history.length} 条`, "blue")}</div>
      <div class="notification-audience-grid">${options.map((option) => `<button type="button" data-notif-target="${option.key}" class="notification-audience-card ${d.targetType === option.key ? "active" : ""}" ${option.disabled ? "disabled" : ""}><span class="pill ${option.tone}">${option.disabled ? "仅全国管理员" : "可发送"}</span><strong>${option.title}</strong><small>${option.desc}</small></button>`).join("")}</div>
    </section>
    <section class="notification-workspace">
      <form id="notifForm" class="notification-composer">
        <div class="notification-section-head"><div><span>编辑通知</span><h3>发布内容</h3></div>${badge(`预计触达 ${selectedCount ?? 0}`, "green")}</div>
        <label>通知标题<input name="title" maxlength="60" required value="${html(d.title)}" placeholder="输入清晰、可识别的通知标题" /></label>
        <label>通知正文<textarea name="content" maxlength="500" rows="7" required placeholder="说明需要用户了解或执行的事项">${html(d.content)}</textarea></label>
        ${d.targetType === "SELECTED_USERS" ? `<div class="notification-recipient-list">
          <div class="notification-recipient-list__head"><strong>选择接收用户</strong><span>已选择 ${d.userIds.length} 人</span></div>
          ${users.map((user) => `<label class="notification-recipient"><input type="checkbox" name="notifUserId" value="${html(user.id)}" ${d.userIds.includes(user.id) ? "checked" : ""}/><span><strong>${html(user.name)}</strong><small>${html(user.type === "AGENT" ? `${user.adminRole === "PROVINCE_ADMIN" ? "省级" : "市级"}代理商` : `${user.clinicName ?? "诊所"} · 医生`)}</small></span><em>${html(user.phone)}</em></label>`).join("") || `<div class="empty-state">暂无可选用户</div>`}
        </div>` : ""}
        <label class="notification-self-copy"><input type="checkbox" name="broadcastSelf" ${d.broadcastSelf ? "checked" : ""}/><span>同时发送给自己，便于回看本次通知</span></label>
        ${d.targetType === "ALL_USERS" ? `<label class="notification-self-copy notification-patient-confirm"><input type="checkbox" name="includePatients" ${d.includePatients ? "checked" : ""}/><span><strong>明确确认发送给患者端</strong><small>未勾选时系统不会向患者发送总部通知</small></span></label>` : ""}
        <button type="submit">确认发布通知</button>
      </form>
      <div class="notification-history">
        <div class="notification-section-head"><div><span>发送留档</span><h3>最近通知</h3></div></div>
        <div class="notification-history__list">${history.map((item) => `<button type="button" data-history-notif="${html(item.id)}"><span></span><div><strong>${html(item.title)}</strong><p>${html(item.content)}</p><small>${html(compactDateTime(item.createdAt))}</small></div></button>`).join("") || `<div class="empty-state"><div class="empty-state__title">暂无通知记录</div></div>`}</div>
      </div>
    </section>`;
}

function renderKnowledgeBase() {
  const documents = state.knowledgeDocuments ?? [];
  const published = documents.filter((item) => item.status === "PUBLISHED").length;
  const pending = documents.filter((item) => item.parseStatus !== "READY").length;
  return `${renderPageHeader()}
    <section class="agent-summary-strip">
      <div><span>知识文档</span><strong>${documents.length}</strong><small>全部版本化文档</small></div>
      <div><span>已发布</span><strong>${published}</strong><small>医生端可检索引用</small></div>
      <div><span>待解析</span><strong>${pending}</strong><small>等待 RAGFlow 解析接入</small></div>
      <div><span>知识底座</span><strong>RAGFlow</strong><small>开源方案优先</small></div>
    </section>
    <section class="knowledge-layout">
      <form id="knowledgeDocumentForm" class="panel knowledge-composer">
        <div class="section-heading"><div><span class="section-kicker">新增知识</span><h3>录入指南与诊疗规范</h3></div></div>
        <label>文档标题<input name="title" required placeholder="例如：宫颈癌筛查异常管理专家共识" /></label>
        <div class="form-grid"><label>分类<select name="category"><option>宫颈疾病</option><option>宫颈筛查</option><option>宫颈癌前病变</option></select></label><label>来源类型<select name="sourceType"><option value="GUIDELINE">临床指南</option><option value="CONSENSUS">专家共识</option><option value="INTERNAL_PROTOCOL">内部规范</option><option value="LITERATURE">医学文献</option></select></label></div>
        <label>标签<input name="tags" placeholder="HPV, TCT, 阴道镜, CIN" /></label>
        <label>原文链接或文件地址<input name="fileUrl" placeholder="可选，用于保存原始来源" /></label>
        <label>可检索正文<textarea name="content" rows="12" placeholder="粘贴指南正文、关键推荐或内部规范。后续接入 RAGFlow 后，将支持 PDF/OCR 自动解析。"></textarea></label>
        <label>初始状态<select name="status"><option value="DRAFT">草稿</option><option value="PUBLISHED">发布并供医生端引用</option></select></label>
        <button type="submit">保存知识文档</button>
      </form>
      <section class="panel knowledge-list">
        <div class="section-heading"><div><span class="section-kicker">知识目录</span><h3>版本与发布状态</h3></div><span class="section-count">${documents.length} 份</span></div>
        <div class="table-wrap"><table><thead><tr><th>文档</th><th>分类</th><th>版本</th><th>解析</th><th>状态</th><th>操作</th></tr></thead><tbody>${documents.map((item) => `<tr>
          <td><strong>${html(item.title)}</strong><br><span class="muted">${html(item.sourceType)} · ${html(String(item.updatedAt).slice(0,10))}</span></td>
          <td>${html(item.category)}</td><td>v${item.version}</td><td>${html(item.parseStatus)}</td><td>${badge(item.status, item.status === "PUBLISHED" ? "green" : "gold")}</td>
          <td><div class="resource-actions"><button type="button" class="secondary sm" data-knowledge-status="${html(item.id)}" data-status="${item.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"}">${item.status === "PUBLISHED" ? "转为草稿" : "发布"}</button><button type="button" class="danger sm" data-knowledge-delete="${html(item.id)}">删除</button></div></td>
        </tr>`).join("") || `<tr><td colspan="6"><div class="empty-state"><div class="empty-state__title">暂无知识文档</div></div></td></tr>`}</tbody></table></div>
      </section>
    </section>`;
}

function renderKnowledgeBaseV2() {
  const bases = state.knowledgeBases ?? [];
  const documents = state.knowledgeDocuments ?? [];
  const selected = bases.find((item) => item.id === state.selectedKnowledgeBaseId) ?? bases[0];
  const visible = selected ? documents.filter((item) => item.knowledgeBaseId === selected.id) : [];
  const results = state.knowledgeSearchResults ?? [];
  const schemaItems = Array.isArray(selected?.contentSchema) ? selected.contentSchema : [];
  return `${renderPageHeader()}
    <section class="panel knowledge-batch-upload knowledge-batch-upload--legacy" hidden>
      <div class="section-heading"><div><span class="section-kicker">自动知识入库</span><h3>上传文档，系统自动识别用途并创建索引</h3></div><span class="pill">每批最多 20 个</span></div>
      <form id="knowledgeBatchUploadFormLegacy" class="knowledge-search-form">
        <input type="file" name="files" multiple required accept=".docx,.pdf,.pptx,.txt,.md,.csv,.json,.html,.htm,.jpg,.jpeg,.png,.webp" />
        <button type="submit">上传并自动建立索引</button>
      </form>
      <p class="muted">系统会自动识别指南、疗程模板、干预手段、产品资料、组合规则、安全规则和影像病例，并直接发布供医生端检索。</p>
    </section>
    <section class="panel knowledge-batch-upload">
      <div class="section-heading"><div><span class="section-kicker">知识库文件上传</span><h3>上传后自动识别用途、归类并建立索引</h3></div><span class="pill">文件数量不限</span></div>
      <form id="knowledgeBatchUploadFormV2" class="knowledge-batch-upload-form">
        <label class="knowledge-upload-dropzone" for="knowledgeBatchFiles">
          <input id="knowledgeBatchFiles" type="file" name="files" multiple required data-knowledge-upload-input accept=".ppt,.pptx,.doc,.docx,.pdf,.txt,.jpg,.jpeg,.png" />
          <span class="knowledge-upload-dropzone__eyebrow">上传区</span>
          <strong>PPT / DOC / DOCX / PDF / TXT / JPG / PNG</strong>
          <small>支持一次选择任意数量文件，系统会自动入库、分类并生成检索索引。</small>
        </label>
        <div id="knowledgeBatchSelection" class="knowledge-upload-selection muted">未选择文件</div>
        <button type="submit">上传并自动建索引</button>
      </form>
      <p class="muted">支持新版与旧版 Office 文件；扫描版 PDF 或无法直接提取文本的旧文件，建议先完成 OCR 或转存后再上传。</p>
    </section>
    <section class="agent-summary-strip">
      <div><span>已入库文档</span><strong>${documents.length}</strong><small>自动分类与索引</small></div>
      <div><span>可检索</span><strong>${documents.filter((item) => item.status === "PUBLISHED" && item.parseStatus === "READY").length}</strong><small>医生端立即可用</small></div>
      <div><span>知识库类型</span><strong>${bases.length}</strong><small>系统自动归类</small></div>
      <div><span>处理异常</span><strong>${documents.filter((item) => item.parseStatus === "ERROR").length}</strong><small>需要重新上传</small></div>
    </section>
    <section class="panel knowledge-list">
      <div class="section-heading"><div><span class="section-kicker">知识文档</span><h3>自动归类结果</h3></div><span class="section-count">${documents.length} 份</span></div>
      <div class="table-wrap"><table><thead><tr><th>文档</th><th>自动归入</th><th>索引状态</th><th>更新时间</th><th>操作</th></tr></thead><tbody>
      ${documents.map((item) => `<tr><td><strong>${html(item.title)}</strong><br><span class="muted">${html(item.sourceType)} · ${html(item.modality)}</span></td><td>${badge(item.knowledgeBase?.name ?? "待识别", "blue")}</td><td>${badge(item.parseStatus === "READY" ? "索引完成" : item.parseStatus, item.parseStatus === "READY" ? "green" : "gold")}<br><span class="muted">${item.chunkCount ?? 0} 个片段</span></td><td>${html(String(item.updatedAt).slice(0, 10))}</td><td><div class="resource-actions">${renderKnowledgeDocumentDownloadAction(item)}<button type="button" class="secondary sm" data-knowledge-reindex="${html(item.id)}">重建索引</button><button type="button" class="danger sm" data-knowledge-delete="${html(item.id)}">删除</button></div></td></tr>`).join("") || `<tr><td colspan="5"><div class="empty-state"><div class="empty-state__title">上传第一份知识文档</div><div class="empty-state__sub">系统会自动完成识别、归类、发布和索引。</div></div></td></tr>`}
      </tbody></table></div>
    </section>`;
  /*
  return `${renderPageHeader()}
    <section class="panel knowledge-batch-upload"><div class="section-heading"><div><span class="section-kicker">批量导入</span><h3>上传 DOCX、PDF、PPTX 与图片</h3></div><span class="pill">每批最多 20 个</span></div><form id="knowledgeBatchUploadForm" class="knowledge-search-form"><input type="hidden" name="knowledgeBaseId" value="${html(selected?.id ?? "")}" /><input type="file" name="files" multiple required accept=".docx,.pdf,.pptx,.txt,.md,.csv,.json,.html,.htm,.jpg,.jpeg,.png,.webp" /><label class="knowledge-search-mode"><input type="checkbox" name="publish" value="true" /> 上传后直接审核并发布</label><button type="submit" ${selected ? "" : "disabled"}>批量上传并建立索引</button></form><p class="muted">DOCX、PDF、PPTX 自动提取文字；图片作为影像病例入库。扫描版 PDF 仍需先做 OCR。</p></section>
    <section class="agent-summary-strip"><div><span>知识库</span><strong>${bases.length}</strong><small>按专业领域独立管理</small></div><div><span>当前文档</span><strong>${visible.length}</strong><small>版本化知识文档</small></div><div><span>已发布</span><strong>${visible.filter((item) => item.status === "PUBLISHED").length}</strong><small>仅供医生端 AI 检索</small></div><div><span>索引切片</span><strong>${selected?.chunkCount ?? 0}</strong><small>${visible.filter((item) => item.parseStatus !== "READY").length} 份待处理</small></div></section>
    <section class="knowledge-base-switcher"><div class="knowledge-base-tabs">${bases.map((base) => `<button type="button" data-knowledge-base="${html(base.id)}" class="${base.id === selected?.id ? "active" : ""}"><strong>${html(base.name)}</strong><small>${base.isSystem ? "系统知识库" : html(base.provider)} · ${base.publishedCount}/${base.documentCount} 已发布</small></button>`).join("")}</div><details class="panel knowledge-base-create"><summary>新建扩展知识库</summary><form id="knowledgeBaseForm" class="form-grid"><label>知识库名称<input name="name" required /></label><label>专业领域<input name="domain" value="宫颈疾病" required /></label><label>检索引擎<select name="provider"><option value="LOCAL">本地检索（当前可用）</option><option value="RAGFLOW">RAGFlow（待配置）</option></select></label><label>召回数量<input name="retrievalTopK" type="number" min="1" max="20" value="5" /></label><label style="grid-column:1/-1">用途<textarea name="purpose" rows="2"></textarea></label><button type="submit">创建知识库</button></form></details></section>
    <section class="panel knowledge-guidance"><div><span class="section-kicker">${selected?.isSystem ? "系统知识库" : "扩展知识库"}</span><h3>${html(selected?.name ?? "请选择知识库")}</h3><p>${html(selected?.purpose ?? selected?.description ?? "")}</p><button type="button" class="secondary sm" data-knowledge-base-reindex="${html(selected?.id ?? "")}" ${selected ? "" : "disabled"}>重建整库混合索引</button></div><div class="knowledge-schema">${schemaItems.map((item: string) => `<span>${html(item)}</span>`).join("") || "<span>支持自由文档内容</span>"}</div></section>
    <section class="knowledge-layout"><form id="knowledgeDocumentForm" class="panel knowledge-composer"><div class="section-heading"><div><span class="section-kicker">上传并归档</span><h3>录入专业知识文档</h3></div></div><input type="hidden" name="knowledgeBaseId" value="${html(selected?.id ?? "")}" /><label>文档标题<input name="title" required placeholder="填写可识别的正式标题" /></label><div class="form-grid"><label>分类<input name="category" value="宫颈疾病" /></label><label>内容类型<select name="sourceType"><option value="GUIDELINE">临床指南</option><option value="CONSENSUS">专家共识</option><option value="PRODUCT_MANUAL">产品资料</option><option value="RULE">组合/安全规则</option><option value="COURSE_TEMPLATE">疗程模板</option><option value="CASE">审核病例</option><option value="LITERATURE">医学文献</option></select></label><label>资料形态<select name="modality"><option value="TEXT">文本资料</option><option value="REPORT">报告单规范</option><option value="TABLE">结构化表格</option><option value="IMAGE_CASE">影像标注病例</option></select></label><label>医学审核<select name="reviewStatus"><option value="PENDING">待审核</option><option value="APPROVED">已审核通过</option><option value="REJECTED">审核不通过</option></select></label><label>权威来源<input name="authority" placeholder="例如：国家卫健委、产品注册资料" /></label><label>证据等级<input name="evidenceLevel" placeholder="例如：指南推荐、专家共识、内部规则" /></label><label>审核人<input name="reviewer" placeholder="审核医生或专家姓名" /></label><label>生效日期<input name="effectiveAt" type="date" /></label></div><label>标签<input name="tags" placeholder="HPV, TCT, 阴道镜, CIN" /></label><label>原文链接或文件地址<input name="fileUrl" placeholder="可选，用于保存原始来源或影像地址" /></label><label>可检索正文<textarea name="content" rows="12" placeholder="粘贴文档正文；后续接入文件解析服务后，可直接上传 PDF、Word、图片。"></textarea></label><label>初始状态<select name="status"><option value="DRAFT">保存为草稿</option><option value="PUBLISHED">审核通过并立即发布</option></select></label><button type="submit" ${selected ? "" : "disabled"}>保存并建立索引</button></form>
      <section class="panel knowledge-list"><div class="section-heading"><div><span class="section-kicker">知识目录</span><h3>${html(selected?.name ?? "请选择知识库")}</h3></div><span class="section-count">${visible.length} 份</span></div><div class="table-wrap"><table><thead><tr><th>文档</th><th>证据与审核</th><th>版本</th><th>切片</th><th>状态</th><th>操作</th></tr></thead><tbody>${visible.map((item) => `<tr><td><strong>${html(item.title)}</strong><br><span class="muted">${html(item.sourceType)} · ${html(item.modality)} · ${html(String(item.updatedAt).slice(0,10))}</span></td><td>${html(item.authority || "未填写来源")}<br>${badge(item.reviewStatus === "APPROVED" ? "审核通过" : item.reviewStatus === "REJECTED" ? "审核不通过" : "待审核", item.reviewStatus === "APPROVED" ? "green" : item.reviewStatus === "REJECTED" ? "rose" : "gold")}</td><td>v${item.version}</td><td>${item.chunkCount} · ${html(item.parseStatus)}</td><td>${badge(item.status, item.status === "PUBLISHED" ? "green" : "gold")}</td><td><div class="resource-actions">${item.reviewStatus !== "APPROVED" ? `<button type="button" class="secondary sm" data-knowledge-approve="${html(item.id)}">审核通过</button>` : ""}<button type="button" class="secondary sm" data-knowledge-reindex="${html(item.id)}">重建索引</button><button type="button" class="secondary sm" data-knowledge-status="${html(item.id)}" data-status="${item.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"}">${item.status === "PUBLISHED" ? "撤回" : "发布"}</button><button type="button" class="danger sm" data-knowledge-delete="${html(item.id)}">删除</button></div></td></tr>`).join("") || `<tr><td colspan="6"><div class="empty-state"><div class="empty-state__title">暂无知识文档</div></div></td></tr>`}</tbody></table></div></section></section>
    <section class="panel knowledge-retrieval-test"><div class="section-heading"><div><span class="section-kicker">混合检索验证</span><h3>验证同义词、语义、证据与图片召回</h3></div><span class="pill">${html(state.knowledgeSearchMode === "all" ? "全库混合" : (selected?.provider ?? "LOCAL"))}</span></div><form id="knowledgeSearchForm" class="knowledge-search-form"><input type="hidden" name="knowledgeBaseId" value="${html(selected?.id ?? "")}" /><label class="knowledge-search-mode"><input type="checkbox" name="searchAll" value="true" ${state.knowledgeSearchMode === "all" ? "checked" : ""} data-knowledge-search-all /> 全库混合检索（不限于当前选中的知识库）</label><input name="query" required placeholder="例如：HPV16 持续阳性且 TCT 为 ASC-US，下一步检查建议是什么？" /><input name="imageUrl" placeholder="可选：宫颈图片地址，用于相似图片检索" /><button type="submit">测试检索</button></form><div class="knowledge-search-results">${results.map((item, index) => `<article><span>${index + 1}</span><div><strong>${html(item.document?.title)} · v${html(item.document?.version)}</strong>${item.document?.knowledgeBase ? ` <span class="pill">${html(item.document.knowledgeBase.name)}</span>` : ""}<small>综合 ${Math.round(Number(item.score ?? 0) * 100)}% · 关键词 ${Math.round(Number(item.keywordScore ?? 0) * 100)}% · 语义 ${Math.round(Number(item.vectorScore ?? 0) * 100)}% · 图片 ${Math.round(Number(item.imageScore ?? 0) * 100)}% · 证据 ${Math.round(Number(item.authorityScore ?? 0) * 100)}% · 重排 ${Math.round(Number(item.rerankScore ?? 0) * 100)}%</small><p>${html(item.content)}</p></div></article>`).join("") || `<div class="empty-state"><div class="empty-state__sub">发布并索引文档后，可在这里验证召回结果。</div></div>`}</div></section>`;
  */
}

function knowledgeSelectOptions(options: ReadonlyArray<{ value: string; label: string }>, current: unknown) {
  return options.map((option) => `<option value="${html(option.value)}" ${String(current ?? "") === option.value ? "selected" : ""}>${html(option.label)}</option>`).join("");
}

function knowledgeDateValue(value: unknown) {
  return value ? String(value).slice(0, 10) : "";
}

function knowledgeTagsValue(value: unknown) {
  return Array.isArray(value) ? value.join(", ") : String(value ?? "");
}

function knowledgeBaseNameByCode(code: string) {
  const base = (state.knowledgeBases ?? []).find((item) => item.code === code);
  return base?.name ?? code;
}

function renderKnowledgeBaseWorkspace() {
  const documents = state.knowledgeDocuments ?? [];
  const compositeCount = documents.filter((item) => item.structuredData?.autoClassification?.isComposite).length;
  return `${renderPageHeader()}
    <section class="panel knowledge-batch-upload">
      <div class="section-heading"><div><span class="section-kicker">知识库文件上传</span><h3>支持拖拽、文件夹上传、结构化解析与索引进度跟踪</h3></div><span class="pill">文件数量不限</span></div>
      <form id="knowledgeBatchUploadForm" class="knowledge-batch-upload-form">
        <input id="knowledgeBatchFileInput" type="file" multiple hidden data-knowledge-file-input accept=".ppt,.pptx,.doc,.docx,.pdf,.txt,.jpg,.jpeg,.png" />
        <input id="knowledgeBatchFolderInput" type="file" multiple hidden webkitdirectory directory data-knowledge-folder-input />
        <div class="knowledge-upload-dropzone" data-knowledge-dropzone tabindex="0">
          <span class="knowledge-upload-dropzone__eyebrow">上传区</span>
          <strong>拖拽文件到这里，或选择文件 / 文件夹</strong>
          <small>支持 PPT / DOC / DOCX / PDF / TXT / JPG / PNG。综合型文档会自动按内容切分、结构化并归入不同知识库片段。</small>
          <div class="knowledge-upload-dropzone__actions">
            <button type="button" class="secondary" data-knowledge-pick-files>选择文件</button>
            <button type="button" class="secondary" data-knowledge-pick-folder>选择文件夹</button>
          </div>
        </div>
        <div id="knowledgeBatchSelection" class="knowledge-upload-selection muted">未选择文件</div>
        <div id="knowledgeUploadProgress" class="knowledge-upload-progress" hidden>
          <div class="knowledge-upload-progress__head">
            <strong id="knowledgeUploadProgressTitle">准备上传</strong>
            <span id="knowledgeUploadProgressPercent">0%</span>
          </div>
          <div class="knowledge-upload-progress__track"><span id="knowledgeUploadProgressBar" style="width:0%"></span></div>
          <div id="knowledgeUploadProgressText" class="knowledge-upload-progress__text muted">等待开始</div>
          <div id="knowledgeUploadProgressFiles" class="knowledge-upload-progress__files"></div>
        </div>
        <button type="submit">上传并自动建索引</button>
      </form>
      <p class="muted">支持新旧版 Office 文件。扫描版 PDF 或无法直接提取文本的旧文件，建议先完成 OCR 再上传。</p>
    </section>
    <section class="agent-summary-strip">
      <div><span>已入库文档</span><strong>${documents.length}</strong><small>自动归类与索引</small></div>
      <div><span>可检索</span><strong>${documents.filter((item) => item.status === "PUBLISHED" && item.parseStatus === "READY").length}</strong><small>医生端可直接调用</small></div>
      <div><span>综合型文档</span><strong>${compositeCount}</strong><small>已按片段自动归类</small></div>
      <div><span>处理异常</span><strong>${documents.filter((item) => item.parseStatus === "ERROR").length}</strong><small>需要重新处理</small></div>
    </section>
    <section class="panel knowledge-list">
      <div class="section-heading"><div><span class="section-kicker">知识文档</span><h3>自动归类结果</h3></div><span class="section-count">${documents.length} 份</span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>文档</th><th>自动归入</th><th>索引状态</th><th>更新时间</th><th>操作</th></tr></thead>
          <tbody>
            ${documents.map((item) => {
              const autoClassification = item.structuredData?.autoClassification ?? {};
              const compositeBadge = autoClassification.isComposite ? badge("综合型", "gold") : "";
              const autoReason = autoClassification.reason ? `<div class="knowledge-cell-meta">${html(autoClassification.reason)}</div>` : "";
              return `<tr>
                <td><strong>${html(item.title)}</strong><br><span class="muted">${html(item.sourceType)} · ${html(item.modality)}</span></td>
                <td>${badge(item.knowledgeBase?.name ?? "待识别", "blue")}${compositeBadge}${autoReason}</td>
                <td>${badge(item.parseStatus === "READY" ? "索引完成" : item.parseStatus, item.parseStatus === "READY" ? "green" : "gold")}<br><span class="muted">${item.chunkCount ?? 0} 个片段</span></td>
                <td>${html(String(item.updatedAt).slice(0, 10))}</td>
                <td><div class="resource-actions">${renderKnowledgeDocumentDownloadAction(item)}<button type="button" class="secondary sm" data-knowledge-edit="${html(item.id)}">编辑文档</button><button type="button" class="secondary sm" data-knowledge-reindex="${html(item.id)}">重建索引</button><button type="button" class="danger sm" data-knowledge-delete="${html(item.id)}">删除</button></div></td>
              </tr>`;
            }).join("") || `<tr><td colspan="5"><div class="empty-state"><div class="empty-state__title">上传第一份知识文档</div><div class="empty-state__sub">系统会自动完成识别、归类、发布和索引。</div></div></td></tr>`}
          </tbody>
        </table>
      </div>
    </section>`;
}

function renderKnowledgeDocumentEditor() {
  const documentItem = state.knowledgeDocumentEditor;
  if (!documentItem) return "";
  const autoClassification = documentItem.structuredData?.autoClassification ?? {};
  const matchedCodes = Array.isArray(autoClassification.matchedCodes) ? autoClassification.matchedCodes : [];
  const suggestedSplitCodes = Array.isArray(autoClassification.suggestedSplitCodes) ? autoClassification.suggestedSplitCodes : [];
  const compositeStrategy = documentItem.structuredData?.compositeStrategy ?? (autoClassification.isComposite ? "split_recommended" : "single_primary");
  const originalName = documentItem.structuredData?.originalName ?? documentItem.title;
  return `
    <div class="drawer-backdrop" data-close-knowledge-editor>
      <section class="drawer" onclick="event.stopPropagation()">
        <div class="drawer-header">
          <div>
            <h2>编辑知识文档</h2>
            <p class="muted">综合型文档会自动按片段归类，原文不拆散；这里仅用于修正主知识库、来源类型和展示策略。</p>
          </div>
          <button id="closeKnowledgeDocumentEditor" class="secondary icon" type="button">×</button>
        </div>
        <form id="knowledgeDocumentEditorForm" class="form">
          <div class="knowledge-editor-summary">
            <div class="knowledge-editor-summary__head">
              <div>
                <strong>${html(documentItem.title)}</strong>
                <div class="muted">${html(originalName)} · v${html(documentItem.version ?? 1)} · ${html(documentItem.chunkCount ?? 0)} 个片段</div>
              </div>
              <div class="resource-actions">
                ${renderKnowledgeDocumentDownloadAction(documentItem)}
              </div>
            </div>
            <div class="knowledge-editor-summary__tags">
              ${badge(documentItem.parseStatus === "READY" ? "索引完成" : documentItem.parseStatus, documentItem.parseStatus === "READY" ? "green" : "gold")}
              ${badge(documentItem.status === "PUBLISHED" ? "已发布" : documentItem.status, documentItem.status === "PUBLISHED" ? "green" : "muted")}
              ${badge(documentItem.reviewStatus === "APPROVED" ? "审核通过" : documentItem.reviewStatus === "REJECTED" ? "审核不通过" : "待审核", documentItem.reviewStatus === "APPROVED" ? "green" : documentItem.reviewStatus === "REJECTED" ? "rose" : "gold")}
              ${autoClassification.confidence ? badge(`自动置信 ${autoClassification.confidence}`, autoClassification.confidence === "high" ? "green" : autoClassification.confidence === "medium" ? "blue" : "gold") : ""}
              ${autoClassification.isComposite ? badge("综合型文档", "gold") : ""}
            </div>
            <div class="knowledge-editor-note">
              <strong>自动归类：</strong>${html(knowledgeBaseNameByCode(autoClassification.knowledgeBaseCode ?? documentItem.knowledgeBase?.code ?? ""))}
              ${autoClassification.reason ? `<div class="knowledge-cell-meta">${html(autoClassification.reason)}</div>` : ""}
              ${matchedCodes.length ? `<div class="knowledge-cell-meta">命中主题：${html(matchedCodes.map((code: string) => knowledgeBaseNameByCode(code)).join("、"))}</div>` : ""}
              ${suggestedSplitCodes.length ? `<div class="knowledge-cell-meta">已自动覆盖片段库：${html(suggestedSplitCodes.map((code: string) => knowledgeBaseNameByCode(code)).join("、"))}</div>` : ""}
              ${documentItem.errorMessage ? `<div class="knowledge-cell-meta">最近错误：${html(documentItem.errorMessage)}</div>` : ""}
            </div>
          </div>
          <div class="form-grid">
            <label>文档标题<input name="title" value="${html(documentItem.title ?? "")}" required /></label>
            <label>主知识库<select name="knowledgeBaseId" required>${(state.knowledgeBases ?? []).map((base) => `<option value="${html(base.id)}" ${documentItem.knowledgeBaseId === base.id ? "selected" : ""}>${html(base.name)}</option>`).join("")}</select></label>
            <label>来源类型<select name="sourceType">${knowledgeSelectOptions(KNOWLEDGE_SOURCE_TYPE_OPTIONS, documentItem.sourceType)}</select></label>
            <label>资料形态<select name="modality">${knowledgeSelectOptions(KNOWLEDGE_MODALITY_OPTIONS, documentItem.modality)}</select></label>
            <label>分类<input name="category" value="${html(documentItem.category ?? "")}" /></label>
            <label>综合型策略<select name="compositeStrategy">${knowledgeSelectOptions(KNOWLEDGE_COMPOSITE_STRATEGY_OPTIONS, compositeStrategy)}</select></label>
            <label>发布状态<select name="status">${knowledgeSelectOptions(KNOWLEDGE_STATUS_OPTIONS, documentItem.status)}</select></label>
            <label>审核状态<select name="reviewStatus">${knowledgeSelectOptions(KNOWLEDGE_REVIEW_STATUS_OPTIONS, documentItem.reviewStatus)}</select></label>
            <label>权威来源<input name="authority" value="${html(documentItem.authority ?? "")}" /></label>
            <label>证据等级<input name="evidenceLevel" value="${html(documentItem.evidenceLevel ?? "")}" /></label>
            <label>审核人<input name="reviewer" value="${html(documentItem.reviewer ?? "")}" /></label>
            <label>标签<input name="tags" value="${html(knowledgeTagsValue(documentItem.tags))}" placeholder="HPV, 治疗托, 疗程" /></label>
            <label>生效日期<input name="effectiveAt" type="date" value="${html(knowledgeDateValue(documentItem.effectiveAt))}" /></label>
            <label>失效日期<input name="expiresAt" type="date" value="${html(knowledgeDateValue(documentItem.expiresAt))}" /></label>
          </div>
          <label>原文地址<input name="fileUrl" value="${html(documentItem.fileUrl ?? "")}" /></label>
          <label>可检索正文<textarea name="content" rows="14">${html(documentItem.content ?? "")}</textarea></label>
          <label class="knowledge-editor-checkbox"><input type="checkbox" name="reindex" value="true" /> 保存后重建索引</label>
          <div class="actions">
            <button type="submit">保存修正</button>
            <button id="cancelKnowledgeDocumentEditor" class="secondary" type="button">取消</button>
          </div>
        </form>
      </section>
    </div>`;
}

function renderKnowledgeDocumentDownloadAction(item: any) {
  if (!item.downloadUrl) return "";
  return `<a class="secondary sm" href="${html(API_BASE_URL + item.downloadUrl)}" target="_blank" rel="noopener">下载原文</a>`;
}

function renderAgentsManagement() {
  const agents = state.agents ?? [];
  const detail = state.agentDetail;
  const totals = {
    sales: agents.reduce((sum, item) => sum + item.totalSales, 0),
    monthSales: agents.reduce((sum, item) => sum + item.monthSales, 0),
    clinics: agents.reduce((sum, item) => sum + item.clinicCount, 0),
    activeClinics: agents.reduce((sum, item) => sum + item.activeClinicCount, 0),
    enrollments: agents.reduce((sum, item) => sum + item.totalEnrollments, 0),
    converted: agents.reduce((sum, item) => sum + item.converted, 0)
  };
  const conversion = totals.enrollments ? Math.round(totals.converted / totals.enrollments * 100) : 0;
  if (detail) {
    const agent = detail.agent;
    return `${renderPageHeader()}<section class="agent-detail-command"><button class="secondary" type="button" data-agent-back>返回代理经营总览</button><div><span>${agent.adminRole === "PROVINCE_ADMIN" ? "省级代理" : "市级代理"}</span><h2>${html(agent.name)}</h2><p>${html(agent.phone)} · ${html(agent.province || agent.managedCities.join("、") || "未配置辖区")}</p></div><strong>${money(agent.totalSales)}<small>累计经营产出</small></strong></section>
      <section class="agent-detail-metrics"><div><span>辖区门店</span><strong>${agent.clinicCount}</strong><small>${agent.activeClinicCount} 家启用</small></div><div><span>本月销售</span><strong>${money(agent.monthSales)}</strong><small>累计 ${money(agent.totalSales)}</small></div><div><span>线索转化</span><strong>${agent.conversionRate}%</strong><small>${agent.converted}/${agent.totalEnrollments}</small></div><div><span>近 30 天新增门店</span><strong>${agent.newClinicsLast30d}</strong><small>最近活跃 ${compactDateTime(agent.lastActiveAt) || "暂无"}</small></div></section>
      <section class="agent-detail-grid"><div class="panel"><h3>近 12 个月经营趋势</h3><div class="table-wrap"><table><thead><tr><th>月份</th><th>销售额</th><th>线索</th><th>转化率</th><th>新增门店</th></tr></thead><tbody>${detail.monthly.map((month) => `<tr><td>${html(month.month)}</td><td><strong>${money(month.sales)}</strong></td><td>${month.enrollments}</td><td>${badge(`${month.conversionRate}%`, month.conversionRate >= 20 ? "green" : "gold")}</td><td>${month.newClinics}</td></tr>`).join("")}</tbody></table></div></div><div class="panel"><h3>辖区门店</h3><div class="table-wrap"><table><thead><tr><th>门店</th><th>城市</th><th>状态</th><th>查看</th></tr></thead><tbody>${detail.clinics.map((clinic) => `<tr><td><strong>${html(clinic.name)}</strong></td><td>${html(clinic.city)}</td><td>${badge(clinic.status === "ACTIVE" ? "启用" : clinic.status, clinic.status === "ACTIVE" ? "green" : "rose")}</td><td><button class="secondary sm" data-clinic-detail="${html(clinic.id)}">详情</button></td></tr>`).join("") || `<tr><td colspan="4">暂无门店</td></tr>`}</tbody></table></div></div></section>`;
  }
  return `${renderPageHeader()}<section class="agent-command"><div><span>代理经营管理</span><h2>代理体系经营总览</h2><p>只读查看代理商覆盖、经营产出、线索转化与活跃情况。</p></div>${badge(`${agents.length} 个代理账号`, "blue")}</section>
    <section class="agent-summary-strip"><div><span>覆盖门店</span><strong>${totals.clinics}</strong><small>${totals.activeClinics} 家正常启用</small></div><div><span>累计销售</span><strong>${money(totals.sales)}</strong><small>本月 ${money(totals.monthSales)}</small></div><div><span>累计线索</span><strong>${totals.enrollments}</strong><small>${totals.converted} 个已成交</small></div><div><span>整体转化率</span><strong>${conversion}%</strong><small>代理体系综合表现</small></div></section>
    <section class="panel agent-ledger"><div class="toolbar"><h3>代理商经营台账</h3><input id="agentSearch" placeholder="搜索代理商、辖区或手机号" /></div><div class="table-wrap"><table id="agentTable"><thead><tr><th>代理商 / 辖区</th><th>覆盖门店</th><th>累计销售</th><th>本月销售</th><th>线索 / 成交</th><th>转化率</th><th>最近活跃</th><th>经营详情</th></tr></thead><tbody>${agents.map((agent) => `<tr data-search="${html(`${agent.name} ${agent.phone} ${agent.province} ${agent.managedCities.join(" ")}`.toLowerCase())}"><td><strong>${html(agent.name)}</strong><br><span class="muted">${agent.adminRole === "PROVINCE_ADMIN" ? "省级代理" : "市级代理"} · ${html(agent.province || agent.managedCities.join("、") || "未配置")}</span></td><td><strong>${agent.clinicCount}</strong><br><span class="muted">${agent.activeClinicCount} 家启用</span></td><td><strong>${money(agent.totalSales)}</strong></td><td>${money(agent.monthSales)}</td><td>${agent.totalEnrollments} / <strong>${agent.converted}</strong></td><td>${badge(`${agent.conversionRate}%`, agent.conversionRate >= 20 ? "green" : agent.conversionRate >= 10 ? "gold" : "rose")}</td><td>${html(compactDateTime(agent.lastActiveAt) || "暂无")}</td><td><button data-agent-detail="${html(agent.id)}">查看经营</button></td></tr>`).join("") || `<tr><td colspan="8">暂无代理账号</td></tr>`}</tbody></table></div></section>`;
}

function renderAgents() {
  const agents = state.agents ?? [];
  const detail = state.agentDetail;
  const totalSales = agents.reduce((s, a) => s + a.totalSales, 0);
  const monthSales = agents.reduce((s, a) => s + a.monthSales, 0);
  const totalEnrollments = agents.reduce((s, a) => s + a.totalEnrollments, 0);
  const newClinics30 = agents.reduce((s, a) => s + a.newClinicsLast30d, 0);
  const activeAgents = agents.filter((a) => a.activeClinicCount > 0).length;
  const provinceCount = agents.filter((a) => a.adminRole === "PROVINCE_ADMIN").length;
  const cityCount = agents.filter((a) => a.adminRole === "CITY_ADMIN").length;
  // 角色决定可以创建的代理类型
  const myRole = currentAdminRole();
  const canCreateProvince = myRole === "NATIONAL_ADMIN";
  const canCreateCity = myRole === "NATIONAL_ADMIN" || myRole === "PROVINCE_ADMIN";
  return `
    ${renderPageHeader()}
    <section class="dash-kpi-row">
      <div class="kpi-card"><div class="kpi-card__label">代理账号总数</div><div class="kpi-card__value">${agents.length}</div><div class="kpi-card__hint">省级 ${provinceCount} · 市级 ${cityCount}</div></div>
      <div class="kpi-card kpi-card--indigo"><div class="kpi-card__label">活跃代理</div><div class="kpi-card__value">${activeAgents}</div><div class="kpi-card__hint">下辖 ≥ 1 家 ACTIVE 终端</div></div>
      <div class="kpi-card kpi-card--teal"><div class="kpi-card__label">代理累计销售</div><div class="kpi-card__value" style="font-size:22px">${money(totalSales)}</div><div class="kpi-card__hint">${agents.length} 个代理合计</div></div>
      <div class="kpi-card kpi-card--amber"><div class="kpi-card__label">代理本月销售</div><div class="kpi-card__value" style="font-size:22px">${money(monthSales)}</div><div class="kpi-card__hint">当月已成交</div></div>
      <div class="kpi-card kpi-card--rose"><div class="kpi-card__label">新签终端（30 天）</div><div class="kpi-card__value">${newClinics30}</div><div class="kpi-card__hint">代理归属 / 累计线索 ${totalEnrollments}</div></div>
    </section>

    <section class="grid two">
      <div class="panel">
        <div class="toolbar">
          <h3>🏢 代理账号列表（${agents.length}）</h3>
          <div style="display:flex;gap:8px">
            <input class="search-input" id="agentSearch" placeholder="🔍 搜索账号 / 手机" />
            ${(canCreateProvince || canCreateCity) ? `<button class="primary" id="agentCreateBtn">+ 新建代理</button>` : ""}
          </div>
        </div>
        ${state.agentsLoading ? `<div class="empty-state"><div class="empty-state__title">加载中…</div></div>` : agents.length === 0 ? `<div class="empty-state"><div class="empty-state__title">暂无代理账号</div><div class="empty-state__sub">${(canCreateProvince || canCreateCity) ? "点击「+ 新建代理」开始" : "当前所辖范围内无省级 / 市级账号"}</div></div>` : `<div class="table-wrap"><table id="agentTable">
          <thead><tr><th>账号</th><th>角色</th><th>辖区</th><th>终端</th><th>本月销售</th><th>累计销售</th><th>推广</th><th>转化</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>${agents.map((a) => {
            const tone = a.conversionRate >= 30 ? "green" : a.conversionRate >= 10 ? "gold" : "rose";
            const roleLabel = a.adminRole === "PROVINCE_ADMIN" ? "省级" : a.adminRole === "CITY_ADMIN" ? "市级" : a.adminRole;
            const roleTone = a.adminRole === "PROVINCE_ADMIN" ? "indigo" : "blue";
            const scope = a.managedCities.length > 0
              ? a.managedCities.slice(0, 3).join("、") + (a.managedCities.length > 3 ? ` 等 ${a.managedCities.length}` : "")
              : (a.province || "—");
            const statusTone = a.status === "ACTIVE" ? "green" : "rose";
            return `<tr data-search="${html(((a.name || "") + " " + (a.phone || "")).toLowerCase())}">
              <td><strong>${html(a.name)}</strong><br><span class="muted" style="font-size:11px">${html(a.phone)}</span></td>
              <td>${badge(roleLabel, roleTone)}</td>
              <td><span class="muted" style="font-size:12px">${html(scope)}</span></td>
              <td>${a.clinicCount}<br><span class="muted" style="font-size:11px">活跃 ${a.activeClinicCount} / 新签 ${a.newClinicsLast30d}</span></td>
              <td>${money(a.monthSales)}</td>
              <td>${money(a.totalSales)}</td>
              <td>${a.totalEnrollments}<br><span class="muted" style="font-size:11px">本月 ${a.monthEnrollments}</span></td>
              <td>${badge(`${a.conversionRate}%`, a.totalEnrollments > 0 ? tone : "muted")}</td>
              <td>${badge(a.status === "ACTIVE" ? "启用" : "停用", statusTone)}</td>
              <td class="actions">
                <button data-agent-detail="${html(a.id)}">详情</button>
                ${canCreateCity || canCreateProvince ? `<button data-agent-edit="${html(a.id)}">编辑</button>` : ""}
              </td>
            </tr>`;
          }).join("")}</tbody>
        </table></div>`}
      </div>

      <div class="panel">
        <h3>📈 代理详情 ${detail ? `· ${html(detail.agent.name)}` : ""}</h3>
        ${!detail ? `<div class="empty-state"><div class="empty-state__title">点击「详情」查看</div><div class="empty-state__sub">查看月度销售 / 推广趋势 / 终端列表</div></div>` : `
          <div style="margin-bottom:12px">
            <div class="muted" style="font-size:12px">${detail.agent.adminRole === "PROVINCE_ADMIN" ? "省级代理" : detail.agent.adminRole === "CITY_ADMIN" ? "市级代理" : detail.agent.adminRole} · ${html(detail.agent.phone)} · ${badge(detail.agent.status === "ACTIVE" ? "启用" : "停用", detail.agent.status === "ACTIVE" ? "green" : "rose")}</div>
            <div class="muted" style="font-size:12px;margin-top:4px">辖区：${detail.agent.managedCities.length > 0 ? detail.agent.managedCities.join("、") : (detail.agent.province || "—")}</div>
            <div class="muted" style="font-size:12px;margin-top:4px">最后登录：${detail.agent.lastLoginAt ? html(compactDateTime(detail.agent.lastLoginAt)) : "—"}</div>
          </div>
          <div class="grid four" style="margin-bottom:12px">
            <div class="panel metric"><span class="muted">累计销售</span><strong>${money(detail.agent.totalSales)}</strong></div>
            <div class="panel metric"><span class="muted">本月销售</span><strong>${money(detail.agent.monthSales)}</strong></div>
            <div class="panel metric"><span class="muted">累计线索</span><strong>${detail.agent.totalEnrollments}</strong></div>
            <div class="panel metric"><span class="muted">转化</span><strong>${detail.agent.conversionRate}%</strong></div>
          </div>
          <h4 style="margin:8px 0">📊 近 12 个月走势</h4>
          <div class="bar-chart-list">${detail.monthly.length === 0 ? `<div class="empty-state"><div class="empty-state__title">暂无月度数据</div></div>` : (() => {
            const maxSales = Math.max(1, ...detail.monthly.map((m) => m.sales));
            return detail.monthly.map((m) => `<div class="bar-chart">
              <div class="bar-chart__label"><span><strong>${html(m.month)}</strong><small class="muted">线索 ${m.enrollments} · 新签 ${m.newClinics}</small></span><span>${money(m.sales)}</span></div>
              <div class="bar-chart__track"><div class="bar-chart__bar bar-chart__bar--green" style="transform:scaleX(${(m.sales / maxSales).toFixed(3)})"></div></div>
            </div>`).join("");
          })()}</div>
          <h4 style="margin:12px 0 6px">🏪 下辖终端诊所（${detail.clinics.length}）</h4>
          <div class="table-wrap" style="max-height:240px;overflow:auto"><table>
            <thead><tr><th>诊所</th><th>城市</th><th>状态</th><th>入驻</th></tr></thead>
            <tbody>${detail.clinics.map((c) => `<tr>
              <td>${html(c.name)}</td>
              <td>${html(c.city)}</td>
              <td>${badge(labelOf(CLINIC_STATUS_LABELS, c.status), c.status === "ACTIVE" ? "green" : "rose")}</td>
              <td class="muted">${c.createdAt ? html(compactDateTime(c.createdAt).slice(0, 10)) : "—"}</td>
            </tr>`).join("") || `<tr><td colspan="4"><div class="empty-state">无终端</div></td></tr>`}</tbody>
          </table></div>
        `}
      </div>
    </section>`;
}

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

function renderDrawer() {
  const drawer = state.drawer!;
  const config = configs[drawer.resource];
  const role = currentAdminRole();
  const fields = config.fields.filter((field) => {
    if (drawer.mode !== "create" && field.createOnly) return false;
    // 编辑模式：按已有 role 过滤字段
    if (field.showAdminOnly && drawer.mode === "edit" && drawer.item?.role !== "PLATFORM_ADMIN") return false;
    if (field.showNonAdminOnly && drawer.item?.role === "PLATFORM_ADMIN") return false;
    if (drawer.mode === "create" && drawer.resource === "users") {
      // 门店 tab：隐藏 admin 专属字段，显示 clinicId
      // 总部 tab：隐藏 clinicId（不需要绑定门店），隐藏 province（全国无省份）
      // 省级 tab：显示 province，隐藏 managedCities
      // 地市 tab：显示 province + managedCities
      if (field.name === "clinicId") {
        if (state.accountTab !== "clinic") return false;
      }
      if (field.showAdminOnly) {
        if (state.accountTab === "clinic") return false;
        // 总部 tab 不需要管辖省份
        if (state.accountTab === "platform" && (field.name === "province" || field.name === "managedCities")) return false;
        // 省级 tab：显示 province（默认自己省），隐藏 managedCities
        if (state.accountTab === "province" && field.name === "managedCities") return false;
      }
      // 权限感知：当前 admin 看不到比自己高的 tab，但若账号已自动跳转过来则要兜底
      // CITY_ADMIN 只能创建门店账号，强制 accountTab 已经是 clinic
      if (role === "CITY_ADMIN" && state.accountTab !== "clinic") return false;
      if (role === "PROVINCE_ADMIN" && state.accountTab === "platform") return false;
      if (role === "PROVINCE_ADMIN" && state.accountTab === "province") return false;
    }
    return true;
  });
  if (drawer.mode === "create" && drawer.resource === "clinics" && !fields.some((field) => field.name === "status")) {
    fields.push({ name: "status", label: "状态", kind: "select", defaultValue: "ACTIVE", options: () => Object.entries(CLINIC_STATUS_LABELS).map(([value, label]) => ({ value, label })) });
  }
  // 用户在数据看板看到的字段如果当前 admin 无权创建 → 直接拦截
  if (drawer.mode === "create" && drawer.resource === "users") {
    if (role === "CITY_ADMIN" && state.accountTab !== "clinic") {
      return `<div class="drawer-backdrop"><section class="drawer"><div class="drawer-header"><h2>无权限</h2><button id="closeDrawer" class="secondary icon">×</button></div><div class="empty-state"><div class="empty-state__title">您没有权限创建该类型账号</div></div></section></div>`;
    }
  }
  return `
    <div class="drawer-backdrop">
      <section class="drawer">
        <div class="drawer-header">
          <div><h2>${drawer.mode === "create" ? "新增" : "编辑"}${config.label}</h2><p class="muted">${config.subtitle}</p></div>
          <button id="closeDrawer" class="secondary icon">×</button>
        </div>
        ${drawer.mode === "create" && drawer.resource === "articles"
          ? renderAiPanel(
              "aiArticleAdminPanel",
              "如：写一篇关于女性冬季手脚冰凉的科普文章，重点讲原因和日常调理方法。",
              "提示词：仅作生成参考，不会随文章发布"
            )
          : ""}
        ${drawer.mode === "create" && drawer.resource === "marketingPosts"
          ? renderAiPanel(
              "aiMarketingAdminPanel",
              "如：双十一妇科体检套餐 9.9 元秒杀，仅限前 100 名新客，含妇科彩超 + 白带常规。",
              "提示词：仅作生成参考，不会随营销稿发布"
            )
          : ""}
        <form id="resourceForm" class="form">
          <div class="form-grid">${fields.map((field) => renderField(field, drawer.item)).join("")}</div>
          <div class="actions"><button type="submit">保存</button><button id="cancelDrawer" class="secondary" type="button">取消</button></div>
        </form>
      </section>
    </div>`;
}

function renderField(field: Field, item?: any) {
  const kind = field.kind ?? "text";
  const raw = fieldValue(field, item);
  // 创建时用 defaultValue，编辑时用已有值
  const statusDefaults: Partial<Record<ResourceKey, string>> = {
    clinics: "ACTIVE",
    users: "ACTIVE",
    kits: "ACTIVE",
    templates: "PUBLISHED",
    articles: "PUBLISHED",
    marketingPosts: "PUBLISHED",
    tasks: "PENDING",
    taskTemplates: "PUBLISHED"
  };
  const createDefault = field.name === "status" ? statusDefaults[state.drawer?.resource as ResourceKey] : undefined;
  const value = item ? raw : (field.defaultValue ?? createDefault ?? raw);
  const isImageUrlField = /imageurl$/i.test(field.name);
  const requiredOnCreate = state.drawer?.mode === "create"
    && !isImageUrlField
    && !(state.drawer.resource === "tasks" && field.name === "clinicId");
  const isRequired = Boolean(field.required || requiredOnCreate);
  const required = isRequired ? "required" : "";
  const common = `name="${html(field.name)}" ${required}`;
  let control = "";
  if (kind === "business-hours") {
    const matched = String(value || "").match(/(\d{1,2}):(\d{2})\s*[-~—–到至]\s*(\d{1,2}):(\d{2})/);
    const start = matched ? `${matched[1].padStart(2, "0")}:${matched[2]}` : "08:00";
    const end = matched ? `${matched[3].padStart(2, "0")}:${matched[4]}` : "22:00";
    const normalized = `周一至周日 ${start}-${end}`;
    control = `<div class="business-hours-control">
      <input type="time" value="${start}" data-business-hours-start aria-label="开始营业时间" required />
      <span>至</span>
      <input type="time" value="${end}" data-business-hours-end aria-label="结束营业时间" required />
      <input type="hidden" name="${html(field.name)}" value="${html(normalized)}" data-business-hours-value />
    </div>`;
  } else if (kind === "select" || field.name === "kitId") {
    const options = field.name === "kitId" ? kitOptions() : (field.options?.() ?? []);
    control = `<select ${common}><option value="">请选择</option>${options.map((option) => `<option value="${html(option.value)}" ${String(value) === option.value ? "selected" : ""}>${html(option.label)}</option>`).join("")}</select>`;
  } else if (kind === "textarea") {
    control = `<textarea ${common}>${html(value)}</textarea>`;
  } else if (kind === "checklist") {
    const options = field.options?.() ?? [];
    const selected = new Set(Array.isArray(value) ? value : value ? String(value).split(/[,，/]/).map((s) => s.trim()).filter(Boolean) : []);
    control = `<div class="checklist">${options.map((option) => `<label class="checklist__item"><input type="checkbox" name="${html(field.name)}" value="${html(option.value)}" ${selected.has(option.value) ? "checked" : ""} />${html(option.label)}</label>`).join("")}</div>`;
  } else if (kind === "cascade") {
    if (field.cascade === "province") {
      const role = currentAdminRole();
      const adminProv = currentAdminProvince();
      let options = regions().map((r) => ({ value: r.name, label: r.name }));
      // 权限感知：PROVINCE/CITY_ADMIN 的 province 锁定为辖区省份
      const locked = (role === "PROVINCE_ADMIN" || role === "CITY_ADMIN") && adminProv;
      if (locked) {
        options = options.filter((o) => o.value === adminProv);
      }
      const provValue = item ? value : (field.defaultValue ?? (locked ? adminProv : ""));
      const disabled = locked ? "disabled" : "";
      control = `<select ${common} ${disabled} data-cascade-province>${options.map((o) => `<option value="${html(o.value)}" ${String(provValue) === o.value ? "selected" : ""}>${html(o.label)}</option>`).join("")}</select>`;
    } else if (field.cascade === "city") {
      const role = currentAdminRole();
      const adminProv = currentAdminProvince();
      const adminCities = currentAdminCities();
      // CITY_ADMIN 的 province 与 item.province 都可能为空，必须从 adminProv 兜底
      const prov = item?.province ?? ((role === "PROVINCE_ADMIN" || role === "CITY_ADMIN") ? adminProv : "");
      let cities = prov ? getCitiesByProvince(String(prov)) : [];
      // 兜底：如果账号辖区城市不在当前数据库行政区划选项中，临时并入下拉。
      if (role === "PROVINCE_ADMIN" || role === "CITY_ADMIN") {
        for (const c of adminCities) {
          if (!cities.includes(c)) cities.push(c);
        }
      }
      // 兜底 2：编辑时若 item.city 不在 options 中（例如老数据），临时加入，
      //         保证 <option selected> 能命中，否则下拉看上去是空的
      if (item?.city && !cities.includes(String(item.city))) {
        cities.push(String(item.city));
      }
      // 权限感知：PROVINCE/CITY 只能看到自己辖区的城市
      if (role === "PROVINCE_ADMIN" || role === "CITY_ADMIN") {
        const allowed = new Set(adminCities);
        cities = cities.filter((c) => allowed.has(c));
      }
      // CITY_ADMIN 只能管一个城市，禁用 select 防止误改
      const cityLocked = role === "CITY_ADMIN" && adminCities.length <= 1;
      // 创建时的默认值：PROVINCE_ADMIN 选第一个城市，CITY_ADMIN 选自己唯一城市
      const defaultCity = role === "PROVINCE_ADMIN" ? (cities[0] ?? "") : role === "CITY_ADMIN" ? (adminCities[0] ?? "") : "";
      const cityValue = item ? value : (field.defaultValue ?? defaultCity);
      const disabled = cityLocked ? "disabled" : "";
      control = `<select ${common} ${disabled} data-cascade-city>${cities.map((c) => `<option value="${html(c)}" ${String(cityValue) === c ? "selected" : ""}>${html(c)}</option>`).join("")}</select>`;
    } else if (field.cascade === "district") {
      const role = currentAdminRole();
      const adminCities = currentAdminCities();
      const cityVal = item?.city ?? (role === "CITY_ADMIN" ? (adminCities[0] ?? "") : "");
      let districts = cityVal ? getDistrictsByCity(String(cityVal)) : [];
      // 兜底：编辑老数据时，如果 item.district 不在当前数据库选项中，仍渲染出来避免值丢失
      if (item?.district && !districts.includes(String(item.district))) {
        districts = [String(item.district), ...districts];
      }
      const districtLocked = role === "CITY_ADMIN";
      const disabled = districtLocked ? "disabled" : "";
      control = `<select ${common} ${disabled} data-cascade-district>${districts.map((d) => `<option value="${html(d)}" ${String(value) === d ? "selected" : ""}>${html(d)}</option>`).join("")}</select>`;
    }
  } else {
    control = `<input ${common} type="${kind === "number" ? "number" : "text"}" value="${html(value)}" placeholder="${kind === "tags" ? "多个值用逗号分隔" : ""}" />`;
  }
  // 字段下方的辅助说明：默认仅创建时显示（hintAlways 强制常显）
  const hintHtml = field.hint && (!item || field.hintAlways)
    ? `<small class="field-hint muted">${html(field.hint)}</small>`
    : "";
  return `<div class="field ${field.full ? "full" : ""} ${isRequired ? "is-required" : ""}" data-field-name="${html(field.name)}"><label>${html(field.label)}</label>${control}${hintHtml}</div>`;
}

function fieldValue(field: Field, item?: any) {
  if (!item) return field.name === "mode" ? "all" : "";
  const value = item[field.name];
  if (field.kind === "tags") return Array.isArray(value) ? value.join(", ") : value ?? "";
  if (field.kind === "checklist") return Array.isArray(value) ? value : value ? String(value).split(/[,，/]/).map((s) => s.trim()).filter(Boolean) : [];
  return value ?? "";
}

function formPayload(form: HTMLFormElement, resource: ResourceKey) {
  const config = configs[resource];
  const data = new FormData(form);
  const payload: Record<string, unknown> = {};
  const cascadeValue = (selector: string) => form.querySelector<HTMLSelectElement>(selector)?.value.trim() ?? "";
  for (const field of config.fields) {
    let rawValues = data.getAll(field.name).map((item) => String(item));
    if (field.kind === "cascade") {
      const selectedValue = form.querySelector<HTMLSelectElement>(`select[name="${field.name}"]`)?.value.trim() ?? "";
      if (selectedValue || rawValues.length === 0) rawValues = selectedValue ? [selectedValue] : [];
    }
    if (field.kind === "number") {
      payload[field.name] = rawValues[0] === "" ? undefined : Number(rawValues[0]);
    } else if (field.kind === "tags") {
      payload[field.name] = rawValues.join(",").split(/[,，/]/).map((item) => item.trim()).filter(Boolean);
    } else if (field.kind === "checklist") {
      payload[field.name] = rawValues.filter((item) => item !== "" && item != null);
    } else if (rawValues.length > 0) {
      payload[field.name] = rawValues[rawValues.length - 1];
    }
  }
  if (resource === "clinics") {
    const start = form.querySelector<HTMLInputElement>("[data-business-hours-start]")?.value || "08:00";
    const end = form.querySelector<HTMLInputElement>("[data-business-hours-end]")?.value || "22:00";
    payload.businessHours = `周一至周日 ${start}-${end}`;
    payload.openTime = start;
    payload.closeTime = end;
  }
  // 账号管理：根据当前 tab 自动确定 role 和 adminRole
  if (resource === "users") {
    if (state.accountTab === "province") {
      payload.role = "PLATFORM_ADMIN";
      payload.adminRole = "PROVINCE_ADMIN";
      // 省级账号：把选中的 province 展开成所有城市（覆盖 managedCities）
      const prov = String(payload.province ?? "").trim() || cascadeValue("[data-cascade-province]");
      if (prov) {
        const cities = getCitiesByProvince(prov);
        payload.managedCities = cities.join(",");
        payload.province = prov;
      }
    } else if (state.accountTab === "city") {
      payload.role = "PLATFORM_ADMIN";
      payload.adminRole = "CITY_ADMIN";
      // 地市账号：managedCities 必须是单一城市（后端校验），从表单的 city select 取
      const prov = String(payload.province ?? "").trim() || cascadeValue("[data-cascade-province]");
      const city = String(payload.managedCities ?? "").trim() || cascadeValue("[data-cascade-city]");
      if (prov) payload.province = prov;
      if (city) payload.managedCities = city;
    } else if (state.accountTab === "platform") {
      payload.role = "PLATFORM_ADMIN";
      payload.adminRole = "NATIONAL_ADMIN";
      // 总部账号：清掉 province/managedCities
      delete payload.province;
      delete payload.managedCities;
    } else {
      // 门店 tab：默认医生角色
      payload.role = "CLINIC_DOCTOR";
      // 清掉 admin 字段防止泄漏
      delete payload.province;
      delete payload.managedCities;
    }
  }
  return payload;
}

async function saveResource(form: HTMLFormElement) {
  const drawer = state.drawer!;
  const config = configs[drawer.resource];
  const payload = formPayload(form, drawer.resource);
  if (drawer.resource === "clinics") {
    const start = String(payload.openTime ?? "08:00");
    const end = String(payload.closeTime ?? "22:00");
    if (start >= end) throw new Error("结束营业时间必须晚于开始营业时间");
  }
  if (drawer.mode === "edit") payload.id = drawer.item.id;
  // 创建门店时，自动以门店电话创建一个医生账号（默认密码 qwe123456）
  if (drawer.mode === "create" && drawer.resource === "clinics" && /^1\d{10}$/.test(String(payload.phone ?? "").trim())) {
    payload.createClinicUser = true;
  }
  const result = await api<{ clinic?: any; createdUser?: { phone: string; defaultPassword: string; name: string } | null; error?: string }>(config.endpoint, {
    method: drawer.mode === "create" ? "POST" : "PATCH",
    bodyJson: payload
  });
  state.drawer = undefined;
  // 创建门店时，若后端自动创建了医生账号，用 status 提示账号信息
  if (drawer.mode === "create" && drawer.resource === "clinics" && result?.createdUser) {
    const u = result.createdUser;
    state.message = `门店已创建。已自动为该门店创建医生账号：手机号 ${u.phone}，默认密码 ${u.defaultPassword}（请提醒医生首次登录后修改）。`;
  } else {
    state.message = "保存成功";
  }
  state.error = undefined;
  await loadResource(drawer.resource);
  await loadDashboard();
  renderApp();
}

async function deleteResource(resource: ResourceKey, rowId: string) {
  const ok = await confirmDialog({
    title: "删除确认",
    message: "确定要删除这条内容吗？",
    okText: "确定删除",
    danger: true
  });
  if (!ok) return;
  try {
    await api(configs[resource].endpoint, { method: "DELETE", bodyJson: { id: rowId } });
    showToast("删除成功", "success");
    await loadResource(resource);
    await loadDashboard();
    renderApp();
  } catch (error: any) {
    showToast(error?.message ?? "删除失败", "error");
  }
}

async function confirmBatchDelete(count: number, label: string) {
  const prompts = [
    { title: "批量删除确认", message: `将删除选中的 ${count} 条${label}，是否继续？`, okText: "继续核对" },
    { title: "再次确认", message: "批量删除后相关数据可能无法恢复，请再次确认。", okText: "确认风险" },
    { title: "最终确认", message: `最终确认删除这 ${count} 条${label}？`, okText: "确认批量删除" }
  ];
  for (const prompt of prompts) {
    const ok = await confirmDialog({ ...prompt, danger: true });
    if (!ok) return false;
  }
  return true;
}

async function batchDeleteResources(resource: ResourceKey, ids: string[]) {
  if (!ids.length) return;
  const confirmed = await confirmBatchDelete(ids.length, configs[resource].label);
  if (!confirmed) return;
  let deleted = 0;
  const failures: string[] = [];
  for (const id of ids) {
    try {
      await api(configs[resource].endpoint, { method: "DELETE", bodyJson: { id } });
      deleted += 1;
    } catch (error: any) {
      failures.push(error?.message ?? id);
    }
  }
  state.selectedResourceIds[resource] = [];
  if (resource === "users") state.selectedUserIds = [];
  showToast(failures.length ? `已删除 ${deleted} 条，${failures.length} 条失败` : `已删除 ${deleted} 条`, failures.length ? "warn" : "success");
  await loadResource(resource);
  await loadDashboard();
  renderApp();
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
  document.querySelector<HTMLFormElement>("#knowledgeDocumentForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    return withFormLoading(form, async () => {
      try {
        await api("/api/admin/knowledge-documents", { method: "POST", bodyJson: Object.fromEntries(new FormData(form)) });
        form.reset();
        await loadKnowledgeDocuments();
        showToast("知识文档已保存", "success");
        renderApp();
      } catch (error: any) {
        showToast(error.message || "知识文档保存失败", "error");
      }
    });
  });
  const closeKnowledgeDocumentEditor = () => {
    state.knowledgeDocumentEditor = undefined;
    renderApp();
  };
  document.querySelectorAll<HTMLButtonElement>("[data-knowledge-edit]").forEach((button) => {
    button.onclick = () => {
      const item = (state.knowledgeDocuments ?? []).find((documentItem) => documentItem.id === button.dataset.knowledgeEdit);
      if (!item) return;
      state.knowledgeDocumentEditor = item;
      renderApp();
    };
  });
  document.querySelector<HTMLElement>("[data-close-knowledge-editor]")?.addEventListener("click", (event) => {
    if (event.target !== event.currentTarget) return;
    closeKnowledgeDocumentEditor();
  });
  document.querySelector<HTMLButtonElement>("#closeKnowledgeDocumentEditor")?.addEventListener("click", closeKnowledgeDocumentEditor);
  document.querySelector<HTMLButtonElement>("#cancelKnowledgeDocumentEditor")?.addEventListener("click", closeKnowledgeDocumentEditor);
  document.querySelector<HTMLFormElement>("#knowledgeDocumentEditorForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const current = state.knowledgeDocumentEditor;
    if (!current) return;
    return withFormLoading(form, async () => {
      const formData = Object.fromEntries(new FormData(form)) as Record<string, string>;
      const nextContent = String(formData.content ?? "");
      const contentChanged = nextContent !== String(current.content ?? "");
      const structuredData = {
        ...(current.structuredData ?? {}),
        compositeStrategy: formData.compositeStrategy || undefined,
        manualClassification: {
          editedAt: new Date().toISOString(),
          knowledgeBaseId: formData.knowledgeBaseId,
          sourceType: formData.sourceType,
          modality: formData.modality
        }
      };
      const payload: Record<string, unknown> = {
        id: current.id,
        title: formData.title ?? "",
        knowledgeBaseId: formData.knowledgeBaseId ?? current.knowledgeBaseId,
        sourceType: formData.sourceType ?? current.sourceType,
        modality: formData.modality ?? current.modality,
        category: formData.category ?? "",
        status: formData.status ?? current.status,
        reviewStatus: formData.reviewStatus ?? current.reviewStatus,
        authority: formData.authority ?? "",
        evidenceLevel: formData.evidenceLevel ?? "",
        reviewer: formData.reviewer ?? "",
        effectiveAt: formData.effectiveAt ?? "",
        expiresAt: formData.expiresAt ?? "",
        tags: formData.tags ?? "",
        fileUrl: formData.fileUrl ?? "",
        structuredData
      };
      if (contentChanged) payload.content = nextContent;
      if (formData.reindex === "true" || contentChanged) payload.reindex = true;
      await api("/api/admin/knowledge-documents", { method: "PATCH", bodyJson: payload });
      await Promise.all([loadKnowledgeBases(), loadKnowledgeDocuments()]);
      state.knowledgeDocumentEditor = undefined;
      showToast("知识文档已更新", "success");
      renderApp();
    });
  });
  const updateKnowledgeBatchSelection = (files?: FileList | null) => {
    const summary = document.querySelector<HTMLElement>("#knowledgeBatchSelection");
    if (!summary) return;
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length) {
      summary.textContent = "未选择文件";
      return;
    }
    const preview = selectedFiles.slice(0, 3).map((file) => file.name).join("、");
    const suffix = selectedFiles.length > 3 ? ` 等 ${selectedFiles.length} 个文件` : `，共 ${selectedFiles.length} 个文件`;
    summary.textContent = `${preview}${suffix}`;
  };
  document.querySelector<HTMLInputElement>("[data-knowledge-upload-input]")?.addEventListener("change", (event) => {
    updateKnowledgeBatchSelection((event.currentTarget as HTMLInputElement).files);
  });
  const legacyKnowledgeBatchForm = document.querySelector<HTMLFormElement>("#knowledgeBatchUploadForm");
  if (legacyKnowledgeBatchForm && !legacyKnowledgeBatchForm.querySelector("[data-knowledge-dropzone]")) {
    legacyKnowledgeBatchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      return withFormLoading(form, async () => {
        const response = await fetch(`${API_BASE_URL}/api/admin/knowledge-documents/batch-upload`, {
          method: "POST",
          credentials: "include",
          body: new FormData(form)
        });
        const data = await response.json().catch(() => ({})) as { error?: string; succeeded?: number; failed?: number };
        if (!response.ok) throw new Error(data.error || "批量上传失败");
        form.reset();
        updateKnowledgeBatchSelection(null);
        await Promise.all([loadKnowledgeBases(), loadKnowledgeDocuments()]);
        showToast(`批量上传完成：成功 ${data.succeeded ?? 0}，失败 ${data.failed ?? 0}`, data.failed ? "warn" : "success");
        renderApp();
      });
    });
  }
  const knowledgeUploadFiles = new Map<string, File>();
  const uploadSummary = document.querySelector<HTMLElement>("#knowledgeBatchSelection");
  const uploadProgress = document.querySelector<HTMLElement>("#knowledgeUploadProgress");
  const uploadProgressTitle = document.querySelector<HTMLElement>("#knowledgeUploadProgressTitle");
  const uploadProgressPercent = document.querySelector<HTMLElement>("#knowledgeUploadProgressPercent");
  const uploadProgressBar = document.querySelector<HTMLElement>("#knowledgeUploadProgressBar");
  const uploadProgressText = document.querySelector<HTMLElement>("#knowledgeUploadProgressText");
  const uploadProgressFiles = document.querySelector<HTMLElement>("#knowledgeUploadProgressFiles");
  const fileInput = document.querySelector<HTMLInputElement>("[data-knowledge-file-input]");
  const folderInput = document.querySelector<HTMLInputElement>("[data-knowledge-folder-input]");
  const dropzone = document.querySelector<HTMLElement>("[data-knowledge-dropzone]");

  const knowledgeUploadKey = (file: File) => `${file.name}::${file.size}::${file.lastModified}::${(file as File & { webkitRelativePath?: string }).webkitRelativePath ?? ""}`;
  const selectedKnowledgeFiles = () => Array.from(knowledgeUploadFiles.values());
  const renderKnowledgeSelectionV2 = () => {
    if (!uploadSummary) return;
    const files = selectedKnowledgeFiles();
    if (!files.length) {
      uploadSummary.textContent = "未选择文件";
      return;
    }
    const preview = files.slice(0, 3).map((file) => (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name).join("、");
    const suffix = files.length > 3 ? ` 等 ${files.length} 个文件` : `，共 ${files.length} 个文件`;
    uploadSummary.textContent = `${preview}${suffix}`;
  };
  const setUploadProgress = (percent: number, title: string, detail: string) => {
    if (!uploadProgress || !uploadProgressBar || !uploadProgressPercent || !uploadProgressTitle || !uploadProgressText) return;
    uploadProgress.hidden = false;
    const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
    uploadProgressBar.style.width = `${safePercent}%`;
    uploadProgressPercent.textContent = `${safePercent}%`;
    uploadProgressTitle.textContent = title;
    uploadProgressText.textContent = detail;
  };
  const renderUploadFileProgress = (documents: any[]) => {
    if (!uploadProgressFiles) return;
    uploadProgressFiles.innerHTML = documents.map((item) => {
      const processing = item.structuredData?.processing ?? {};
      const percent = item.parseStatus === "READY" || item.parseStatus === "ERROR"
        ? 100
        : Math.max(0, Math.min(100, Number(processing.percent ?? 0)));
      const message = item.parseStatus === "READY"
        ? "解析与索引完成"
        : item.parseStatus === "ERROR"
          ? (item.errorMessage || "处理失败")
          : String(processing.message ?? "处理中");
      return `<article class="knowledge-upload-progress__file"><div><strong>${html(item.structuredData?.originalName ?? item.title)}</strong><small>${html(String(processing.stage ?? item.parseStatus))}</small></div><div class="knowledge-upload-progress__track knowledge-upload-progress__track--file"><span style="width:${Math.round(percent)}%"></span></div><p>${html(message)}</p></article>`;
    }).join("");
  };
  const appendKnowledgeFiles = (files: File[]) => {
    for (const file of files) knowledgeUploadFiles.set(knowledgeUploadKey(file), file);
    renderKnowledgeSelectionV2();
  };

  document.querySelector<HTMLElement>("[data-knowledge-pick-files]")?.addEventListener("click", () => fileInput?.click());
  document.querySelector<HTMLElement>("[data-knowledge-pick-folder]")?.addEventListener("click", () => folderInput?.click());
  fileInput?.addEventListener("change", (event) => appendKnowledgeFiles(Array.from((event.currentTarget as HTMLInputElement).files ?? [])));
  folderInput?.addEventListener("change", (event) => appendKnowledgeFiles(Array.from((event.currentTarget as HTMLInputElement).files ?? [])));
  dropzone?.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragover");
  });
  dropzone?.addEventListener("dragleave", () => {
    dropzone.classList.remove("is-dragover");
  });
  dropzone?.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragover");
    appendKnowledgeFiles(Array.from(event.dataTransfer?.files ?? []));
  });

  document.querySelector<HTMLFormElement>("#knowledgeBatchUploadFormV2, #knowledgeBatchUploadForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    return withFormLoading(form, async () => {
      const files = selectedKnowledgeFiles();
      if (!files.length) throw new Error("请先选择要上传的文件");

      setUploadProgress(2, "开始上传", `已选 ${files.length} 个文件，正在传输到后台`);
      renderUploadFileProgress([]);
      const formData = new FormData();
      for (const file of files) formData.append("files", file, (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name);

      const response = await new Promise<{ status: number; body: any }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_BASE_URL}/api/admin/knowledge-documents/batch-upload`);
        xhr.withCredentials = true;
        xhr.upload.onprogress = (progressEvent) => {
          if (!progressEvent.lengthComputable) return;
          const percent = progressEvent.total ? progressEvent.loaded / progressEvent.total * 35 : 0;
          setUploadProgress(percent, "上传中", `正在上传 ${files.length} 个文件`);
        };
        xhr.onerror = () => reject(new Error("批量上传失败"));
        xhr.onload = () => {
          let body: any = {};
          try {
            body = JSON.parse(xhr.responseText || "{}");
          } catch {
            body = {};
          }
          resolve({ status: xhr.status, body });
        };
        xhr.send(formData);
      });

      if (response.status < 200 || response.status >= 300) {
        throw new Error(response.body?.error || "批量上传失败");
      }

      const documentIds = Array.isArray(response.body?.documentIds) ? response.body.documentIds.map(String) : [];
      setUploadProgress(38, "后台处理中", "正在解析文件、结构化切分并建立索引");

      if (documentIds.length) {
        let finished = false;
        while (!finished) {
          const latest = await api<{ documents: any[] }>("/api/admin/knowledge-documents");
          const tracked = latest.documents.filter((item) => documentIds.includes(String(item.id)));
          const percents = tracked.map((item) => {
            const processing = item.structuredData?.processing ?? {};
            if (item.parseStatus === "READY" || item.parseStatus === "ERROR") return 100;
            return Math.max(0, Math.min(100, Number(processing.percent ?? 0)));
          });
          const average = percents.length ? percents.reduce((sum, item) => sum + item, 0) / percents.length : 100;
          const overall = 35 + average * 0.65;
          renderUploadFileProgress(tracked);
          setUploadProgress(overall, "解析与索引中", `已完成 ${tracked.filter((item) => item.parseStatus === "READY").length} / ${tracked.length}，失败 ${tracked.filter((item) => item.parseStatus === "ERROR").length}`);
          finished = tracked.length > 0 && tracked.every((item) => item.parseStatus === "READY" || item.parseStatus === "ERROR");
          if (!finished) await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      }

      knowledgeUploadFiles.clear();
      if (fileInput) fileInput.value = "";
      if (folderInput) folderInput.value = "";
      renderKnowledgeSelectionV2();
      await Promise.all([loadKnowledgeBases(), loadKnowledgeDocuments()]);
      setUploadProgress(100, "处理完成", `成功 ${response.body?.succeeded ?? 0}，失败 ${response.body?.failed ?? 0}`);
      showToast(`批量上传完成：成功 ${response.body?.succeeded ?? 0}，失败 ${response.body?.failed ?? 0}`, response.body?.failed ? "warn" : "success");
      renderApp();
    });
  });
  document.querySelector<HTMLFormElement>("#knowledgeBaseForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    return withFormLoading(form, async () => {
      const response = await api<{ base: any }>("/api/admin/knowledge-bases", { method: "POST", bodyJson: Object.fromEntries(new FormData(form)) });
      state.selectedKnowledgeBaseId = response.base.id;
      await Promise.all([loadKnowledgeBases(), loadKnowledgeDocuments()]);
      showToast("知识库已创建", "success");
      renderApp();
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-knowledge-base]").forEach((button) => {
    button.onclick = () => {
      state.selectedKnowledgeBaseId = button.dataset.knowledgeBase;
      state.knowledgeSearchResults = [];
      state.knowledgeSearchMode = "single";
      renderApp();
    };
  });
  document.querySelector<HTMLButtonElement>("[data-knowledge-base-reindex]")?.addEventListener("click", (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    return withLoading(button, async () => {
      const response = await api<{ documentCount: number }>("/api/admin/knowledge-bases", { method: "PATCH", bodyJson: { id: button.dataset.knowledgeBaseReindex, reindex: true } });
      await Promise.all([loadKnowledgeBases(), loadKnowledgeDocuments()]);
      showToast(`已重建 ${response.documentCount} 份文档的混合索引`, "success");
      renderApp();
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-knowledge-reindex]").forEach((button) => {
    button.onclick = () => withLoading(button, async () => {
      await api("/api/admin/knowledge-documents", { method: "PATCH", bodyJson: { id: button.dataset.knowledgeReindex, reindex: true } });
      await Promise.all([loadKnowledgeBases(), loadKnowledgeDocuments()]);
      showToast("知识索引已重建", "success");
      renderApp();
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-knowledge-approve]").forEach((button) => {
    button.onclick = () => withLoading(button, async () => {
      await api("/api/admin/knowledge-documents", { method: "PATCH", bodyJson: { id: button.dataset.knowledgeApprove, reviewStatus: "APPROVED" } });
      await loadKnowledgeDocuments();
      showToast("知识文档已通过医学审核，可以发布", "success");
      renderApp();
    });
  });
  document.querySelector<HTMLFormElement>("#knowledgeSearchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    return withFormLoading(form, async () => {
      const formData = Object.fromEntries(new FormData(form)) as Record<string, string>;
      const userCheckedAll = formData.searchAll === "true";
      const hasBase = !!(formData.knowledgeBaseId ?? "").trim();
      // 没勾选全库 + 隐藏字段空(bases 还没回来 / 选中库被删等)→ 兜底走全库
      const effectiveAll = userCheckedAll || !hasBase;
      const body: Record<string, string | number> = {
        query: formData.query ?? "",
        imageUrl: formData.imageUrl ?? "",
        topK: effectiveAll ? 20 : 5
      };
      if (effectiveAll) body.searchAll = "true";
      else body.knowledgeBaseId = formData.knowledgeBaseId;
      const data = await api<{ results: any[]; mode: "single" | "all" }>("/api/admin/knowledge-search", { method: "POST", bodyJson: body });
      state.knowledgeSearchResults = data.results;
      state.knowledgeSearchMode = data.mode;
      showToast(`检索完成（${data.mode === "all" ? "全库" : "单库"}），召回 ${data.results.length} 个知识片段`, "success");
      renderApp();
    });
  });
  // 全库切换时即时更新 mode 状态以刷新右上角 pill，无需等提交
  document.querySelector<HTMLInputElement>("[data-knowledge-search-all]")?.addEventListener("change", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    state.knowledgeSearchMode = input.checked ? "all" : "single";
    renderApp();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-knowledge-status]").forEach((button) => {
    button.onclick = () => withLoading(button, async () => {
      await api("/api/admin/knowledge-documents", { method: "PATCH", bodyJson: { id: button.dataset.knowledgeStatus, status: button.dataset.status } });
      await Promise.all([loadKnowledgeBases(), loadKnowledgeDocuments()]);
      showToast(button.dataset.status === "PUBLISHED" ? "知识文档已发布" : "知识文档已转为草稿", "success");
      renderApp();
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-knowledge-delete]").forEach((button) => {
    button.onclick = async () => {
      const ok = await confirmDialog({ title: "删除知识文档", message: "确定删除这份知识文档吗？历史方案仍保留引用快照。", okText: "确认删除", danger: true });
      if (!ok) return;
      await api("/api/admin/knowledge-documents", { method: "DELETE", bodyJson: { id: button.dataset.knowledgeDelete } });
      await Promise.all([loadKnowledgeBases(), loadKnowledgeDocuments()]);
      showToast("知识文档已删除", "success");
      renderApp();
    };
  });
  document.querySelector<HTMLButtonElement>("#logoutBtn")!.onclick = (event) => {
    const btn = event.currentTarget as HTMLButtonElement;
    return withLoading(btn, async () => {
      await logout();
      state.data = undefined;
      state.resources = {};
      state.message = "已退出";
      renderLogin();
    });
  };
  // 通知/错误条点击关闭
  document.querySelector<HTMLElement>("[data-dismiss-status-link]")?.addEventListener("click", (event) => {
    event.preventDefault();
    state.error = undefined;
    state.message = undefined;
    if (statusDismissTimer) { clearTimeout(statusDismissTimer); statusDismissTimer = undefined; }
    renderApp();
  });
  document.querySelector<HTMLButtonElement>("#refreshBtn")!.onclick = (event) => {
    const btn = event.currentTarget as HTMLButtonElement;
    return withLoading(btn, async () => {
      await loadAll();
      state.message = "已刷新";
      renderApp();
    });
  };
  document.querySelector<HTMLButtonElement>("#notifBtn")?.addEventListener("click", async (event) => {
    event.stopPropagation();
    state.notifOpen = !state.notifOpen;
    if (state.notifOpen) await loadNotifications();
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
      await api("/api/admin/messages/read-all", { method: "POST" });
      await loadNotifications();
      renderApp();
    });
  });
  document.querySelectorAll<HTMLElement>("[data-notif]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      return withLoading(el, async () => {
        const id = el.dataset.notif!;
        state.activeNotification = state.notifications.find((message) => message.id === id);
        await api(`/api/admin/messages/${id}/read`, { method: "POST" });
        await loadNotifications();
        renderApp();
      });
    });
  });
  document.querySelectorAll<HTMLElement>("[data-close-message-detail]").forEach((element) => {
    element.onclick = () => { state.activeNotification = undefined; renderApp(); };
  });
  document.querySelectorAll<HTMLButtonElement>("[data-toggle-section]").forEach((button) => {
    button.onclick = () => {
      const id = button.dataset.toggleSection!;
      state.sidebarOpen[id] = !state.sidebarOpen[id];
      renderApp();
    };
  });
  document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((button) => {
    button.onclick = async () => {
      state.active = button.dataset.tab!;
      state.query = "";
      state.clinicFilter = "";
      state.statusFilter = "";
      // 切换 tab 时清掉诊所详情状态，避免详情页挡住主面板
      state.clinicDetail = undefined;
      state.clinicDetailId = undefined;
      if (["clinics", "users", "kits", "templates", "articles", "marketingPosts", "tasks", "taskTemplates", "purchases"].includes(state.active)) await loadResource(state.active as ResourceKey);
      if (state.active === "dispatch" && !state.dispatch) await loadDispatch();
      if (state.active === "reports" && !state.reports) await loadReports();
      if (state.active === "audit" && !state.loginHistory) await loadLoginHistory();
      if (state.active === "agents" && !state.agents) await loadAgents();
      if (state.active === "knowledgeBase" && (!state.knowledgeDocuments || !state.knowledgeBases)) await Promise.all([loadKnowledgeBases(), loadKnowledgeDocuments()]);
      if (state.active === "notifications") await Promise.all([loadNotifHistory(), loadNotifAudience()]);
      renderApp();
    };
  });

  // 通知下发 form
  document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((button) => {
    button.onclick = () => activateAdminWorkspaceTab(button.dataset.tab!);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-workspace-tab]").forEach((button) => {
    button.onclick = () => activateAdminWorkspaceTab(button.dataset.workspaceTab!);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-close-workspace-tab]").forEach((button) => {
    button.onclick = (event) => {
      event.stopPropagation();
      return closeAdminWorkspaceTab(button.dataset.closeWorkspaceTab!);
    };
  });

  const notifForm = document.querySelector<HTMLFormElement>("#notifForm");
  if (notifForm) {
    // 标题/内容/select 实时同步到 state
    notifForm.querySelector<HTMLInputElement>('[name="title"]')?.addEventListener("input", (e) => {
      state.notifDraft.title = (e.target as HTMLInputElement).value;
    });
    notifForm.querySelector<HTMLTextAreaElement>('[name="content"]')?.addEventListener("input", (e) => {
      state.notifDraft.content = (e.target as HTMLTextAreaElement).value;
    });
    notifForm.querySelectorAll<HTMLInputElement>('[name="notifUserId"]').forEach((el) => {
      el.addEventListener("change", () => {
        const ids: string[] = [];
        notifForm.querySelectorAll<HTMLInputElement>('[name="notifUserId"]:checked').forEach((candidate) => ids.push(candidate.value));
        state.notifDraft.userIds = ids;
        renderApp();
      });
    });
    notifForm.querySelector<HTMLInputElement>('[name="broadcastSelf"]')?.addEventListener("change", (e) => {
      state.notifDraft.broadcastSelf = (e.target as HTMLInputElement).checked;
    });
    notifForm.querySelector<HTMLInputElement>('[name="includePatients"]')?.addEventListener("change", (e) => {
      state.notifDraft.includePatients = (e.target as HTMLInputElement).checked;
    });
    notifForm.onsubmit = async (event) => {
      event.preventDefault();
      const d = state.notifDraft;
      if (!d.title.trim() || !d.content.trim()) {
        showToast("请填写标题和内容", "error");
        return;
      }
      if (d.scope === "SELECTED") {
        if (d.sendTo === "clinic" && d.clinicIds.length === 0) {
          showToast("请至少选择 1 家目标诊所", "error");
          return;
        }
        if (d.sendTo === "agent" && d.agentIds.length === 0) {
          showToast("请至少选择 1 个目标代理商", "error");
          return;
        }
      }
      try {
        const res = await api<{ ok: boolean; recipientClinics: number; recipientUsers: number; selfMessageId: string | null }>("/api/admin/notifications", {
          method: "POST",
          bodyJson: {
            title: d.title,
            content: d.content,
            sendTo: d.sendTo,
            scope: d.scope,
            clinicIds: d.clinicIds,
            agentIds: d.agentIds,
            broadcastSelf: d.broadcastSelf
          }
        });
        showToast(`✅ 已发送至 ${res.recipientClinics} 家诊所 / ${res.recipientUsers} 个账号`, "success");
        state.notifDraft = { ...d, title: "", content: "", clinicIds: [], agentIds: [], userIds: [] };
        await loadNotifHistory();
        await loadNotifications();
        renderApp();
      } catch (error: any) {
        showToast(error.message, "error");
      }
    };
  }

  // 代理商管理
  document.querySelectorAll<HTMLButtonElement>("[data-notif-target]").forEach((button) => {
    button.onclick = () => {
      state.notifDraft.targetType = button.dataset.notifTarget as typeof state.notifDraft.targetType;
      state.notifDraft.userIds = [];
      renderApp();
    };
  });
  if (notifForm) {
    notifForm.onsubmit = async (event) => {
      event.preventDefault();
      const draft = state.notifDraft;
      if (!draft.title.trim() || !draft.content.trim()) return showToast("请填写标题和内容", "error");
      if (draft.targetType === "SELECTED_USERS" && draft.userIds.length === 0) return showToast("请至少选择 1 位接收用户", "error");
      try {
        const result = await api<{ recipientUsers: number }>("/api/admin/notifications", {
          method: "POST",
          bodyJson: { title: draft.title, content: draft.content, targetType: draft.targetType, userIds: draft.userIds, broadcastSelf: draft.broadcastSelf, includePatients: draft.includePatients }
        });
        showToast(`已成功触达 ${result.recipientUsers} 位用户`, "success");
        state.notifDraft = { ...draft, title: "", content: "", userIds: [], clinicIds: [], agentIds: [] };
        await Promise.all([loadNotifHistory(), loadNotifications()]);
        renderApp();
      } catch (error: any) {
        showToast(error.message, "error");
      }
    };
  }

  const agentSearch = document.querySelector<HTMLInputElement>("#agentSearch");
  if (agentSearch) {
    agentSearch.addEventListener("input", () => {
      const q = agentSearch.value.toLowerCase().trim();
      document.querySelectorAll<HTMLTableRowElement>("#agentTable tbody tr").forEach((row) => {
        const hay = row.dataset.search ?? "";
        row.style.display = !q || hay.includes(q) ? "" : "none";
      });
    });
  }
  document.querySelector<HTMLButtonElement>("#agentCreateBtn")?.addEventListener("click", async (event) => {
    // 跳到一个简易弹层让用户输入
    const name = window.prompt("新代理账号名称（必填，1-40 字）", "");
    if (!name || !name.trim()) return;
    const phone = window.prompt("新代理账号手机号（11 位）", "");
    if (!phone || !/^1\d{10}$/.test(phone)) {
      showToast("手机号格式不正确", "error");
      return;
    }
    const myRole = currentAdminRole();
    const defaultRole = myRole === "PROVINCE_ADMIN" ? "CITY_ADMIN" : "PROVINCE_ADMIN";
    const roleStr = window.prompt(`新代理角色（PROVINCE_ADMIN / CITY_ADMIN）\n当前账号 ${myRole ?? "—"} 建议创建：${defaultRole}`, defaultRole);
    if (!roleStr) return;
    const adminRole = roleStr.trim() === "CITY_ADMIN" ? "CITY_ADMIN" : "PROVINCE_ADMIN";
    if (myRole === "PROVINCE_ADMIN" && adminRole === "PROVINCE_ADMIN") {
      showToast("省级账号只能创建市级代理", "error");
      return;
    }
    if (myRole === "CITY_ADMIN") {
      showToast("市级账号无创建代理权限", "error");
      return;
    }
    const citiesStr = window.prompt("管辖城市（多个用 / 或 , 或空格分隔；省级账号可留空）", "");
    const managedCities = citiesStr ? citiesStr.split(/[,\/，、\s]+/).map((s) => s.trim()).filter(Boolean) : [];
    if (adminRole === "CITY_ADMIN" && managedCities.length === 0) {
      showToast("市级代理至少指定 1 个城市", "error");
      return;
    }
    const btn = event.currentTarget as HTMLButtonElement;
    return withLoading(btn, async () => {
      try {
        await api("/api/admin/agents", {
          method: "POST",
          bodyJson: { name: name.trim(), phone: phone.trim(), adminRole, managedCities }
        });
        showToast("代理账号已创建", "success");
        await loadAgents();
        renderApp();
      } catch (error: any) {
        showToast(error.message, "error");
      }
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-agent-detail]").forEach((btn) => {
    btn.onclick = () => loadAgentDetail(btn.dataset.agentDetail!);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-dispatch-detail]").forEach((btn) => {
    btn.onclick = () => {
      const task = state.dispatch?.taskDispatches.find((item) => item.id === btn.dataset.dispatchDetail);
      if (!task) return;
      state.dispatchDetail = { title: task.title, recipients: task.recipients };
      renderApp();
    };
  });
  document.querySelectorAll<HTMLElement>("[data-close-dispatch-detail]").forEach((element) => {
    element.onclick = () => {
      state.dispatchDetail = undefined;
      renderApp();
    };
  });
  document.querySelector<HTMLButtonElement>("[data-agent-back]")?.addEventListener("click", () => {
    state.agentDetail = undefined;
    renderApp();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-agent-edit]").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.agentEdit!;
      const agent = (state.agents ?? []).find((a) => a.id === id);
      if (!agent) return;
      const newName = window.prompt("修改账号名称", agent.name);
      if (!newName || !newName.trim() || newName.trim() === agent.name) return;
      const newPhone = window.prompt("修改手机号（11 位）", agent.phone);
      if (!newPhone || !/^1\d{10}$/.test(newPhone)) {
        showToast("手机号格式不正确", "error");
        return;
      }
      const newStatus = window.prompt("账号状态（ACTIVE / DISABLED）", agent.status);
      const status = newStatus === "DISABLED" ? "DISABLED" : "ACTIVE";
      try {
        await api(`/api/admin/agents/${encodeURIComponent(id)}`, {
          method: "PATCH",
          bodyJson: { name: newName.trim(), phone: newPhone.trim(), status }
        });
        showToast("已更新", "success");
        await loadAgents();
        if (state.agentDetail?.agent.id === id) await loadAgentDetail(id);
        renderApp();
      } catch (error: any) {
        showToast(error.message, "error");
      }
    };
  });
  document.querySelectorAll<HTMLButtonElement>("[data-agent-delete]").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.agentDelete!;
      const agent = (state.agents ?? []).find((a) => a.id === id);
      if (!agent) return;
      const ok = await confirmDialog({
        title: "停用代理账号",
        message: `确定要停用「${agent.name}」吗？账号将被禁用，登录被拒绝，下辖终端归属关系保留，统计不再汇总。`,
        okText: "确定停用",
        danger: true
      });
      if (!ok) return;
      try {
        await api(`/api/admin/agents/${encodeURIComponent(id)}`, { method: "PATCH", bodyJson: { status: "DISABLED" } });
        showToast("代理商已删除", "success");
        if (state.agentDetail?.agent.id === id) state.agentDetail = undefined;
        await loadAgents();
        renderApp();
      } catch (error: any) {
        showToast(error.message, "error");
      }
    };
  });
  document.querySelectorAll<HTMLButtonElement>("[data-account-tab]").forEach((button) => {
    button.onclick = () => {
      state.accountTab = button.dataset.accountTab as "platform" | "province" | "city" | "clinic";
      state.query = "";
      renderApp();
    };
  });
  document.querySelectorAll<HTMLButtonElement>("[data-refresh-login-history]").forEach((button) => {
    button.onclick = () => withLoading(button, async () => {
      await loadLoginHistory();
      renderApp();
    });
  });
  document.querySelectorAll<HTMLSelectElement>("#reportsCityFilter").forEach((select) => {
    select.onchange = async () => {
      state.reportsCityFilter = select.value;
      await loadReports();
      renderApp();
    };
  });
  document.querySelectorAll<HTMLInputElement>("#reportsFrom").forEach((input) => {
    input.onchange = async () => {
      state.reportsFrom = input.value;
      await loadReports();
      renderApp();
    };
  });
  document.querySelectorAll<HTMLInputElement>("#reportsTo").forEach((input) => {
    input.onchange = async () => {
      state.reportsTo = input.value;
      await loadReports();
      renderApp();
    };
  });
  document.querySelectorAll<HTMLButtonElement>("[data-reports-preset]").forEach((button) => {
    button.onclick = async () => {
      const preset = button.dataset.reportsPreset;
      if (preset === "all") {
        state.reportsFrom = "";
        state.reportsTo = "";
      } else {
        const days = Number(preset);
        if (Number.isFinite(days) && days > 0) {
          const to = new Date();
          const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
          state.reportsTo = to.toISOString().slice(0, 10);
          state.reportsFrom = from.toISOString().slice(0, 10);
        }
      }
      await loadReports();
      renderApp();
    };
  });
  document.querySelectorAll<HTMLButtonElement>("[data-reports-risk]").forEach((button) => {
    button.onclick = () => {
      state.reportsRiskFilter = button.dataset.reportsRisk as typeof state.reportsRiskFilter;
      renderApp();
    };
  });
  document.querySelector<HTMLInputElement>("#reportsQuery")?.addEventListener("change", (event) => {
    state.reportsQuery = (event.currentTarget as HTMLInputElement).value;
    renderApp();
  });
  document.querySelector<HTMLInputElement>("#reportsQuery")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    state.reportsQuery = (event.currentTarget as HTMLInputElement).value;
    renderApp();
  });
  document.querySelector<HTMLSelectElement>("#reportsSort")?.addEventListener("change", (event) => {
    state.reportsSort = (event.currentTarget as HTMLSelectElement).value as typeof state.reportsSort;
    renderApp();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-create]").forEach((button) => {
    button.onclick = () => {
      state.drawer = { resource: button.dataset.create as ResourceKey, mode: "create" };
      renderApp();
    };
  });
  document.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach((button) => {
    button.onclick = () => {
      const resource = button.dataset.edit as ResourceKey;
      const item = (state.resources[resource] ?? []).find((row) => row.id === button.dataset.id);
      state.drawer = { resource, mode: "edit", item };
      renderApp();
    };
  });
  document.querySelectorAll<HTMLButtonElement>("[data-delete]").forEach((button) => {
    if (button.disabled) return;
    button.onclick = () => deleteResource(button.dataset.delete as ResourceKey, button.dataset.id!);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach((button) => {
    if (button.disabled) return;
  });
  document.querySelectorAll<HTMLButtonElement>("[data-promote]").forEach((button) => {
    button.onclick = () => withLoading(button, async () => {
      const resource = button.dataset.promote as ResourceKey;
      const id = button.dataset.id!;
      const item = (state.resources[resource] ?? []).find((row: any) => row.id === id);
      if (!item) return;
      const ok = await confirmDialog({
        title: "提升为全国推送",
        message: `确定将「${item.title}」提升为全国推送吗？省级和地市将只能只读浏览。`
      });
      if (!ok) return;
      try {
        await api(configs[resource].endpoint, {
          method: "PATCH",
          bodyJson: { id, scopeLevel: "NATIONAL", scopeProvince: null, scopeCity: null }
        });
        showToast("已提升为全国推送", "success");
        await loadResource(resource);
      } catch (err: any) {
        showToast(err?.message ?? "提升失败", "error");
      } finally {
        renderApp();
      }
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-reset-password]").forEach((button) => {
    button.onclick = () => withLoading(button, async () => {
      const name = button.dataset.name ?? "该账号";
      const phone = button.dataset.phone ?? "";
      const input = window.prompt(`为「${name} (${phone})」设置新密码（留空则自动生成 8 位随机密码）`, "");
      if (input === null) return; // 取消
      const result = await api<{ password?: string; error?: string }>("/api/admin/users/reset-password", {
        method: "POST",
        bodyJson: { id: button.dataset.id, password: input.trim() || undefined }
      });
      if (result.error) { alert("重置失败：" + result.error); return; }
      // 显示新密码，方便管理员复制给用户
      window.prompt("✅ 密码已重置，旧 session 已失效，请复制给用户：", result.password ?? "");
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-kick-user]").forEach((button) => {
    button.onclick = () => withLoading(button, async () => {
      const name = button.dataset.name ?? "该账号";
      const ok = await confirmDialog({
        title: "踢下线",
        message: `确定踢「${name}」下线吗？该账号将被强制登出，需要重新登录。`
      });
      if (!ok) return;
      const result = await api<{ sessionsKicked?: number; error?: string }>("/api/admin/users/kick", {
        method: "POST",
        bodyJson: { id: button.dataset.id }
      });
      if (result.error) { showToast("踢下线失败：" + result.error, "error"); return; }
      showToast(`已踢「${name}」下线，清理 ${result.sessionsKicked ?? 0} 个 session`, "success");
    });
  });

  // 批量操作：用户选择 / 启停 / 授权
  document.querySelectorAll<HTMLInputElement>("[data-select-user]").forEach((input) => {
    input.onchange = () => {
      const id = input.dataset.id!;
      if (input.checked) {
        if (!state.selectedUserIds.includes(id)) state.selectedUserIds = [...state.selectedUserIds, id];
      } else {
        state.selectedUserIds = state.selectedUserIds.filter((x) => x !== id);
      }
      renderApp();
    };
  });
  document.querySelector<HTMLInputElement>("[data-select-all-users]")?.addEventListener("change", (event) => {
    const checked = (event.currentTarget as HTMLInputElement).checked;
    const visibleIds = filteredRows("users").map((u: any) => u.id);
    if (checked) {
      const set = new Set([...state.selectedUserIds, ...visibleIds]);
      state.selectedUserIds = Array.from(set);
    } else {
      state.selectedUserIds = state.selectedUserIds.filter((id) => !visibleIds.includes(id));
    }
    renderApp();
  });
  document.querySelectorAll<HTMLInputElement>("[data-select-resource]").forEach((input) => {
    input.onchange = () => {
      const resource = input.dataset.selectResource as ResourceKey;
      const id = input.dataset.id!;
      const selected = state.selectedResourceIds[resource] ?? [];
      state.selectedResourceIds[resource] = input.checked
        ? Array.from(new Set([...selected, id]))
        : selected.filter((value) => value !== id);
      renderApp();
    };
  });
  document.querySelectorAll<HTMLInputElement>("[data-select-all-resource]").forEach((input) => {
    input.onchange = () => {
      const resource = input.dataset.selectAllResource as ResourceKey;
      const isScopedResource = ["kits", "templates", "articles", "marketingPosts"].includes(resource);
      const visibleIds = filteredRows(resource)
        .filter((item: any) => !isScopedResource || canEditContentFrontend(item))
        .map((item: any) => item.id);
      const selected = state.selectedResourceIds[resource] ?? [];
      state.selectedResourceIds[resource] = input.checked
        ? Array.from(new Set([...selected, ...visibleIds]))
        : selected.filter((id) => !visibleIds.includes(id));
      renderApp();
    };
  });
  document.querySelectorAll<HTMLButtonElement>("[data-batch-clear-resource]").forEach((button) => {
    button.onclick = () => {
      state.selectedResourceIds[button.dataset.batchClearResource as ResourceKey] = [];
      renderApp();
    };
  });
  document.querySelectorAll<HTMLButtonElement>("[data-batch-delete-resource]").forEach((button) => {
    button.onclick = () => {
      const resource = button.dataset.batchDeleteResource as ResourceKey;
      return withLoading(button, () => batchDeleteResources(resource, state.selectedResourceIds[resource] ?? []));
    };
  });
  document.querySelectorAll<HTMLButtonElement>("[data-batch-delete-users]").forEach((button) => {
    button.onclick = () => withLoading(button, () => batchDeleteResources("users", state.selectedUserIds));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-batch-clear]").forEach((button) => {
    button.onclick = () => {
      state.selectedUserIds = [];
      state.batchMenuOpen = false;
      renderApp();
    };
  });
  document.querySelectorAll<HTMLButtonElement>("[data-batch-status]").forEach((button) => {
    button.onclick = () => withLoading(button, async () => {
      const status = button.dataset.batchStatus as "ACTIVE" | "DISABLED";
      const ids = state.selectedUserIds;
      if (!ids.length) return;
      const ok = await confirmDialog({
        title: status === "ACTIVE" ? "批量启用" : "批量停用",
        message: `确定要${status === "ACTIVE" ? "启用" : "停用"}选中的 ${ids.length} 个账号吗？${status === "DISABLED" ? "停用后会立即踢下线。" : ""}`
      });
      if (!ok) return;
      const result = await api<{ updated: number; kickedSessions: number; skipped: any[]; error?: string }>("/api/admin/users/batch", {
        method: "POST",
        bodyJson: { action: "status", ids, status }
      });
      if (result.error) { showToast("操作失败：" + result.error, "error"); return; }
      const skipMsg = result.skipped?.length ? `，跳过 ${result.skipped.length} 个` : "";
      showToast(`${status === "ACTIVE" ? "启用" : "停用"} ${result.updated} 个账号${skipMsg}，清理 ${result.kickedSessions} 个 session`, "success");
      state.selectedUserIds = [];
      state.batchMenuOpen = false;
      await loadResource("users");
      renderApp();
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-batch-permissions]").forEach((button) => {
    button.onclick = () => {
      state.batchMenuOpen = true;
      renderApp();
    };
  });
  document.querySelector<HTMLButtonElement>("#confirmBatchPermissionsBtn")?.addEventListener("click", async (event) => {
    const btn = event.currentTarget as HTMLButtonElement;
    await withLoading(btn, async () => {
      const ids = state.selectedUserIds;
      if (!ids.length) return;
      const menuPermissions = Array.from(document.querySelectorAll<HTMLInputElement>("[data-batch-menu]:checked")).map((el) => el.value);
      const result = await api<{ updated: number; skipped: any[]; error?: string }>("/api/admin/users/batch", {
        method: "POST",
        bodyJson: { action: "permissions", ids, menuPermissions }
      });
      const resultEl = document.querySelector<HTMLElement>("#batchPermissionsResult");
      if (result.error) {
        if (resultEl) resultEl.textContent = "失败：" + result.error;
        return;
      }
      if (resultEl) resultEl.textContent = `已更新 ${result.updated} 个账号的菜单权限${result.skipped?.length ? `，跳过 ${result.skipped.length} 个` : ""}`;
      showToast(`已批量授权 ${result.updated} 个账号`, "success");
      state.selectedUserIds = [];
      state.batchMenuOpen = false;
      await loadResource("users");
      renderApp();
    });
  });
  document.querySelector<HTMLButtonElement>("#cancelBatchPermissionsBtn")?.addEventListener("click", () => {
    state.batchMenuOpen = false;
    renderApp();
  });
  document.querySelector<HTMLButtonElement>("#closeDrawer")?.addEventListener("click", () => {
    state.drawer = undefined;
    renderApp();
  });
  document.querySelector<HTMLButtonElement>("#cancelDrawer")?.addEventListener("click", () => {
    state.drawer = undefined;
    renderApp();
  });
  bindAiPanel(
    "aiArticleAdminPanel",
    "resourceForm",
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
    "aiMarketingAdminPanel",
    "resourceForm",
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
      const form = document.querySelector<HTMLFormElement>("#resourceForm");
      const type = (form?.querySelector<HTMLSelectElement>('[name="type"]')?.value ?? "PROMOTION") as "ANNOUNCEMENT" | "PROMOTION" | "ACTIVITY";
      const res = await generateMarketingPostCopy({ prompt, type });
      return res.copy as Record<string, string | undefined>;
    }
  );
  document.querySelector<HTMLFormElement>("#resourceForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    return withFormLoading(form, () => saveResource(form).catch((error: any) => {
      state.error = error.message;
      renderApp();
    }));
  });
  const taskModeSelect = document.querySelector<HTMLSelectElement>('#resourceForm [name="mode"]');
  const taskClinicField = document.querySelector<HTMLElement>('#resourceForm [data-field-name="clinicId"]');
  const taskClinicSelect = taskClinicField?.querySelector<HTMLSelectElement>('select[name="clinicId"]');
  const syncTaskClinicField = () => {
    if (!taskModeSelect || !taskClinicField || !taskClinicSelect || state.drawer?.resource !== "tasks") return;
    const needsClinic = taskModeSelect.value === "one";
    taskClinicField.hidden = !needsClinic;
    taskClinicSelect.disabled = !needsClinic;
    taskClinicSelect.required = needsClinic;
    taskClinicField.classList.toggle("is-required", needsClinic);
  };
  taskModeSelect?.addEventListener("change", syncTaskClinicField);
  syncTaskClinicField();
  document.querySelector<HTMLInputElement>("#queryInput")?.addEventListener("input", (event) => {
    state.query = (event.currentTarget as HTMLInputElement).value;
    renderApp();
  });
  document.querySelector<HTMLSelectElement>("#clinicFilter")?.addEventListener("change", (event) => {
    state.clinicFilter = (event.currentTarget as HTMLSelectElement).value;
    renderApp();
  });
  document.querySelector<HTMLSelectElement>("#statusFilter")?.addEventListener("change", (event) => {
    state.statusFilter = (event.currentTarget as HTMLSelectElement).value;
    renderApp();
  });
  document.querySelector<HTMLButtonElement>("#clearFilters")?.addEventListener("click", () => {
    state.query = "";
    state.clinicFilter = "";
    state.statusFilter = "";
    state.clinicCityFilter = "";
    renderApp();
  });

  // 诊所城市过滤
  document.querySelector<HTMLSelectElement>("#clinicCityFilter")?.addEventListener("change", (event) => {
    state.clinicCityFilter = (event.currentTarget as HTMLSelectElement).value;
    renderApp();
  });

  // 省市区级联：当 province 变时更新 city 选项
  document.querySelector<HTMLSelectElement>("[data-cascade-province]")?.addEventListener("change", (event) => {
    const prov = (event.currentTarget as HTMLSelectElement).value;
    const citySelect = document.querySelector<HTMLSelectElement>("[data-cascade-city]");
    const districtSelect = document.querySelector<HTMLSelectElement>("[data-cascade-district]");
    if (citySelect) {
      const cities = getCitiesByProvince(prov);
      citySelect.innerHTML = `<option value="">请选择城市</option>${cities.map((c) => `<option value="${html(c)}">${html(c)}</option>`).join("")}`;
    }
    if (districtSelect) districtSelect.innerHTML = `<option value="">请选择区县</option>`;
  });

  // 市区联动：当 city 变时更新 district
  document.querySelector<HTMLSelectElement>("[data-cascade-city]")?.addEventListener("change", (event) => {
    const city = (event.currentTarget as HTMLSelectElement).value;
    const districtSelect = document.querySelector<HTMLSelectElement>("[data-cascade-district]");
    if (districtSelect) {
      const districts = getDistrictsByCity(city);
      districtSelect.innerHTML = `<option value="">请选择区县</option>${districts.map((d) => `<option value="${html(d)}">${html(d)}</option>`).join("")}`;
    }
  });

  // 诊所详情
  document.querySelectorAll<HTMLElement>("[data-clinic-detail]").forEach((el) => {
    el.onclick = async () => {
      const id = el.dataset.clinicDetail!;
      state.clinicDetailId = id;
      await withLoading(el as any, async () => {
        await loadClinicDetail(id);
        renderApp();
      });
    };
  });
  document.querySelector<HTMLButtonElement>("[data-back-to-clinics]")?.addEventListener("click", () => {
    state.clinicDetail = undefined;
    state.clinicDetailId = undefined;
    renderApp();
  });

  // Import panel toggle
  document.querySelector<HTMLButtonElement>("#importBtn")?.addEventListener("click", () => {
    const panel = document.querySelector<HTMLElement>("#importPanel");
    if (panel) panel.style.display = panel.style.display === "none" ? "block" : "none";
  });

  // Download template
  document.querySelector<HTMLButtonElement>("#downloadTemplateBtn")?.addEventListener("click", (event) => {
    const btn = event.currentTarget as HTMLButtonElement;
    return withLoading(btn, async () => {
      const config = configs[state.active as ResourceKey];
      if (!config?.importEndpoint) return;
      const resp = await fetch(config.importEndpoint + "/template", { headers: { cookie: document.cookie } });
      // 直接用 arrayBuffer 取原始字节，避免 resp.text() → Blob 链路在某些浏览器上丢 BOM
      const buf = await resp.arrayBuffer();
      const blob = new Blob([buf], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${config.key}-import.csv`; a.click();
      URL.revokeObjectURL(url);
    });
  });

  // Store imported file content
  let importCsvContent = "";
  document.querySelector<HTMLInputElement>("#importFileInput")?.addEventListener("change", async (event) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    importCsvContent = await file.text();
  });

  // Parse & preview
  let pendingToken = "";
  document.querySelector<HTMLButtonElement>("#doImportBtn")?.addEventListener("click", (event) => {
    const btn = event.currentTarget as HTMLButtonElement;
    return withLoading(btn, async () => {
      const config = configs[state.active as ResourceKey];
      if (!config?.importEndpoint || !importCsvContent) { alert("请先选择 CSV 文件"); return; }
      const encoded = btoa(unescape(encodeURIComponent(importCsvContent)));
      const result = await api(config.importEndpoint!, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: encoded })
      }) as { token?: string; valid?: number; conflicts?: any[]; errors?: any[]; rows?: any[] };
      pendingToken = result.token ?? "";
      const preview = document.querySelector<HTMLDivElement>("#importPreview")!;
      const resultDiv = document.querySelector<HTMLDivElement>("#importResult")!;
      resultDiv.innerHTML = `<p class="muted">解析完成：有效 ${result.valid} 行，冲突 ${result.conflicts?.length ?? 0} 行，错误 ${result.errors?.length ?? 0} 行。</p>`;
      if (result.rows?.length) {
        const headers = Object.keys(result.rows[0].data);
        preview.innerHTML = `<table><thead><tr>${["行号", ...headers].map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${result.rows.map((row: any) => `<tr>${[row.idx, ...headers.map((h: string) => `<td>${row.data[h] ?? ""}</td>`)].join("")}</tr>`).join("")}</tbody></table>`;
        preview.style.display = "block";
        if (result.valid && result.valid > 0) resultDiv.innerHTML += `<button id="confirmImportBtn" class="primary" type="button">确认导入 ${result.valid} 条</button>`;
        document.querySelector<HTMLButtonElement>("#confirmImportBtn")?.addEventListener("click", (event2) => {
          const cbtn = event2.currentTarget as HTMLButtonElement;
          return withLoading(cbtn, async () => {
            const r2 = await api(config.importEndpoint!, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: pendingToken }) }) as { created?: number; skipped?: number; errors?: any[] };
            resultDiv.innerHTML = `<p class="muted">导入完成：新增 ${r2.created ?? 0} 条，跳过 ${r2.skipped ?? 0} 条${r2.errors?.length ? `，失败 ${r2.errors.length} 行` : ""}。</p>`;
            preview.style.display = "none";
            await loadAll(); renderApp();
          });
        });
      }
    });
  });

  // --- 门店医生批量导入（users.clinic） ---

  document.querySelector<HTMLButtonElement>("#importClinicBtn")?.addEventListener("click", () => {
    const panel = document.querySelector<HTMLElement>("#importClinicPanel");
    if (panel) panel.style.display = panel.style.display === "none" ? "block" : "none";
  });

  document.querySelector<HTMLButtonElement>("#downloadClinicTemplateBtn")?.addEventListener("click", (event) => {
    const btn = event.currentTarget as HTMLButtonElement;
    return withLoading(btn, async () => {
      const config = configs[state.active as ResourceKey];
      if (!config?.importClinicEndpoint) return;
      const resp = await fetch(config.importClinicEndpoint, { headers: { cookie: document.cookie } });
      const text = await resp.text();
      const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "clinic-user-import.csv"; a.click();
      URL.revokeObjectURL(url);
    });
  });

  let importClinicCsvContent = "";
  let pendingClinicToken = "";

  document.querySelector<HTMLInputElement>("#importClinicFileInput")?.addEventListener("change", async (event) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    importClinicCsvContent = await file.text();
  });

  document.querySelector<HTMLButtonElement>("#doImportClinicBtn")?.addEventListener("click", (event) => {
    const btn = event.currentTarget as HTMLButtonElement;
    return withLoading(btn, async () => {
      const config = configs[state.active as ResourceKey];
      if (!config?.importClinicEndpoint || !importClinicCsvContent) { alert("请先选择 CSV 文件"); return; }
      const encoded = btoa(unescape(encodeURIComponent(importClinicCsvContent)));
      const result = await api(config.importClinicEndpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: encoded })
      }) as { token?: string; valid?: number; conflicts?: any[]; errors?: any[]; rows?: any[] };
      pendingClinicToken = result.token ?? "";
      const preview = document.querySelector<HTMLDivElement>("#importClinicPreview")!;
      const resultDiv = document.querySelector<HTMLDivElement>("#importClinicResult")!;
      resultDiv.innerHTML = `<p class="muted">解析完成：有效 ${result.valid} 行，冲突 ${result.conflicts?.length ?? 0} 行，错误 ${result.errors?.length ?? 0} 行。</p>`;
      if (result.errors?.length) {
        resultDiv.innerHTML += `<div class="muted">${result.errors.map((e: any) => `<p>❌ ${e.message}</p>`).join("")}</div>`;
      }
      if (result.conflicts?.length) {
        resultDiv.innerHTML += `<div class="muted">${result.conflicts.map((c: any) => `<p>⚠️ ${c.reason}</p>`).join("")}</div>`;
      }
      if (result.rows?.length) {
        const headers = Object.keys(result.rows[0].data);
        preview.innerHTML = `<table><thead><tr>${["行号", ...headers].map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${result.rows.map((row: any) => `<tr>${[row.idx, ...headers.map((h: string) => `<td>${row.data[h] ?? ""}</td>`)].join("")}</tr>`).join("")}</tbody></table>`;
        preview.style.display = "block";
        if (result.valid && result.valid > 0) resultDiv.innerHTML += `<button id="confirmClinicImportBtn" class="primary" type="button">确认导入 ${result.valid} 条</button>`;
        document.querySelector<HTMLButtonElement>("#confirmClinicImportBtn")?.addEventListener("click", (event2) => {
          const cbtn = event2.currentTarget as HTMLButtonElement;
          return withLoading(cbtn, async () => {
            const r2 = await api(config.importClinicEndpoint!, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: pendingClinicToken }) }) as { created?: number; skipped?: number; errors?: any[] };
            resultDiv.innerHTML = `<p class="muted">导入完成：新增 ${r2.created ?? 0} 条，跳过 ${r2.skipped ?? 0} 条${r2.errors?.length ? `，失败 ${r2.errors.length} 行` : ""}。</p>`;
            preview.style.display = "none";
            await loadAll(); renderApp();
          });
        });
      }
    });
  });

  // Dispatch modal - open with template selector
  document.querySelector<HTMLButtonElement>("#dispatchBtn")?.addEventListener("click", () => {
    const config = configs[state.active as ResourceKey];
    if (!config?.dispatchEndpoint) return;
    const modal = document.querySelector<HTMLElement>("#dispatchModal")!;
    modal.style.display = "block";
  });

  // Dispatch mode toggle: show/hide clinic selector
  document.querySelector<HTMLSelectElement>("#dispatchMode")?.addEventListener("change", (e) => {
    const mode = (e.currentTarget as HTMLSelectElement).value;
    const clinicSel = document.querySelector<HTMLSelectElement>("#dispatchClinic")!;
    clinicSel.style.display = mode === "one" ? "inline-block" : "none";
  });

  // Confirm dispatch
  document.querySelector<HTMLButtonElement>("#confirmDispatchBtn")?.addEventListener("click", (event) => {
    const btn = event.currentTarget as HTMLButtonElement;
    return withLoading(btn, async () => {
      const config = configs[state.active as ResourceKey];
      if (!config?.dispatchEndpoint) return;
      const templateId = (document.querySelector<HTMLSelectElement>("#dispatchTemplateSelect") as HTMLSelectElement).value;
      if (!templateId) { alert("请先选择一个模板"); return; }
      const mode = (document.querySelector<HTMLSelectElement>("#dispatchMode") as HTMLSelectElement).value as "all" | "one";
      const clinicId = mode === "one" ? (document.querySelector<HTMLSelectElement>("#dispatchClinic") as HTMLSelectElement).value : undefined;
      const resultDiv = document.querySelector<HTMLDivElement>("#dispatchResult")!;
      const result = await api(config.dispatchEndpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, mode, clinicId })
      }) as { campaigns?: any[]; task?: any; progress?: any[]; marketingPosts?: any[]; error?: string };
      if (result.error) { resultDiv.innerHTML = `<span class="error">下发失败：${result.error}</span>`; return; }
      const count = Array.isArray(result.campaigns) ? result.campaigns.length
        : Array.isArray(result.progress) ? result.progress.length
        : Array.isArray(result.marketingPosts) ? result.marketingPosts.length
        : 0;
      const what = result.task ? "任务" : Array.isArray(result.marketingPosts) ? "营销稿" : "活动";
      resultDiv.innerHTML = `<span class="green">下发成功！已为 ${count} 家诊所创建${what}。</span>`;
      setTimeout(() => {
        const modal = document.querySelector<HTMLElement>("#dispatchModal")!;
        modal.style.display = "none";
        resultDiv.innerHTML = "";
      }, 2000);
    });
  });

  // Cancel dispatch
  document.querySelector<HTMLButtonElement>("#cancelDispatchBtn")?.addEventListener("click", () => {
    const modal = document.querySelector<HTMLElement>("#dispatchModal")!;
    modal.style.display = "none";
  });
}

function realtimeRenderAllowed() {
  const tag = (document.activeElement?.tagName ?? "").toLowerCase();
  return !["input", "textarea", "select"].includes(tag) && !state.drawer && !state.activeNotification;
}

async function refreshAdminRealtime() {
  if (!state.data || document.hidden || !realtimeRenderAllowed()) return;
  try {
    const data = await api<{ messages: any[]; unread: number }>("/api/admin/messages?limit=30");
    const before = `${state.unread}:${state.notifications[0]?.id ?? ""}`;
    const after = `${data.unread}:${data.messages[0]?.id ?? ""}`;
    if (before === after) return;
    state.notifications = data.messages;
    state.unread = data.unread;
    if (state.active === "notifications") state.notifHistory = data.messages.slice(0, 20);
    renderApp();
  } catch {
    // Realtime refresh is best-effort; normal actions still surface errors.
  }
}

loadAll().then(() => {
  renderApp();
  window.setInterval(refreshAdminRealtime, 5000);
}).catch(() => renderLogin());
