export function textContent(text: string): Array<{ type: "text"; text: string }> {
  return [{ type: "text", text }];
}

export function buildItemSummary(entityName: string, item: { id?: number | string; name?: string; title?: string }): string {
  const label = item.name ?? item.title ?? item.id ?? "unknown";
  return `已获取 ${entityName}详情：${String(label)}。`;
}

function resolveRealname(val: unknown): string | undefined {
  if (!val) return undefined;
  if (typeof val === 'string') return val || undefined;
  if (typeof val === 'object' && val !== null) {
    const r = (val as Record<string, unknown>).realname;
    return typeof r === 'string' && r ? r : undefined;
  }
  return undefined;
}

function stripHtml(html: string, maxLen = 200): string {
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

export function pickProduct(raw: Record<string, unknown>) {
  return { id: raw.id, name: raw.name };
}

export function pickProject(raw: Record<string, unknown>) {
  return { id: raw.id, name: raw.name };
}

export function pickStory(raw: Record<string, unknown>) {
  return {
    id: raw.id,
    title: raw.title,
    status: raw.status,
    pri: raw.pri,
    stage: raw.stage,
    assignedTo: resolveRealname(raw.assignedTo),
    planTitle: raw.planTitle,
  };
}

export function pickTaskSummary(raw: Record<string, unknown>) {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status,
    pri: raw.pri,
    assignedTo: resolveRealname(raw.assignedTo),
    deadline: raw.deadline,
    estimate: raw.estimate,
    left: raw.left,
    consumed: raw.consumed,
  };
}

export function pickTaskDetail(raw: Record<string, unknown>) {
  const children = Array.isArray(raw.children)
    ? (raw.children as Record<string, unknown>[]).map(c => ({ id: c.id, name: c.name, status: c.status }))
    : undefined;
  return {
    ...pickTaskSummary(raw),
    execution: raw.execution,
    desc: typeof raw.desc === 'string' ? stripHtml(raw.desc) : undefined,
    openedBy: resolveRealname(raw.openedBy),
    finishedBy: resolveRealname(raw.finishedBy),
    parentName: raw.parentName,
    children,
  };
}

export function pickBug(raw: Record<string, unknown>) {
  return {
    id: raw.id,
    title: raw.title,
    status: raw.status,
    severity: raw.severity,
    pri: raw.pri,
    assignedTo: resolveRealname(raw.assignedTo),
    product: raw.product,
  };
}

export function pickUser(raw: Record<string, unknown>) {
  return { id: raw.id, account: raw.account, realname: raw.realname };
}
