# 使用示例

## 方式 1: 简单使用（默认插件）

```javascript
// prettier.config.mjs
export default {
    plugins: ["@1adybug/prettier-plugin-sort-imports"],
}
```

这种方式使用默认行为，按字母顺序排序导入。

## 方式 2: 使用工厂函数 (createPlugin)

```javascript
// prettier.config.mjs
import { createPlugin } from "@1adybug/prettier-plugin-sort-imports"

export default {
    plugins: [
        createPlugin({
            getGroup: importStatement => {
                const path = importStatement.path
                if (path.startsWith("react")) return "react"
                if (path.startsWith("@/")) return "internal"
                if (path.startsWith(".")) return "relative"
                return "external"
            },
            sortGroup: (a, b) => {
                const order = ["react", "external", "internal", "relative"]
                return order.indexOf(a.name) - order.indexOf(b.name)
            },
            separator: "\n",
        }),
    ],
}
```

这种方式直接在配置文件中传递自定义函数。

## 方式 3: 使用配置文件路径 (sortImportsConfigPath)

### 步骤 1: 创建配置文件

**重要：配置文件必须使用 CommonJS 格式！**

```javascript
// import-sort.config.js (或 .cjs)
module.exports = {
    getGroup: importStatement => {
        const path = importStatement.path
        if (path.startsWith("react")) return "react"
        if (path.startsWith("@/")) return "internal"
        if (path.startsWith(".")) return "relative"
        return "external"
    },
    sortGroup: (a, b) => {
        const order = ["react", "external", "internal", "relative"]
        return order.indexOf(a.name) - order.indexOf(b.name)
    },
    separator: "\n",
}
```

**注意事项**：

- ✅ 支持：`.js` 文件（使用 `module.exports`）
- ✅ 支持：`.cjs` 文件（推荐用于 `"type": "module"` 项目）
- ❌ 不支持：`.mjs` 文件或使用 `export default` 的 ESM 格式

如果你的项目在 `package.json` 中设置了 `"type": "module"`，请使用 `.cjs` 扩展名。

### 步骤 2: 在 Prettier 配置中引用

```javascript
// prettier.config.mjs
export default {
    plugins: ["@1adybug/prettier-plugin-sort-imports"],
    sortImportsConfigPath: "./import-sort.config.js",
}
```

或者使用默认导出的插件：

```javascript
// prettier.config.mjs
import plugin from "@1adybug/prettier-plugin-sort-imports"

export default {
    plugins: [plugin],
    sortImportsConfigPath: "./import-sort.config.js",
}
```

### 为什么不支持 ESM？

Prettier 的 `preprocess` 函数必须是同步的，而 ESM 的 `import()` 是异步的。因此配置文件必须使用 CommonJS 格式，这样才能通过 `require()` 同步加载。

如果你需要使用 ESM 语法，可以使用方式 2（工厂函数），直接在 Prettier 配置文件中定义配置。

### 优点

1. **配置复用**: 可以在多个项目间共享同一个配置文件
2. **简洁**: Prettier 配置文件保持简洁
3. **灵活**: 配置文件可以包含复杂的逻辑和注释

## 配置优先级

配置的优先级从高到低为：

1. `createPlugin()` 传递的参数
2. `sortImportsConfigPath` 加载的配置
3. Prettier 配置文件中的选项（如 `importSortSeparator`）

例如：

```javascript
// import-sort.config.js
module.exports = {
    separator: "\n",
    sortSideEffect: true,
}
```

```javascript
// prettier.config.mjs
import { createPlugin } from "@1adybug/prettier-plugin-sort-imports"

export default {
    plugins: [
        createPlugin({
            separator: "\n\n", // 这个会覆盖配置文件中的 separator
        }),
    ],
    sortImportsConfigPath: "./import-sort.config.js",
    importSortSeparator: "", // 这个优先级最低，会被配置文件中的覆盖
}
```

最终使用的配置：

- `separator`: `"\n\n"` (来自 createPlugin)
- `sortSideEffect`: `true` (来自配置文件)

## 示例效果

### 输入

```typescript
import { useState } from "react"

import axios from "axios"

import { Button } from "@/components/Button"

import "./style.css"
```

### 输出（使用方式 3 的配置）

```typescript
import { useState } from "react"

import axios from "axios"

import { Button } from "@/components/Button"

import "./style.css"
```

分组顺序为：react → external → internal → relative，每组之间有一个空行。
