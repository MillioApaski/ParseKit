# ParseKit

**A local-first JSON & XML toolkit.**

ParseKit 是一个纯静态的结构化数据工作台，提供 JSON / XML 格式化、校验、查看、查询和差异比较。所有数据处理均在浏览器中完成，无需账号、后端或构建流程。

> **AI-generated project / AI 生成声明：** 本项目的代码与文档主要由 AI 生成，并在实际使用中持续调整。AI 生成的实现可能存在缺陷；处理重要数据前请核对结果。

## 功能

- **格式化与校验：** JSON / XML 自动识别、格式化、压缩、错误提示及缩进选项。
- **无损 JSON 数值文本：** 格式化和压缩保留大整数、长小数及指数的原始写法。
- **编辑体验：** 语法高亮、行号、智能缩进、括号与引号配对、当前文档字段补全。
- **结构视图：** 展开、折叠和搜索 JSON / XML 节点，复制字段路径。
- **路径查询：** JSONPath-lite 查询，可复制结果或发送到输出区。
- **差异比较：** JSON 字段级 Diff、XML 格式化后的行级 Diff。
- **文件操作：** 本地导入、拖放文件、复制和下载处理结果。
- **隐私优先：** 无远程脚本、分析服务或服务器端解析；输入不会自动上传或持久保存。

## 本地运行

下载仓库后，直接用浏览器打开 `index.html`，或者在仓库根目录运行：

```bash
python -m http.server 8000
```

然后访问 http://localhost:8000/。使用 `file://` 打开时，某些浏览器可能限制剪贴板 API。

## Cloudflare Pages 部署

本项目为零构建静态站点。创建 Cloudflare Pages 项目并连接此仓库，使用以下设置：

| 设置 | 值 |
| --- | --- |
| Framework preset | `None` |
| Production branch | `main` |
| Root directory | 仓库根目录 |
| Build command | 留空（如必须填写，可用 `exit 0`） |
| Build output directory | `.` |

`index.html` 位于仓库根目录，不需要 `npm install`、`dist` 或额外构建步骤。

## JSON 路径查询

支持以下 **JSONPath-lite 子集**，不是完整 JSONPath 实现：

| 表达式 | 含义 |
| --- | --- |
| `$` | 根节点 |
| `$.items[0].name` | 指定字段和数组索引 |
| `$["some-key"]` | 使用带引号的字段名 |
| `$.items[*].name` | 单层通配 |
| `$..name` | 递归搜索指定字段 |
| `$..*` | 递归搜索后代 |

可从输入、输出或 Diff 两侧选择查询来源。查询结果最多返回 200 项，最多检查 30,000 个节点。超出上限时结果可能不完整。不支持过滤器、切片、联合查询、脚本表达式或 XML XPath。

## 快捷键

| 操作 | 快捷键 |
| --- | --- |
| 格式化 / 当前模式的执行操作 | `Ctrl/⌘ + Enter` |
| 下载输出（格式化模式） | `Ctrl/⌘ + S` |
| 保留或智能增加缩进 | `Enter` |
| 缩进 / 反缩进 | `Tab` / `Shift + Tab` |
| 选择或关闭补全候选 | 方向键 / `Enter` / `Esc` |

## 限制与注意事项

- JSON 格式化保留数字字面量。结构视图与 Diff 也保留非安全整数、小数及指数的原始文本；它们不会做任意精度数值运算，因此 `1.0` 和 `1.00` 可能被视为不同。
- JSON 对象属性顺序在字段级 Diff 中不计为变化，数组顺序计为变化。重复字段名按标准 JSON 解析的最终键值处理。
- XML 格式化可能改变空白。XML Diff 是行级而非语义级比较，不适合数字签名验证或字节级比对。
- 单个导入文件上限为 8 MiB。刷新页面不会恢复未另行保存的输入。

## 项目结构

```text
ParseKit/
├── index.html       # 页面结构
├── style.css        # 界面样式
├── app.js           # JSON / XML 格式化与校验
├── json-safe.js     # 保留 JSON 数字字面量
├── editor.js        # 语法高亮与行号
├── smart-edit.js    # 智能编辑与本地补全
├── inspector.js     # 结构树和 Diff
├── query.js         # JSONPath-lite 查询
├── workspace.js     # 本地文件导入与下载
├── README.md
└── LICENSE
```

## License

本项目采用 [GNU General Public License v3.0](LICENSE)。
