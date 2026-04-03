export interface ZenTaoUser {
  id: number | string;
  account?: string;
  realname?: string;
  nickname?: string;
  email?: string;
  [key: string]: unknown;
}

export interface ZenTaoProduct {
  id: number | string;
  name?: string;
  code?: string;
  status?: string;
  [key: string]: unknown;
}

export interface ZenTaoProject {
  id: number | string;
  name?: string;
  code?: string;
  status?: string;
  [key: string]: unknown;
}

export interface ZenTaoStory {
  id: number | string;
  title?: string;
  status?: string;
  plan?: number | string;
  [key: string]: unknown;
}

export interface ZenTaoTask {
  id: number | string;
  name?: string;
  status?: string;
  assignedTo?: string;
  project?: number | string;
  story?: number | string;
  execution?: number | string;
  [key: string]: unknown;
}

export interface ZenTaoExecution {
  id: number | string;
  project?: number | string;
  status?: string;
  deleted?: boolean | number | string;
  [key: string]: unknown;
}

export interface ZenTaoBug {
  id: number | string;
  title?: string;
  status?: string;
  severity?: number;
  pri?: number;
  assignedTo?: string | { realname?: string; account?: string };
  product?: number | string;
  [key: string]: unknown;
}

export interface ZenTaoApiEnvelope {
  status?: string | number;
  message?: string;
  msg?: string;
  code?: string | number;
  [key: string]: unknown;
}

export interface CreateTaskInput {
  name: string;
  project: number;
  type?: string;
  assignedTo?: string;
  estStarted?: string;
  deadline?: string;
  pri?: number;
  estimate?: number;
  module?: number;
  story?: number;
  desc?: string;
}

export interface CreateChildTaskInput {
  name: string;
  parent: number;
  story?: number;
  type?: string;
  assignedTo?: string;
  estStarted?: string;
  deadline?: string;
  estimate?: number;
  desc?: string;
}
