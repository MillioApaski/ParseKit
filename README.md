# ParseKit

**Your everyday data toolkit.** 无需账号、无需构建的 JSON / XML 开发者工作台。支持格式化、语法高亮、结构树与数据差异比较，适合 API 响应、MQTT 报文与 XML 配置。

> **Privacy first:** JSON / XML 文本仅在当前浏览器内处理。项目不使用第三方脚本、分析服务、外部 API 或服务器端解析，也不会把输入保存到本地存储。

## 功能 / Features

- 自动识别 JSON / XML，也可手动指定类型。
- 格式化、语法校验、压缩 / 重新序列化。
- 2 空格、4 空格或 Tab 缩进。
- 一键复制、结果转输入、清空；实时字符计数与处理状态。
- `Ctrl + Enter` / `⌘ + Enter` 快速格式化。
- 深色双栏界面，窄屏时自动调整为上下布局。
- 可折叠 JSON / XML 树：展示数据类型、嵌套结构，点击复制完整路径。
- JSON 深度字段 Diff（忽略对象键顺序，保留数组顺序）；XML 行级 Diff。
- 自带轻量语法高亮及行号，无外部 CDN、npm 依赖、后端或构建流程。

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
├── inspector.js   # JSON / XML 结构树与差异比较
├── editor.js      # 语法高亮和行号
├── README.md      # 使用与部署说明
└── LICENSE        # GPL-3.0
```

## 数据正确性提醒 / Limitations

- **JSON 大整数：** 当前使用浏览器原生 `JSON.parse` / `JSON.stringify`。超出 JavaScript 安全整数范围的整数可能丢失精度，不适合用于需要无损重写大整数的协议数据。
- **XML 空白：** 工具对混合内容及 `xml:space="preserve"` 采取保守处理，但纯元素子节点之间的空白仍可能被重新排版。不要把结果直接用于数字签名校验、字节级比较或依赖特定空白的 XML。
- **XML 压缩：** 当前仅重新序列化，不保证得到字节数最小的 XML，也不会为了缩短文本而删除可能有语义的空白。
- **JSON Diff：** 对象属性顺序不计为变化，数组的元素顺序计为变化。输入仍经原生 JSON.parse，大整数有精度风险。
- **XML Diff：** 目前是格式化后的行级比较，不是 XML 语义比较。属性顺序、空白等变化仍可能出现在结果中。
- **本地处理不等于自动保存：** 刷新页面不会恢复尚未复制的输入内容。

## License

本项目遵循仓库现有的 [GNU General Public License v3.0](LICENSE)。
