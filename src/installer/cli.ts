#!/usr/bin/env node

/**
 * CLI 入口
 * 安装器主流程和错误处理
 */

import chalk from 'chalk';
import ora from 'ora';
import { detectInstalledClients } from './detector.js';
import { configExists, readConfig, saveConfig, getConfigPath } from './config-manager.js';
import { injectToClient, createMCPConfig } from './injector.js';
import { promptClientSelection, promptZentaoConfig } from './prompts.js';

export async function runInstallerCli() {
  console.log(chalk.bold.cyan('\n┌─────────────────────────────────────────────┐'));
  console.log(chalk.bold.cyan('│ Zentao MCP Server 安装器 v0.1.0            │'));
  console.log(chalk.bold.cyan('└─────────────────────────────────────────────┘\n'));

  try {
    // [1/5] 检测平台和客户端
    console.log(chalk.bold('[1/5] 检测平台和客户端...'));
    const platform = process.platform;
    console.log(chalk.green(`  ✓ 平台: ${getPlatformName(platform)}`));

    const spinner = ora('检测已安装的客户端...').start();
    const detectedClients = detectInstalledClients();
    spinner.succeed(`检测到 ${detectedClients.length} 个已安装的客户端`);

    if (detectedClients.length === 0) {
      console.log(chalk.yellow('\n  ⚠ 未检测到支持的 MCP 客户端'));
      console.log(chalk.gray('  支持的客户端: Claude Code, Claude Desktop, Cursor, Windsurf, Codex CLI, Continue\n'));
      process.exit(1);
    }

    detectedClients.forEach(c => {
      console.log(chalk.gray(`    - ${c.name} (${c.resolvedPath})`));
    });

    // [2/5] 选择客户端
    console.log(chalk.bold('\n[2/5] 选择要安装到的客户端'));
    const selectedClients = await promptClientSelection(detectedClients);

    if (selectedClients.length === 0) {
      console.log(chalk.yellow('\n  ⚠ 未选择任何客户端，安装已取消\n'));
      process.exit(0);
    }

    // [3/5] 检查配置文件
    console.log(chalk.bold('\n[3/5] 检查配置文件...'));
    let config;

    if (configExists()) {
      config = readConfig();
      if (!config) {
        throw new Error(`配置文件不存在：${getConfigPath()}`);
      }
      console.log(chalk.green(`  ✓ 找到现有配置: ${getConfigPath()}`));
      console.log(chalk.gray(`    禅道地址: ${config?.baseUrl}`));
    } else {
      console.log(chalk.yellow(`  ✗ 未找到配置文件: ${getConfigPath()}`));
      console.log(chalk.gray('    需要创建禅道连接配置\n'));

      // [4/5] 配置禅道连接
      console.log(chalk.bold('[4/5] 配置禅道连接信息'));
      config = await promptZentaoConfig();

      const saveSpinner = ora('保存配置...').start();
      saveConfig(config);
      saveSpinner.succeed(`配置已保存到: ${getConfigPath()}`);
    }

    // [5/5] 注册 MCP 服务器
    console.log(chalk.bold('\n[5/5] 注册 MCP 服务器...'));
    const mcpConfig = createMCPConfig();

    for (const client of selectedClients) {
      const injectSpinner = ora(`注册到 ${client.name}...`).start();

      try {
        injectToClient(client, mcpConfig);
        injectSpinner.succeed(`已注册到 ${client.name} (${client.resolvedPath})`);
      } catch (error: any) {
        injectSpinner.fail(`注册到 ${client.name} 失败`);
        console.log(chalk.red(`    错误: ${error.message}`));
      }
    }

    // 完成
    console.log(chalk.bold.green('\n┌─────────────────────────────────────────────┐'));
    console.log(chalk.bold.green('│ ✓ 安装完成！                                │'));
    console.log(chalk.bold.green('└─────────────────────────────────────────────┘'));

    console.log(chalk.bold('\n下一步:'));
    console.log(chalk.gray(`  1. 重启 ${selectedClients.map(c => c.name).join(' 和 ')}`));
    console.log(chalk.gray('  2. 使用 /mcp 命令查看 zentao 服务器状态'));
    console.log(chalk.gray('  3. 开始使用禅道工具！'));

    console.log(chalk.bold('\n配置文件位置:'));
    console.log(chalk.gray(`  ${getConfigPath()}`));
    console.log(chalk.gray('  如需修改配置，可以直接编辑该文件\n'));

  } catch (error: any) {
    console.error(chalk.red('\n✗ 安装失败:'), error.message);
    if (error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

function getPlatformName(platform: string): string {
  switch (platform) {
    case 'darwin': return 'macOS';
    case 'win32': return 'Windows';
    case 'linux': return 'Linux';
    default: return platform;
  }
}
