---
description: "在 DSH Web 中安装和配置 New API 管理台，管理公益站余额与每日签到。"
kind: "package-bundle"
---

# @winterhuan/dsh-new-api

[English](README.md) | 中文

## Summary

在 DSH Web 的「设置 → New API 管理台」中管理 New API / One API 公益站，查看账号余额、独立签到钱包和每日签到状态。使用访问令牌或 session Cookie 添加站点后，可以手动签到或设置每日自动签到。发布版 `1.0.0-winter.1` 面向 DSH `0.2.2-rc.1`；站点凭据在 Host 上以明文保存。

## Table of Contents

- [使用此包](#use-this-package)
- [认证与签到](#authentication-and-check-ins)
- [数据与访问](#data-and-access)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## 使用此包

将固定 Git 发布版安装到 DSH `0.2.2-rc.1` profile：

```sh
dsh plugin --profile web add github:winterhuan/dsh-new-api#v1.0.0-winter.1
```

重启该 profile 的 Host 并硬刷新浏览器，然后打开「设置 → New API 管理台」。通过 `dsh plugin --profile web remove @winterhuan/dsh-new-api` 移除 profile 层；移除会保留已保存的站点数据。

本地开发使用 Node.js `^22.19.0 || >=24.0.0` 和 pnpm `11.7.0`，在插件仓库构建组合包：

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
pnpm test
```

创建开发 profile 前，将 `DSH_HOME` 设置为空的临时目录：

```sh
dsh --profile new-api-dev --from-default-profile web --dump-config > /dev/null
dsh plugin --profile new-api-dev add "$PWD"
```

打开浏览器前，创建临时文档目录。用下面的覆盖项替换 `$DSH_HOME/profiles/new-api-dev/cordis.patch.yml` 中空的 `[]`，并填入该目录的绝对路径：

```yaml
- id: workspace-controller
  config:
    documentsDirectory: /absolute/path/to/temporary/documents
```

启动开发服务，打开它打印的地址：

```sh
dsh --profile new-api-dev --host 127.0.0.1 --port 0 --no-open
```

打开「设置 → New API 管理台」。添加站点后可以查看余额和签到状态，表单也控制该站点是否参与自动签到。源码修改后重新构建、重启开发进程并硬刷新浏览器。通过 `dsh plugin --profile new-api-dev remove @winterhuan/dsh-new-api` 移除开发层。

-----

<a id="authentication-and-check-ins"></a>
## 认证与签到

按站点支持的方式选择认证模式。插件保存你提供的凭据，不负责登录站点。

| 模式 | 凭据 | 常见站点 |
|---|---|---|
| `bearer` | 在站点账号设置中创建的访问令牌 / PAT | New API `v1.0.0-rc.x` |
| `cookie` | Session Cookie 与用于 `New-Api-User` 的数字用户 ID | 旧版 New API / One API 及部分 fork |

插件读取 `/api/status` 获取能力和额度换算信息，再读取 `/api/user/self` 获取余额。它从账号响应或支持的钱包接口识别独立签到钱包；余额为零时仍显示，不支持钱包时省略。令牌消费哪种余额由各站点的计费规则决定。

自动签到默认使用 Host 本机时区的 09:00，加上每站点每天 0–30 分钟的延迟。全局开关和站点参与开关都必须启用。运行中的 Host 每分钟检查到期站点；失败每天最多尝试三次，间隔至少 15 分钟。成功、已经签到、不支持签到和需要人工验证的结果都会停止当天的自动尝试。

插件先检查今日状态，再向 `/api/user/checkin` 发起签到请求，也可回退到 `/api/user/sign_in` 或 `/api/user/check_in`；站点表单支持自定义签到路径。Turnstile 或验证码需要在站点浏览器中人工处理。

-----

<a id="data-and-access"></a>
## 数据与访问

站点、调度设置和签到结果保存在 `$DSH_HOME/dsh-new-api/sites.json`，默认路径为 `~/.dsh/dsh-new-api/sites.json`。使用同一 `DSH_HOME` 的 profile 共享此目录。令牌和 Cookie 以明文保存；浏览器与工具结果只显示脱敏值。

如果该文件无法读取或不是合法 JSON，管理台会拒绝读写，直到你修复或恢复文件；它不会用空状态覆盖原文件。

浏览器通过带有 `X-DSH-New-API: 1` 的 `POST /dsh-new-api/api` 调用 Host。路由将 Host／Origin 检查和浏览器会话鉴权交给 DSH 的 connection 服务，因此会拒绝匿名和跨站请求。网络或反向代理部署仍需为公开访问地址正确配置 DSH。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节 — 点击展开</summary>

[组合包补丁](cordis.patch.yml)挂载 Host 插件。[Host 入口](src/index.js)负责 JSON 存储、HTTP 操作和调度器，依赖 `webServer`、`timer` 与 `connection`。挂载上下文提供可选的 `tools` 服务时，它会注册 `newapi_sites`。[Client 入口](src/client.js)注册本地化设置页，并通过 Host 路由提交操作。

源码从 `newapi-manager.zip` 导入，原包为 `@local/newapi-manager@1.0.0`。压缩包包含独立 JavaScript、图标和语言元数据，没有 TypeScript 源码或 source map。JavaScript 在 `src/` 下维护；`typecheck` 只检查语法。构建将浏览器模块复制到已提交的 `dist/client.js`，可安装的 Git 检出无需在安装时运行构建。

测试使用独立临时数据目录和回环 fixture，覆盖存储故障、鉴权请求准入、额度刷新、账号切换竞态与核心站点操作，不连接真实公益站。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [仓库开发与 profile 隔离](https://github.com/winterhuan/dsh-creative/blob/develop/HANDOFF.md)

-----

<a id="model-experience"></a>
## Model Experience

### 站点操作

#### What the model sees

挂载上下文提供 `tools` 时，模型可以通过 `newapi_sites` 列出、添加、修改、删除、刷新和签到站点，也可读取或保存调度设置。结果包含脱敏凭据和受支持的 `quota.wallet` 余额。此包不添加系统指令；单纯操作设置页不会提交模型输入。

#### Token effect

工具可用且被调用时，工具声明和返回的站点记录会占用模型上下文。在工具参数中提供的凭据会进入对话；输入密钥时使用浏览器表单。

#### KV Cache effect

此包不添加稳定的提示前缀。工具可用性和返回的站点状态可能改变模型请求；缓存复用取决于当前 preset 和提供方。

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Turnstile、验证码和 Cloudflare/WAF 挑战需要人工处理；插件不会绕过这些检查。
- 不同 fork 的认证方式、签到接口和钱包字段可能不同。受限 PAT 可能拒绝签到路由；应使用站点授权执行这些操作的凭据。
- 自动签到要求 Host 持续运行。共享数据目录的 profile 不得同时运行独立插件实例。
- Agent 工具需要挂载上下文提供 `tools`；普通 Web 加载不保证 Session 能获得 `newapi_sites`。
- 本次导入具有 JavaScript 语法检查和确定性 fixture 测试；尚未验证真实站点认证与每日调度执行。

<a id="dev-note"></a>
### Dev Note

<details>
<summary>维护者工作上下文 — 点击展开</summary>

无。

</details>
