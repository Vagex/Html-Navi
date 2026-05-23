# Html Navi

一个用于持续收纳、说明、分类并重新发现优质资料的轻量网站。它是纯 HTML/CSS/JavaScript 静态站点，可直接发布到 GitHub Pages，不需要服务器、数据库或任何密钥。

## 使用方式

这个项目把资料分成两类：

- **公开收纳（主资料库）**：你可在对话中给出一个公开网址，也可使用站点中的“提交网址，智能整理”入口。GitHub Actions 会调用 AI 为资料补充标题、摘要、来源、分类和标签，再创建待审核的 Pull Request；合并后写入 `data/library.json`。站点从这个文件加载数据，因此换浏览器或设备仍可浏览。
- **本地暂存（仅草稿）**：网页左侧表单只适合临时记录。内容保存在当前浏览器 `localStorage` 中，换浏览器、换设备或清理站点数据后不会存在；可使用“导出备份”和“导入”迁移草稿。

适合提交给公开收纳的资料包括文章、工具官网、教程、公开演讲视频、开源项目和公开报告。需要登录的页面、私人网盘分享、带访问凭据的网址、账户恢复链接或包含个人隐私的资料，不应进入公开仓库。

目录视图支持选择每行 `2` 至 `5` 列及每页 `12`、`24` 或 `48` 条。卡片默认只显示识别所需的标题与分类，悬停或键盘聚焦后可查看摘要、状态、来源和维护操作。

## 智能整理配置

智能整理默认使用 NVIDIA API Catalog 托管的 NIM 接口，通过 GitHub Actions 运行。NVIDIA Developer Program 为原型开发提供免费的 hosted NIM API 访问，实际可用模型和使用限制以 NVIDIA 当前服务规则为准。API Key 不会出现在静态网页中，也不应写入代码或 JSON 数据。

首次发布仓库后进行一次配置：

1. 在 NVIDIA API Catalog 中打开一个适合中文总结的文本模型页面，点击获取 NVIDIA Developer API Key。
2. 打开 GitHub 仓库 `Settings` > `Secrets and variables` > `Actions` > `Secrets`，创建 Repository secret：`NVIDIA_API_KEY`。
3. 可选：在同一页面的 `Variables` 中创建 `AI_MODEL`，填写 API Catalog 当前可用的模型 ID；未设置时工作流使用 `meta/llama-3.1-8b-instruct`。
4. 在 `Settings` > `Actions` > `General` 中确认工作流具备读写权限，并允许 GitHub Actions 创建 Pull Request。

工作流程如下：

```text
网页点击“提交网址，智能整理”
        -> 创建 [收纳] GitHub Issue
        -> smart-organize 工作流读取公开页面
        -> NVIDIA NIM 返回摘要、分类与标签
        -> 工作流更新 data/library.json 并创建 Pull Request
        -> 你审核无误后合并，网站显示新资料
```

安全约束：

- 工作流只处理由仓库所有者创建、标题以 `[收纳]` 开头的 Issue，防止陌生人消耗你的 API 配额。
- 整理脚本拒绝带账号密码的 URL、`localhost` 以及解析到私有网络地址的链接。
- 页面内容被视为不可信文本，模型只可生成资料元数据；最终内容需经 Pull Request 审核后才进入公开目录。

### 切换到 OpenAI（可选）

项目仍支持 OpenAI 作为备用提供商：

1. 新增 Repository secret：`OPENAI_API_KEY`。
2. 新增 Repository variable：`AI_PROVIDER`，值设为 `openai`。
3. 新增 Repository variable：`AI_MODEL`，例如填写支持 Structured Outputs 的模型名称。

NVIDIA 模式使用其官方兼容的 Chat Completions endpoint，并在脚本中校验返回 JSON；OpenAI 模式使用 Structured Outputs 进行严格结构约束。

## 我会如何整理网址

收到一个适合公开保存的网址后，每条记录会尽可能具备：

| 字段 | 用途 |
| --- | --- |
| `title` / `url` | 清晰识别内容与原始入口 |
| `summary` | 一到三句话说明它讲什么、为什么值得留下 |
| `category` / `tags` | 让筛选与未来检索更可靠 |
| `source` | 网站、作者或资料来源 |
| `status` | `inbox`、`reading`、`reviewed` 或 `archived` |
| `reviewDate` | 值得定期重看的资料可安排日期 |
| `favorite` | 重点内容优先浮现 |

若网页内容不足以判断价值，或网址指向敏感/不可公开内容，我会先说明原因，而不是把它直接写入仓库。

## 数据安全

- 代码仓库中不存放密码、API Token、SSH 私钥、Cookies 或环境变量文件。
- `.gitignore` 已排除常见密钥文件以及导出的个人 JSON 备份目录。
- `data/library.json` 会随 GitHub Pages 对外可见，只允许收录公开资料和公开说明。
- 本地导出的 `html-navi-backup-YYYY-MM-DD.json` 可能包含你的私人记录，应放在受保护的位置，不要提交到公开仓库。
- GitHub Pages 网站本身是公开可访问的，即使某些 GitHub 方案允许从私有仓库发布页面。
- 静态网页不会直接向 AI API 或 GitHub 写入内容，因为把写入 Token 或 API Key 放在浏览器端会导致泄露；智能整理只在 GitHub Actions 中使用 Secret 运行。

## 本地浏览

直接打开 `index.html` 可以使用本地暂存功能。要同时加载 `data/library.json` 的公开目录，请从项目目录启动任意静态文件服务器，例如：

```powershell
python -m http.server 8080
```

然后访问 `http://localhost:8080/`。

## 发布到 GitHub Pages

此站点无需构建步骤，适合直接从分支发布：

1. 将仓库推送至 `https://github.com/Vagex/Html-Navi.git` 的 `main` 分支。
2. 在仓库 `Settings` > `Pages` 中，将 `Source` 选择为 `Deploy from a branch`。
3. 选择 `main` 分支与 `/(root)` 文件夹，保存后等待 GitHub Pages 发布。

当前 GitHub Pages 官方文档支持从指定分支的仓库根目录直接发布静态文件；对于本项目，这比引入构建工作流更简单。

## 维护公开收纳目录

在 `data/library.json` 的 `items` 数组中添加记录。示例仅用于展示字段结构：

```json
{
  "id": "source-short-name-20260523",
  "title": "公开页面标题",
  "url": "https://example.com/public-page",
  "summary": "说明资料核心内容，以及未来什么场景下值得重新查看。",
  "category": "技术与工具",
  "tags": ["静态站点", "知识管理"],
  "source": "Example",
  "status": "reviewed",
  "reviewDate": "",
  "favorite": false,
  "createdAt": "2026-05-23T00:00:00.000Z",
  "updatedAt": "2026-05-23T00:00:00.000Z"
}
```

不要在 JSON 中加入任何鉴权头、查询参数形式的访问令牌或非公开内容摘录。
