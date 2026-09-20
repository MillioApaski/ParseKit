# ParseKit

**Your everyday data toolkit.** 无需账号、无需构建的 JSON / XML 开发者工作台。支持无损 JSON 数值格式化、语法高亮、结构树、JSON 路径提取与数据差异比较，适合 API 响应、MQTT 报文与 XML 配置。

> **Privacy first:** JSON / XML 文本仅在当前浏览器内处理。项目不使用第三方脚本、分析服务、外部 API 或服务器端解析，也不会把输入保存到本地存储。

## 功能 / Features

- 自动识别 JSON / XML，也可手动指定类型。
- 格式化、语法校验、压缩 / 重新序列化。
- 2 空格、4 空格或 Tab 缩进；JSON 校验失败时尽可能给出行列号并定位错误字符。
- 一键复制、结果转输入、清空；实时字符计数与处理状态。
- `Ctrl + Enter` / `⌘ + Enter` 快速格式化。
- 深色双栏界面，窄屏时自动调整为上下布局。
- 可折叠 JSON / XML 树：展示数据类型、嵌套结构，点击复制完整路径。
- JSON 深度字段 Diff（忽略对象键顺序，保留数组顺序）；XML 行级 Diff。
- 自带轻量语法高亮及行号，无外部 CDN、npm 依赖、后端或构建流程。
- **JSON 数值原样保留：** 格式化及压缩不会把 `9007199254740993` 转成 `9007199254740992`，也不会改变 `1e1000` 或长小数的原始写法。
- 结构树和 JSON Diff 使用保留数值文本的解析方式，不因 JavaScript 浮点数精度将不同大整数误判为相同。
- JSON/XML 结构树支持按字段、路径和值搜索（结果上限 100，最多扫描 30,000 个节点），点击结果复制路径。
- 新增 **JSON 路径查询**：支持点属性、数组索引、带引号的任意字段名、`*` 通配和 `..` 递归字段查询，可复制单个值、结果数组或写入输出区；从 JSON 树可一键跳转对应路径。
- 本地导入 JSON/XML/TXT、拖放文件、下载格式化结果（单文件最大 8 MiB）；`Ctrl/⌘ + S` 下载当前输出。

## 立即使用 / Run locally

直接用浏览器打开仓库根目录的 `index.html` 即可。也可以运行本地静态服务器：

```bash
python -m http.server 8000
```

然后打开 `http://localhost:8000`。`file://` 模式下，部分浏览器可能限制一键复制；此时可手动复制输出，或通过本地 HTTP 服务打开。

## 部署到 Cloudflare Pages

1. 在 Cloudflare Dashboard 中进入 **Workers & Pages**，创建一个 **Pages** 项目并连接本 GitHub 仓库 `MillioApaski/ParseKit`。
2. 选择生产分支 `main`，按下表设置构建选项。
3. 点击 **Save and Deploy**。以后推送到 `main` 将自动触发新的部署。

| 设置 | 值 |
| --- | --- |
| Framework preset | `None` |
| Production branch | `main` |
| Root directory | 留空（仓库根目录） |
| Build command | 留空；如果界面要求填写，可使用 `exit 0` |
| Build output directory | `.` |

`index.html`、`app.js` 和 `style.css` 全部放在仓库根目录，因此无需 `dist`、`npm install` 或框架适配器。Cloudflare Pages 提供 HTTPS 静态托管，格式化计算仍在访问者的浏览器中进行。

## 项目结构 / Project structure

```text
ParseKit/
├── index.html     # 页面结构
├── style.css      # 样式与响应式布局
├── app.js         # JSON / XML 本地处理逻辑
├── inspector.js   # JSON / XML 结构树、搜索与差异比较
├── json-safe.js   # JSON 数值原样保留的格式化和解析
├── workspace.js   # 本地文件导入、拖放和下载
├── query.js       # JSONPath-lite 查询和无损值导出
├── editor.js      # 语法高亮和行号
├── README.md      # 使用与部署说明
└── LICENSE        # GPL-3.0
```

## 数据正确性提醒 / Limitations

- **JSON 数值：** 格式化/压缩保留全部数值字面量；树视图和 Diff 保留大整数、指数及小数字面量。Diff 对非安全整数及小数/指数比较原始写法（例如 `1.0` 与 `1.00` 会被视为不同），而不是进行任意精度数学等值判断。
- **XML 空白：** 工具对混合内容及 `xml:space="preserve"` 采取保守处理，但纯元素子节点之间的空白仍可能被重新排版。不要把结果直接用于数字签名校验、字节级比较或依赖特定空白的 XML。
- **XML 压缩：** 当前仅重新序列化，不保证得到字节数最小的 XML，也不会为了缩短文本而删除可能有语义的空白。
- **JSON Diff：** 对象属性顺序不计为变化，数组的元素顺序计为变化。重复的 JSON 对象键仍按标准 `JSON.parse` 的最终键值语义处理，不提供重复键检测。
- **XML Diff：** 目前是格式化后的行级比较，不是 XML 语义比较。属性顺序、空白等变化仍可能出现在结果中。
- **本地文件：** 导入大小上限为 8 MiB；浏览器本地读取文件，不上传或自动保存。
- **本地处理不等于自动保存：** 刷新页面不会恢复尚未复制的输入内容。

## JSON 路径查询 / Query

支持以下 JSONPath-lite 子集（非完整 JSONPath 标准实现）：

| 表达式 | 含义 |
| --- | --- |
| `# ParseKit

**Your everyday data toolkit.** 无需账号、无需构建的 JSON / XML 开发者工作台。支持无损 JSON 数值格式化、语法高亮、结构树、JSON 路径提取与数据差异比较，适合 API 响应、MQTT 报文与 XML 配置。

> **Privacy first:** JSON / XML 文本仅在当前浏览器内处理。项目不使用第三方脚本、分析服务、外部 API 或服务器端解析，也不会把输入保存到本地存储。

## 功能 / Features

- 自动识别 JSON / XML，也可手动指定类型。
- 格式化、语法校验、压缩 / 重新序列化。
- 2 空格、4 空格或 Tab 缩进；JSON 校验失败时尽可能给出行列号并定位错误字符。
- 一键复制、结果转输入、清空；实时字符计数与处理状态。
- `Ctrl + Enter` / `⌘ + Enter` 快速格式化。
- 深色双栏界面，窄屏时自动调整为上下布局。
- 可折叠 JSON / XML 树：展示数据类型、嵌套结构，点击复制完整路径。
- JSON 深度字段 Diff（忽略对象键顺序，保留数组顺序）；XML 行级 Diff。
- 自带轻量语法高亮及行号，无外部 CDN、npm 依赖、后端或构建流程。
- **JSON 数值原样保留：** 格式化及压缩不会把 `9007199254740993` 转成 `9007199254740992`，也不会改变 `1e1000` 或长小数的原始写法。
- 结构树和 JSON Diff 使用保留数值文本的解析方式，不因 JavaScript 浮点数精度将不同大整数误判为相同。
- JSON/XML 结构树支持按字段、路径和值搜索（结果上限 100，最多扫描 30,000 个节点），点击结果复制路径。
- 新增 **JSON 路径查询**：支持点属性、数组索引、带引号的任意字段名、`*` 通配和 `..` 递归字段查询，可复制单个值、结果数组或写入输出区；从 JSON 树可一键跳转对应路径。
- 本地导入 JSON/XML/TXT、拖放文件、下载格式化结果（单文件最大 8 MiB）；`Ctrl/⌘ + S` 下载当前输出。

## 立即使用 / Run locally

直接用浏览器打开仓库根目录的 `index.html` 即可。也可以运行本地静态服务器：

```bash
python -m http.server 8000
```

然后打开 `http://localhost:8000`。`file://` 模式下，部分浏览器可能限制一键复制；此时可手动复制输出，或通过本地 HTTP 服务打开。

## 部署到 Cloudflare Pages

1. 在 Cloudflare Dashboard 中进入 **Workers & Pages**，创建一个 **Pages** 项目并连接本 GitHub 仓库 `MillioApaski/ParseKit`。
2. 选择生产分支 `main`，按下表设置构建选项。
3. 点击 **Save and Deploy**。以后推送到 `main` 将自动触发新的部署。

| 设置 | 值 |
| --- | --- |
| Framework preset | `None` |
| Production branch | `main` |
| Root directory | 留空（仓库根目录） |
| Build command | 留空；如果界面要求填写，可使用 `exit 0` |
| Build output directory | `.` |

`index.html`、`app.js` 和 `style.css` 全部放在仓库根目录，因此无需 `dist`、`npm install` 或框架适配器。Cloudflare Pages 提供 HTTPS 静态托管，格式化计算仍在访问者的浏览器中进行。

## 项目结构 / Project structure

```text
ParseKit/
├── index.html     # 页面结构
├── style.css      # 样式与响应式布局
├── app.js         # JSON / XML 本地处理逻辑
├── inspector.js   # JSON / XML 结构树、搜索与差异比较
├── json-safe.js   # JSON 数值原样保留的格式化和解析
├── workspace.js   # 本地文件导入、拖放和下载
├── query.js       # JSONPath-lite 查询和无损值导出
├── editor.js      # 语法高亮和行号
├── README.md      # 使用与部署说明
└── LICENSE        # GPL-3.0
```

## 数据正确性提醒 / Limitations

- **JSON 数值：** 格式化/压缩保留全部数值字面量；树视图和 Diff 保留大整数、指数及小数字面量。Diff 对非安全整数及小数/指数比较原始写法（例如 `1.0` 与 `1.00` 会被视为不同），而不是进行任意精度数学等值判断。
- **XML 空白：** 工具对混合内容及 `xml:space="preserve"` 采取保守处理，但纯元素子节点之间的空白仍可能被重新排版。不要把结果直接用于数字签名校验、字节级比较或依赖特定空白的 XML。
- **XML 压缩：** 当前仅重新序列化，不保证得到字节数最小的 XML，也不会为了缩短文本而删除可能有语义的空白。
- **JSON Diff：** 对象属性顺序不计为变化，数组的元素顺序计为变化。重复的 JSON 对象键仍按标准 `JSON.parse` 的最终键值语义处理，不提供重复键检测。
- **XML Diff：** 目前是格式化后的行级比较，不是 XML 语义比较。属性顺序、空白等变化仍可能出现在结果中。
- **本地文件：** 导入大小上限为 8 MiB；浏览器本地读取文件，不上传或自动保存。
- **本地处理不等于自动保存：** 刷新页面不会恢复尚未复制的输入内容。

 | 根节点 |
| `$.operations[0].name` | 精确字段和数组下标 |
| `$.content["0x0001"]` | 名称不符合普通标识符规则的字段 |
| `$.operations[*].cluster` | 单层通配 |
| `$..uuid` | 递归查找名为 uuid 的所有字段 |
| `$..*` | 递归查找所有后代 |

可选查询来源：原始输入、格式化输出、Diff 左侧、Diff 右侧。查询始终只读取本地 JSON；单次返回最多 200 项，最多检查 30,000 个节点。超出上限时结果会标记为不完整。查询的数组导出会保留大整数、小数和指数原始数值文本。**不支持过滤器、脚本表达式、切片、联合查询或 XML XPath**。

## 快捷操作 / Shortcuts

| 操作 | 快捷键 |
| --- | --- |
| 格式化（差异视图内为开始比较） | `Ctrl/⌘ + Enter` |
| 下载输出 | `Ctrl/⌘ + S`（格式化视图） |
| 输入 Tab | 按「缩进」选项插入空格或 Tab |

## License

本项目遵循仓库现有的 [GNU General Public License v3.0](LICENSE)。
