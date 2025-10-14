# Prettier 导入排序插件实现计划

## 核心模块

### 1. 类型定义 (`src/types.ts`)

定义所有接口类型：

- `ImportContent`：导入内容定义（name, alias, type）
- `ImportStatement`：导入语句定义（path, isExport, isSideEffect, importContents）
- `Group`：分组定义（name, isSideEffect, importStatements）
- `PluginConfig`：插件配置接口（getGroup, sortGroup, sortImportStatement, sortImportContent, separator, sortSideEffect）
- 各种函数类型（GetGroupFunction, SortGroupFunction, SortImportStatementFunction, SortImportContentFunction）

### 2. 解析器 (`src/parser.ts`)

使用 `@babel/parser` 解析源代码，提取导入/导出语句：

- 解析源代码为 AST
- 遍历 AST 找到所有 import 和 export 语句（只支持 ES6 模块）
- 识别导入类型：默认导入、命名导入、命名空间导入、副作用导入
- 识别 type 导入标记
- 将 AST 节点转换为 `ImportStatement` 对象
- 记录每个导入语句在源代码中的位置信息
- 提取并保留导入语句上方的注释，注释会随导入语句一起移动

关键函数：

- `parseImports(code: string): ImportStatement[]`

### 3. 排序器 (`src/sorter.ts`)

实现分组和排序逻辑：

- 根据 `getGroup` 函数对导入语句进行分组
- 如果 `sortSideEffect` 为 false，将副作用导入作为分隔符处理
- 使用 `sortGroup` 函数对分组排序（默认按分组名称字母序）
- 使用 `sortImportStatement` 函数对每个分组内的导入语句排序（默认按 path 字母序）
- 使用 `sortImportContent` 函数对每个导入语句内的内容排序（默认 type 在前，然后按名称字母序）

关键函数：

- `groupImports(imports: ImportStatement[], config: PluginConfig): Group[]`
- `sortGroups(groups: Group[], config: PluginConfig): Group[]`
- `sortImportStatements(statements: ImportStatement[], config: PluginConfig): ImportStatement[]`
- `sortImportContents(contents: ImportContent[], config: PluginConfig): ImportContent[]`

### 4. 格式化器 (`src/formatter.ts`)

将排序后的导入语句转换回代码字符串：

- 根据 `ImportStatement` 生成对应的 import/export 代码
- 处理默认导入、命名导入、命名空间导入的格式
- 处理 type 导入的格式
- 根据 `separator` 配置在分组之间插入分隔符和空行
- 保持代码风格一致（引号、分号等）

关键函数：

- `formatImportStatement(statement: ImportStatement): string`
- `formatGroups(groups: Group[], config: PluginConfig): string`

### 5. 主入口 (`src/index.ts`)

实现 prettier 插件标准接口：

- 导出 `parsers` 对象（扩展现有的 babel/typescript 解析器）
- 导出 `printers` 对象（自定义打印逻辑）
- 导出 `options` 对象（插件配置选项）
- 集成解析器、排序器、格式化器
- 只处理文件开头的连续导入语句块

关键结构：

```typescript
export const parsers = {
    babel: { ... },
    typescript: { ... }
}
```

## 默认行为

- 默认分组：所有导入在同一个 "default" 分组
- 默认分组排序：按分组名称字母顺序
- 默认导入语句排序：按 path 字母顺序
- 默认导入内容排序：type 类型在前，然后按最终导入名称字母顺序
- 副作用导入：默认不参与排序，作为分隔符
- 分隔符：默认无分隔符

## 实现注意事项

1. 默认导入和命名空间导入（`import * as`）始终在导入内容的最前面
2. 副作用导入的特殊处理逻辑
3. 需要识别文件开头的连续导入块，不处理代码中间的导入
4. 保持原有代码格式（使用 prettier 的格式化能力）
