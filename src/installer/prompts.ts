/**
 * 交互式提示
 * 用户选择客户端和输入禅道配置
 */

import inquirer from 'inquirer';
import { DetectedClient } from './detector.js';
import { ZentaoConfig } from './config-manager.js';

/**
 * 提示用户选择客户端
 */
export async function promptClientSelection(
  clients: DetectedClient[]
): Promise<DetectedClient[]> {
  const { selected } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message: '选择要安装到的客户端（空格选择，回车确认）:',
      choices: clients.map(c => ({
        name: `${c.name} (${c.resolvedPath})`,
        value: c.id,
        checked: c.id === 'claude-code' // 默认选中 Claude Code
      }))
    }
  ]);

  return clients.filter(c => selected.includes(c.id));
}

/**
 * 提示用户输入禅道配置
 */
export async function promptZentaoConfig(): Promise<ZentaoConfig> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'baseUrl',
      message: '禅道地址 (例如: http://zentao.example.com):',
      validate: (input: string) => {
        if (!input) return '请输入禅道地址';
        if (!input.startsWith('http://') && !input.startsWith('https://')) {
          return '地址必须以 http:// 或 https:// 开头';
        }
        return true;
      }
    },
    {
      type: 'list',
      name: 'authType',
      message: '认证方式:',
      choices: [
        { name: 'Token 认证（推荐）', value: 'token' },
        { name: '账号密码认证', value: 'password' }
      ]
    },
    {
      type: 'input',
      name: 'token',
      message: 'Token:',
      when: (answers: any) => answers.authType === 'token',
      validate: (input: string) => input ? true : '请输入 Token'
    },
    {
      type: 'input',
      name: 'account',
      message: '账号:',
      when: (answers: any) => answers.authType === 'password',
      validate: (input: string) => input ? true : '请输入账号'
    },
    {
      type: 'password',
      name: 'password',
      message: '密码:',
      when: (answers: any) => answers.authType === 'password',
      validate: (input: string) => input ? true : '请输入密码'
    },
    {
      type: 'number',
      name: 'timeoutMs',
      message: '超时时间 (毫秒):',
      default: 15000
    }
  ]);

  return {
    baseUrl: answers.baseUrl,
    token: answers.authType === 'token' ? answers.token : undefined,
    account: answers.authType === 'password' ? answers.account : undefined,
    password: answers.authType === 'password' ? answers.password : undefined,
    timeoutMs: answers.timeoutMs
  };
}
