# 测试文档

这是 Prettier 导入排序插件的测试套件，包含全面的功能测试和边界情况测试。

## 运行测试

### 安装依赖

```bash
bun install
```

### 构建项目（测试前必须执行）

```bash
bun run build
```

### 运行所有测试

```bash
bun test
```

### 监听模式

```bash
bun test:watch
```

### 运行特定测试文件

```bash
bun test test/main.test.ts
```

## 测试文件

### `main.test.ts` - 主要功能测试（18 个测试用例）

包含以下测试分组：

#### 1. 导入合并测试（3 个测试）
- ✅ 合并同一模块的多次导入
- ✅ 命名空间导入不合并
- ✅ 副作用导入不合并

#### 2. 导入排序测试（2 个测试）
- ✅ 按照模块、别名、相对路径排序
- ✅ type 导入优先排序

#### 3. 删除未使用导入测试（6 个测试）
- ✅ 删除完全未使用的导入
- ✅ 部分未使用的导入只删除未使用部分
- ✅ JSX 组件使用分析
- ✅ TypeScript 类型引用分析
- ✅ 命名空间类型引用
- ✅ 副作用导入不删除

#### 4. Type-only 导入测试（2 个测试）
- ✅ type-only 和普通导入混合
- ✅ 所有命名导入都是 type 时使用 import type 语法

#### 5. export from 语句测试（1 个测试）
- ✅ export from 语句的处理

#### 6. 导入别名测试（1 个测试）
- ✅ 导入别名处理

#### 7. 注释处理测试（1 个测试）
- ✅ 前导注释和行尾注释

#### 8. 副作用导入排序测试（2 个测试）
- ✅ sortSideEffect: false 时副作用导入作为分隔符
- ✅ sortSideEffect: true 时所有导入都排序

## 测试覆盖的功能点

### ✅ 导入合并

- 同一模块的多次导入会被合并为一个 import 语句
- 命名空间导入（`import * as`）不会被合并
- 副作用导入（`import "module"`）不会被合并
- 合并时保留所有注释

### ✅ 导入排序

**默认排序规则**：
1. 第三方模块（如 `react`, `lodash`）
2. 路径别名（如 `@/components/Button`）
3. 相对路径（如 `./helper`, `../utils`）

**导入内容排序规则**：
1. 默认导入（`default`）
2. 命名空间导入（`* as`）
3. 命名导入（按字母顺序，type 类型优先）

### ✅ 删除未使用的导入

**配置项**：`importSortRemoveUnused: true`

**功能**：
- 分析代码中的标识符使用情况
- 删除完全未使用的导入语句
- 部分未使用时只删除未使用的导入内容
- 支持 TypeScript 类型引用分析
- 支持 JSX 组件使用分析
- 支持命名空间类型引用（`A.B.C`）
- 副作用导入和 export 语句不会被删除

### ✅ Type-only 导入优化

- type 导入总是排在普通导入之前
- 当所有命名导入都是 type 时，自动提升为 `import type { }` 语法
- 混合导入保留行内 `type` 标记

### ✅ Export from 语句

- 支持 `export { } from` 语句
- 支持 `export type { } from` 语句
- 支持 `export * from` 语句
- export 语句会排在 import 语句之前

### ✅ 导入别名

- 支持 `import { A as B }` 语法
- 支持默认导入的别名
- 别名参与排序

### ✅ 注释处理

- 保留导入语句的前导注释
- 保留导入语句的行尾注释
- 保留导入内容的注释
- 合并时保留所有前导注释，只保留第一个导入的行尾注释

### ✅ 副作用导入排序

**配置项**：`importSortSideEffect: true/false`

- `false`（默认）：副作用导入保持原有顺序，作为分隔符
- `true`：副作用导入也参与排序

## 配置选项

### Prettier 配置选项

在 `.prettierrc` 或 `prettier.config.js` 中配置：

```javascript
{
  "plugins": ["@1adybug/prettier-plugin-sort-imports"],
  "importSortRemoveUnused": true,  // 是否删除未使用的导入
  "importSortSideEffect": false    // 是否对副作用导入进行排序
}
```

### 程序化配置

```typescript
import { createPlugin } from "@1adybug/prettier-plugin-sort-imports"

const customPlugin = createPlugin({
  // 自定义分组函数
  getGroup: (statement) => {
    if (statement.path.startsWith("react")) return "react"
    if (!statement.path.startsWith(".")) return "external"
    return "internal"
  },
  // 自定义分组排序
  sortGroup: (a, b) => {
    const order = ["react", "external", "internal"]
    return order.indexOf(a.name) - order.indexOf(b.name)
  },
  // 自定义导入语句排序
  sortImportStatement: (a, b) => {
    return a.path.localeCompare(b.path)
  },
  // 自定义导入内容排序
  sortImportContent: (a, b) => {
    return a.name.localeCompare(b.name)
  },
  // 自定义分隔符
  separator: (group, index) => {
    if (index === 0) return undefined
    return `// ${group.name} imports`
  },
  // 是否对副作用导入进行排序
  sortSideEffect: false,
  // 是否删除未使用的导入
  removeUnusedImports: true,
})
```

## 注意事项

⚠️ **重要**：
- 测试需要先构建项目才能运行（`bun run build`）
- 测试导入的是构建后的 `dist/index.js` 文件
- 如果修改了源代码，需要重新构建后再运行测试

## 测试结果

最新测试结果（全部通过）：

```
✅ 18 pass
❌ 0 fail
⏱️ ~1.4s
```

## 添加新测试

当发现新的边界情况或需要测试新功能时，可以在 `main.test.ts` 中添加新的测试用例：

```typescript
it("新功能描述", async () => {
    const input = `// 输入代码`
    
    const result = await formatCode(input, {
        // 配置选项
    })
    
    expect(result).toBe(`// 期望输出`)
})
```

**注意**：期望输出必须是 Prettier 格式化后的结果，包括：
- 语句末尾的分号
- 正确的缩进
- 正确的空格
