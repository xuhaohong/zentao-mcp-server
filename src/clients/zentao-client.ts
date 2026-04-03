import { AuthError, ZenTaoApiError, formatUnknownError } from "../utils/errors.js";
import type { ZenTaoConfig } from "../types/config.js";
import type {
  CreateChildTaskInput,
  CreateTaskInput,
  ZenTaoApiEnvelope,
  ZenTaoBug,
  ZenTaoExecution,
  ZenTaoProduct,
  ZenTaoProject,
  ZenTaoStory,
  ZenTaoTask,
  ZenTaoUser
} from "../types/zentao.js";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  version?: "v1" | "v2";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  skipAuth?: boolean;
}

function getErrorMessage(payload: unknown): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const message = record.message ?? record.msg ?? record.error;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }
  return "禅道返回了未知错误";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFailurePayload(payload: unknown): payload is ZenTaoApiEnvelope {
  if (!isRecord(payload)) return false;
  const status = payload.status;
  return status === "fail" || status === "error" || status === 0;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asPositiveNumber(value: unknown): number | undefined {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

function getBaseWebUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "").replace(/\/api\.php.*$/, "").replace(/\/[^/]*\.html$/, "");
}

function getCookieHeader(setCookies: string[]): string {
  const cookieMap = new Map<string, string>();

  for (const cookie of setCookies) {
    if (cookie.includes("Max-Age=0")) continue;
    const pair = cookie.split(";", 1)[0];
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    cookieMap.set(pair.substring(0, idx), pair.substring(idx + 1));
  }

  return [...cookieMap.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

export class ZenTaoClient {
  private cachedToken?: string;

  public constructor(private readonly config: ZenTaoConfig) {}

  public async ping(): Promise<{ ok: true; user: ZenTaoUser }> {
    const user = await this.getCurrentUser();
    return { ok: true, user };
  }

  public async getCurrentUser(): Promise<ZenTaoUser> {
    const payload = await this.requestFirstSuccessful<ZenTaoApiEnvelope>(
      [
        { method: "GET", version: "v2", path: "/users/me" },
        { method: "GET", version: "v1", path: "/user" }
      ],
      (c) => isRecord(c) && isRecord(c.user ?? c.profile ?? (c.id !== undefined ? c : null)),
      "获取当前用户信息失败"
    );

    if (isRecord(payload)) {
      const item = isRecord(payload.user) ? payload.user : isRecord(payload.profile) ? payload.profile : payload;
      return item as ZenTaoUser;
    }

    if (this.config.account) {
      const users = await this.listUsers();
      const matched = users.find((u) => u.account === this.config.account);
      if (matched) return matched;
    }

    throw new ZenTaoApiError("无法解析当前用户信息");
  }

  public async listUsers(): Promise<ZenTaoUser[]> {
    const payload = await this.requestFirstSuccessful<ZenTaoApiEnvelope>(
      [
        { method: "GET", version: "v2", path: "/users" },
        { method: "GET", version: "v1", path: "/users" }
      ],
      (c) => isRecord(c) && Array.isArray(c.users),
      "获取用户列表失败"
    );
    return asArray<ZenTaoUser>(isRecord(payload) ? payload.users : undefined);
  }

  public async listProducts(): Promise<ZenTaoProduct[]> {
    const payload = await this.requestFirstSuccessful<ZenTaoApiEnvelope>(
      [
        { method: "GET", version: "v2", path: "/products" },
        { method: "GET", version: "v1", path: "/products" }
      ],
      (c) => isRecord(c) && Array.isArray(c.products),
      "获取产品列表失败"
    );
    return asArray<ZenTaoProduct>(isRecord(payload) ? payload.products : undefined);
  }

  public async listProjects(): Promise<ZenTaoProject[]> {
    const payload = await this.requestFirstSuccessful<ZenTaoApiEnvelope>(
      [
        { method: "GET", version: "v2", path: "/projects" },
        { method: "GET", version: "v1", path: "/projects" }
      ],
      (c) => isRecord(c) && Array.isArray(c.projects),
      "获取项目列表失败"
    );
    return asArray<ZenTaoProject>(isRecord(payload) ? payload.projects : undefined);
  }

  public async listStories(productId: number): Promise<ZenTaoStory[]> {
    const payload = await this.requestFirstSuccessful<ZenTaoApiEnvelope>(
      [
        { method: "GET", version: "v2", path: `/products/${productId}/stories` },
        { method: "GET", version: "v1", path: `/products/${productId}/stories` }
      ],
      (c) => isRecord(c) && Array.isArray(c.stories),
      `获取产品 ${productId} 的需求列表失败`
    );
    return asArray<ZenTaoStory>(isRecord(payload) ? payload.stories : undefined);
  }

  public async listTasks(projectId: number, status?: string): Promise<ZenTaoTask[]> {
    const executions = await this.listProjectExecutions(projectId);
    if (executions.length === 0) {
      return [];
    }

    const tasksById = new Map<string, ZenTaoTask>();

    for (const execution of executions) {
      const executionId = asPositiveNumber(execution.id);
      if (!executionId) continue;

      let page = 1;
      const limit = 100;
      let loadedForExecution = 0;

      while (true) {
        const payload = await this.request<ZenTaoApiEnvelope>({
          method: "GET",
          version: "v1",
          path: `/executions/${executionId}/tasks`,
          query: { status: status ?? "all", page, limit }
        });

        const tasks = asArray<ZenTaoTask>(isRecord(payload) ? payload.tasks : undefined).filter((task) =>
          this.belongsToProject(task, projectId)
        );

        for (const task of tasks) {
          tasksById.set(String(task.id), task);
        }
        loadedForExecution += tasks.length;

        const total = isRecord(payload) ? Number(payload.total) : 0;
        if (!Number.isFinite(total) || loadedForExecution >= total || tasks.length < limit) break;
        page++;
      }
    }

    return [...tasksById.values()];
  }

  public async getTask(taskId: number): Promise<ZenTaoTask> {
    const payload = await this.requestFirstSuccessful<ZenTaoApiEnvelope>(
      [
        { method: "GET", version: "v2", path: `/tasks/${taskId}` },
        { method: "GET", version: "v1", path: `/tasks/${taskId}` }
      ],
      (c) => isRecord(c) && (isRecord(c.task) || c.id !== undefined),
      `获取任务 ${taskId} 详情失败`
    );

    if (isRecord(payload)) {
      return (isRecord(payload.task) ? payload.task : payload) as ZenTaoTask;
    }
    throw new ZenTaoApiError(`未获取到任务 ${taskId} 的详情`);
  }

  public async createTask(input: CreateTaskInput): Promise<ZenTaoTask> {
    const { project, ...body } = input;
    const executionId = await this.resolveExecutionId(project);
    const payload = await this.request<ZenTaoApiEnvelope>({
      method: "POST",
      version: "v1",
      path: `/executions/${executionId}/tasks`,
      body
    });

    const taskId = Number(isRecord(payload) ? payload.id ?? payload.taskID : undefined);
    if (Number.isFinite(taskId) && taskId > 0) return this.getTask(taskId);

    const item = isRecord(payload) ? payload.task : undefined;
    if (isRecord(item)) return item as ZenTaoTask;

    throw new ZenTaoApiError("创建任务成功，但响应中缺少任务详情", { details: payload });
  }

  public async createChildTask(input: CreateChildTaskInput): Promise<ZenTaoTask> {
    const { parent, story, type, ...rest } = input;
    const parentTask = await this.getTask(parent);
    const executionId = Number(parentTask.execution);

    if (!Number.isFinite(executionId) || executionId <= 0) {
      throw new ZenTaoApiError(`父任务 ${parent} 缺少可用 execution，无法创建子任务`, {
        details: { parentTaskId: parent, execution: parentTask.execution }
      });
    }

    const createBody: Record<string, unknown> = {
      ...rest,
      type: type ?? "devel"
    };

    if (story !== undefined) {
      createBody.story = story;
    }

    const payload = await this.request<ZenTaoApiEnvelope>({
      method: "POST",
      version: "v1",
      path: `/executions/${executionId}/tasks`,
      body: createBody
    });

    const taskId = Number(isRecord(payload) ? payload.id ?? payload.taskID : undefined);
    let createdTask: ZenTaoTask | undefined;

    if (Number.isFinite(taskId) && taskId > 0) {
      createdTask = await this.getTask(taskId);
    } else {
      const item = isRecord(payload) ? payload.task : undefined;
      if (isRecord(item)) {
        createdTask = item as ZenTaoTask;
      }
    }

    if (!createdTask) {
      throw new ZenTaoApiError("创建子任务成功，但响应中缺少任务详情", { details: payload });
    }

    const createdTaskId = Number(createdTask.id);
    if (!Number.isFinite(createdTaskId) || createdTaskId <= 0) {
      throw new ZenTaoApiError("创建子任务成功，但任务 ID 无效", { details: createdTask });
    }

    try {
      await this.legacySetParent(createdTaskId, parent, createdTask);
    } catch (error) {
      throw new ZenTaoApiError(
        `子任务已创建（ID: ${createdTaskId}），但设置父任务失败：${formatUnknownError(error)}`,
        {
          details: {
            taskId: createdTaskId,
            parentTaskId: parent,
            executionId
          }
        }
      );
    }

    return this.getTask(createdTaskId);
  }

  public async listBugs(productId: number, filters?: { assignedTo?: string; status?: string }): Promise<ZenTaoBug[]> {
    const payload = await this.request<ZenTaoApiEnvelope>({
      method: "GET",
      version: "v1",
      path: "/bugs",
      query: { product: productId, assignedTo: filters?.assignedTo, status: filters?.status }
    });
    return asArray<ZenTaoBug>(isRecord(payload) ? payload.bugs : undefined);
  }

  public async deleteTask(taskId: number): Promise<void> {
    await this.request<unknown>({
      method: "DELETE",
      version: "v1",
      path: `/tasks/${taskId}`
    });
  }

  public async addTaskComment(taskId: number, comment: string): Promise<unknown> {
    return this.legacyComment("task", taskId, comment);
  }

  public async addBugComment(bugId: number, comment: string): Promise<unknown> {
    return this.legacyComment("bug", bugId, comment);
  }

  // ── private ──

  private executionIdCache = new Map<number, number>();
  private projectExecutionsCache = new Map<number, ZenTaoExecution[]>();

  private async resolveExecutionId(projectId: number): Promise<number> {
    const executions = await this.listProjectExecutions(projectId);
    const candidates = executions.filter((execution) => this.getExecutionPriority(execution) < 90);
    if (candidates.length === 0) {
      throw new ZenTaoApiError(`项目 ${projectId} 没有可用执行，无法创建任务`);
    }

    const selected = [...candidates].sort((left, right) => {
      const priorityDiff = this.getExecutionPriority(left) - this.getExecutionPriority(right);
      if (priorityDiff !== 0) return priorityDiff;

      return (asPositiveNumber(left.id) ?? Number.MAX_SAFE_INTEGER) - (asPositiveNumber(right.id) ?? Number.MAX_SAFE_INTEGER);
    })[0];

    const executionId = asPositiveNumber(selected?.id);
    if (executionId) {
      return executionId;
    }

    throw new ZenTaoApiError(`项目 ${projectId} 没有可用执行，无法创建任务`);
  }

  private async listProjectExecutions(projectId: number): Promise<ZenTaoExecution[]> {
    const cached = this.projectExecutionsCache.get(projectId);
    if (cached) {
      return cached;
    }

    const allExecutions: ZenTaoExecution[] = [];
    let page = 1;
    const limit = 100;

    while (true) {
      const payload = await this.requestFirstSuccessful<ZenTaoApiEnvelope>(
        [
          {
            method: "GET",
            version: "v2",
            path: `/projects/${projectId}/executions`,
            query: { page, limit }
          },
          {
            method: "GET",
            version: "v1",
            path: `/projects/${projectId}/executions`,
            query: { page, limit }
          }
        ],
        (content) => isRecord(content) && Array.isArray(content.executions),
        `获取项目 ${projectId} 的执行列表失败`
      );

      const executions = asArray<ZenTaoExecution>(isRecord(payload) ? payload.executions : undefined).filter((execution) =>
        this.isUsableExecution(execution, projectId)
      );

      allExecutions.push(...executions);

      const total = isRecord(payload) ? Number(payload.total) : 0;
      if (!Number.isFinite(total) || allExecutions.length >= total || executions.length < limit) {
        break;
      }

      page++;
    }

    this.projectExecutionsCache.set(projectId, allExecutions);
    return allExecutions;
  }

  private belongsToProject(task: ZenTaoTask, projectId: number): boolean {
    const taskProjectId = asPositiveNumber(task.project);
    return !taskProjectId || taskProjectId === projectId;
  }

  private isUsableExecution(execution: ZenTaoExecution, projectId: number): boolean {
    const executionId = asPositiveNumber(execution.id);
    if (!executionId) {
      return false;
    }

    const executionProjectId = asPositiveNumber(execution.project);
    if (executionProjectId && executionProjectId !== projectId) {
      return false;
    }

    return !this.isMarkedDeleted(execution.deleted);
  }

  private isMarkedDeleted(value: unknown): boolean {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return value === 1;
    }

    if (typeof value === "string") {
      return value === "1" || value.toLowerCase() === "true";
    }

    return false;
  }

  private getExecutionPriority(execution: ZenTaoExecution): number {
    const status = typeof execution.status === "string" ? execution.status.toLowerCase() : "";
    switch (status) {
      case "doing":
        return 0;
      case "wait":
        return 10;
      case "normal":
        return 20;
      case "suspended":
        return 30;
      case "closed":
        return 90;
      default:
        return 40;
    }
  }

  private async legacySetParent(taskId: number, parentId: number, task: ZenTaoTask): Promise<void> {
    const base = getBaseWebUrl(this.config.baseUrl);
    const sessionCookie = await this.getSessionCookie();
    const editUrl = `${base}/task-edit-${taskId}.json`;

    const resolveAccount = (val: unknown): string => {
      if (typeof val === "string") return val;
      if (isRecord(val) && typeof val.account === "string") return val.account;
      return this.config.account ?? "";
    };

    const resolvePositiveNumber = (val: unknown): string | undefined => {
      const num = Number(val);
      return Number.isFinite(num) && num > 0 ? String(num) : undefined;
    };

    const body = new URLSearchParams({
      parent: String(parentId),
      name: String(task.name ?? ""),
      type: String(task.type ?? "devel"),
      assignedTo: resolveAccount(task.assignedTo),
      estStarted: String(task.estStarted ?? ""),
      deadline: String(task.deadline ?? ""),
      status: String(task.status ?? "wait"),
      pri: String(task.pri ?? 0),
      estimate: String(task.estimate ?? 0)
    });

    const moduleId = resolvePositiveNumber(task.module);
    if (moduleId) {
      body.set("module", moduleId);
    }

    const storyId = resolvePositiveNumber(task.story);
    if (storyId) {
      body.set("story", storyId);
    }

    const resp = await fetch(editUrl, {
      method: "POST",
      headers: {
        "Cookie": sessionCookie,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": `${base}/task-edit-${taskId}.html`
      },
      body: body.toString(),
      signal: AbortSignal.timeout(this.config.timeoutMs)
    });

    const rawText = await resp.text();
    if (!resp.ok) {
      throw new ZenTaoApiError(`设置父任务失败：HTTP ${resp.status} ${rawText}`);
    }

    let parsed: unknown;
    try { parsed = JSON.parse(rawText); } catch { /* ignore */ }
    if (isRecord(parsed) && parsed.result === "fail") {
      throw new ZenTaoApiError(`设置父任务失败：${getErrorMessage(parsed)}`);
    }
  }

  private async legacyComment(objectType: string, objectId: number, comment: string): Promise<unknown> {
    const base = getBaseWebUrl(this.config.baseUrl);
    const commentUrl = `${base}/action-comment-${objectType}-${objectId}`;
    const sessionCookie = await this.getSessionCookie();

    // GET 备注页面获取 uid
    const getResp = await fetch(`${commentUrl}.html`, {
      headers: { "Cookie": sessionCookie },
      signal: AbortSignal.timeout(this.config.timeoutMs)
    });
    const html = await getResp.text();
    const uidMatch = html.match(/name="uid"\s+value="([^"]*)"/);
    const uid = uidMatch?.[1] ?? "";

    // POST 提交备注（需要 AJAX 头 + session cookie + Referer）
    const body = new URLSearchParams({ comment: `<p>${comment}</p>`, uid });
    const postResp = await fetch(`${commentUrl}.json`, {
      method: "POST",
      headers: {
        "Cookie": sessionCookie,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": `${base}/${objectType}-view-${objectId}.html`
      },
      body: body.toString(),
      signal: AbortSignal.timeout(this.config.timeoutMs)
    });

    const rawText = await postResp.text();
    if (!postResp.ok) {
      throw new ZenTaoApiError(`添加备注失败：HTTP ${postResp.status} ${rawText}`);
    }

    // 检查是否包含登录超时提示
    if (rawText.includes("登录已超时") || rawText.includes("loginExpired")) {
      this.cachedSessionCookie = undefined;
      throw new ZenTaoApiError("添加备注失败：会话已过期，请重试");
    }

    return { status: "success" };
  }

  private cachedSessionCookie?: string;

  private async getSessionCookie(): Promise<string> {
    if (this.cachedSessionCookie) return this.cachedSessionCookie;

    if (!this.config.account || !this.config.password) {
      throw new AuthError("添加备注需要 account/password 配置");
    }

    const base = getBaseWebUrl(this.config.baseUrl);
    const loginUrl = `${base}/user-login.json`;

    // GET 登录页获取 session cookie 和 rand
    const getResp = await fetch(loginUrl, { signal: AbortSignal.timeout(this.config.timeoutMs) });
    const getCookieStr = getCookieHeader(getResp.headers.getSetCookie?.() ?? []);
    const getBody = await getResp.json() as { data?: string };
    const loginData = JSON.parse(getBody.data ?? "{}");
    const rand = String(loginData.rand ?? "");

    // 计算加密密码: md5(md5(password) + rand)
    const { createHash } = await import("crypto");
    const md5Pass = createHash("md5").update(this.config.password).digest("hex");
    const encrypted = createHash("md5").update(md5Pass + rand).digest("hex");

    // POST 登录
    const loginBody = new URLSearchParams({ account: this.config.account, password: encrypted, keepLogin: "on" });
    const postResp = await fetch(loginUrl, {
      method: "POST",
      headers: {
        "Cookie": getCookieStr,
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": `${base}/user-login.html`
      },
      body: loginBody.toString(),
      signal: AbortSignal.timeout(this.config.timeoutMs)
    });

    const postCookies = postResp.headers.getSetCookie?.() ?? [];
    this.cachedSessionCookie = getCookieHeader([getCookieStr, ...postCookies]);

    const respBody = await postResp.json() as { user?: unknown };
    if (!respBody.user) {
      this.cachedSessionCookie = undefined;
      throw new AuthError("禅道 session 登录失败");
    }

    return this.cachedSessionCookie;
  }

  private async getToken(): Promise<string> {
    if (this.cachedToken) return this.cachedToken;

    if (this.config.token) {
      this.cachedToken = this.config.token;
      return this.cachedToken;
    }

    if (!this.config.account || !this.config.password) {
      throw new AuthError("未配置 token，也未提供 account/password，无法登录禅道");
    }

    const payload = await this.requestFirstSuccessful<{ token?: string }>(
      [
        { method: "POST", version: "v2", path: "/users/login", body: { account: this.config.account, password: this.config.password }, skipAuth: true },
        { method: "POST", version: "v1", path: "/tokens", body: { account: this.config.account, password: this.config.password }, skipAuth: true }
      ],
      (c) => isRecord(c) && typeof c.token === "string" && c.token.length > 0,
      "禅道登录失败"
    );

    if (!payload.token) {
      throw new AuthError(`禅道登录成功响应中缺少 token：${getErrorMessage(payload)}`);
    }

    this.cachedToken = payload.token;
    return this.cachedToken;
  }

  private async requestFirstSuccessful<T>(
    candidates: RequestOptions[],
    validate: (payload: unknown) => boolean,
    errorMessage: string
  ): Promise<T> {
    const errors: string[] = [];

    for (const candidate of candidates) {
      try {
        const payload = await this.request<unknown>(candidate);
        if (validate(payload)) return payload as T;
        errors.push(`${candidate.version ?? "v2"} ${candidate.path} 返回结构不符合预期`);
      } catch (error) {
        errors.push(`${candidate.version ?? "v2"} ${candidate.path}: ${formatUnknownError(error)}`);
      }
    }

    throw new ZenTaoApiError(`${errorMessage}。已尝试：${errors.join(" | ")}`);
  }

  private async request<T>(options: RequestOptions, retried = false): Promise<T> {
    const url = new URL(`${this.config.baseUrl}/api.php/${options.version ?? "v2"}${options.path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null && String(value).length > 0) {
        url.searchParams.set(key, String(value));
      }
    }

    const headers = new Headers();
    headers.set("Accept", "application/json");
    if (options.body !== undefined) headers.set("Content-Type", "application/json");
    if (!options.skipAuth) headers.set("Token", await this.getToken());

    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method ?? "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(this.config.timeoutMs)
      });
    } catch (error) {
      throw new ZenTaoApiError(
        `请求禅道失败：${url.toString()}，超时或网络异常，请检查地址和网络连通性。原始错误：${formatUnknownError(error)}`
      );
    }

    const rawText = await response.text();
    let payload: unknown = rawText;
    if (rawText.length > 0) {
      try { payload = JSON.parse(rawText); } catch { /* non-JSON */ }
    }

    if (!response.ok) {
      if (response.status === 401 && !retried && !options.skipAuth && this.cachedToken) {
        this.cachedToken = undefined;
        return this.request<T>(options, true);
      }
      throw new ZenTaoApiError(`禅道请求失败：HTTP ${response.status} ${response.statusText}，${getErrorMessage(payload)}`, { details: payload });
    }

    if (isFailurePayload(payload)) {
      throw new ZenTaoApiError(`禅道接口返回失败：${getErrorMessage(payload)}`, { code: payload.code, status: payload.status, details: payload });
    }

    return payload as T;
  }
}
