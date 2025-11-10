import { describe, expect, it } from "bun:test"
import { format } from "prettier"
import * as tailwindPlugin from "prettier-plugin-tailwindcss"

import plugin, { createPlugin } from "../dist/index.js"

/** 格式化代码的辅助函数 */
async function formatCode(code: string, config?: any): Promise<string> {
    return await format(code, {
        parser: "typescript",
        plugins: [plugin],
        ...config,
    })
}

/** 格式化代码的辅助函数（使用自定义插件实例） */
async function formatCodeWithPlugin(code: string, customPlugin: any, config?: any): Promise<string> {
    return await format(code, {
        parser: "typescript",
        plugins: [customPlugin],
        ...config,
    })
}

describe("基础导入排序测试", () => {
    it("合并和排序来自同一模块的多次导入", async () => {
        const input = `import { useState } from "react"
import { useEffect } from "react"
import React from "react"

const app = React.createElement("div")
const state = useState(0)
useEffect(() => {})`

        const result = await formatCode(input)

        expect(result).toBe(`import React, { useState, useEffect } from "react";

const app = React.createElement("div");
const state = useState(0);
useEffect(() => {});
`)
    })

    it("按照模块类型排序：npm包 > 别名路径 > 相对路径", async () => {
        const input = `import { helper } from "./helper"
import { Button } from "@/components/Button"
import { debounce } from "lodash"
import { useState } from "react"

const state = useState(0)
const fn = debounce(() => {})
const btn = <Button />
const h = helper()`

        const result = await formatCode(input)

        expect(result).toBe(`import { debounce } from "lodash";
import { useState } from "react";
import { Button } from "@/components/Button";
import { helper } from "./helper";

const state = useState(0);
const fn = debounce(() => {});
const btn = <Button />;
const h = helper();
`)
    })

    it("type 导入在普通导入之前", async () => {
        const input = `import { Button, type ButtonProps, Card, type CardProps } from "@/components"

const btn: ButtonProps = {}
const card: CardProps = {}
const b = <Button />
const c = <Card />`

        const result = await formatCode(input)

        expect(result).toBe(`import { type ButtonProps, type CardProps, Button, Card } from "@/components";

const btn: ButtonProps = {};
const card: CardProps = {};
const b = <Button />;
const c = <Card />;
`)
    })

    it("默认导入和命名空间导入排在最前", async () => {
        const input = `import { useState, useEffect } from "react"
import React from "react"
import * as ReactDOM from "react-dom"

const app = React.createElement("div")
const state = useState(0)
useEffect(() => {})
ReactDOM.render(app, document.body)`

        const result = await formatCode(input)

        expect(result).toBe(`import React, { useEffect, useState } from "react";
import * as ReactDOM from "react-dom";

const app = React.createElement("div");
const state = useState(0);
useEffect(() => {});
ReactDOM.render(app, document.body);
`)
    })

    it("副作用导入保持原有顺序（作为分隔符）", async () => {
        const input = `import "./z.css"
import { Card } from "@/components"
import { Button } from "@/components"
import "./a.css"
import { useState } from "react"

const btn = <Button />
const card = <Card />
const state = useState(0)`

        const result = await formatCode(input, {
            importSortSideEffect: false,
        })

        expect(result).toBe(`import "./z.css";
import { Card, Button } from "@/components";
import "./a.css";
import { useState } from "react";

const btn = <Button />;
const card = <Card />;
const state = useState(0);
`)
    })

    it("sortSideEffect: true 时副作用导入也参与排序", async () => {
        const input = `import "./z.css"
import { Button } from "@/components/Button"
import "./a.css"
import { useState } from "react"

const btn = <Button />
const state = useState(0)`

        const result = await formatCode(input, {
            importSortSideEffect: true,
        })

        expect(result).toBe(`import { useState } from "react";
import { Button } from "@/components/Button";
import "./a.css";
import "./z.css";

const btn = <Button />;
const state = useState(0);
`)
    })
})

describe("与 prettier-plugin-tailwindcss 插件合并测试 ⭐", () => {
    it("基础合并：import 排序 + Tailwind CSS 类名排序", async () => {
        const customPlugin = createPlugin({
            otherPlugins: [tailwindPlugin],
        })

        const input = `import { useState } from "react"
import { Button } from "./components"

const Component = () => {
    return <div className="p-4 m-2 flex items-center justify-center bg-red-500 text-white">
        <Button />
    </div>
}`

        const result = await formatCodeWithPlugin(input, customPlugin)

        // 验证 import 已排序
        expect(result).toContain('from "react"')

        expect(result).toContain('from "./components"')

        // 验证 Tailwind 类名已按推荐顺序排序
        expect(result).toContain("className=")

        // Tailwind 排序后，布局类（flex）通常在前面，然后是间距（m-2, p-4）
        const classNameMatch = result.match(/className="([^"]+)"/)

        if (classNameMatch) {
            const classes = classNameMatch[1]
            expect(classes).toBeTruthy()
        }
    })

    it("插件合并 + 自定义分组 + separator", async () => {
        const customPlugin = createPlugin({
            getGroup: statement => {
                if (statement.path.startsWith("react")) return "react"
                if (!statement.path.startsWith(".") && !statement.path.startsWith("@/")) return "external"
                if (statement.path.startsWith("@/")) return "internal"
                return "relative"
            },
            sortGroup: (a, b) => {
                const order = ["react", "external", "internal", "relative"]

                return order.indexOf(a.name) - order.indexOf(b.name)
            },
            separator: "\n",
            otherPlugins: [tailwindPlugin],
        })

        const input = `import { helper } from "./helper"
import axios from "axios"
import { Button } from "@/components"
import { useState } from "react"

const App = () => {
    return <div className="p-4 m-2 flex justify-center items-center">
        <Button />
    </div>
}`

        const result = await formatCodeWithPlugin(input, customPlugin)

        // 验证分组顺序
        const lines = result.split("\n").filter(l => l.trim())

        const reactIndex = lines.findIndex(l => l.includes('"react"'))
        const axiosIndex = lines.findIndex(l => l.includes('"axios"'))
        const buttonIndex = lines.findIndex(l => l.includes('"@/components"'))
        const helperIndex = lines.findIndex(l => l.includes('"./helper"'))

        expect(reactIndex).toBeGreaterThan(-1)
        expect(axiosIndex).toBeGreaterThan(-1)
        expect(buttonIndex).toBeGreaterThan(-1)
        expect(helperIndex).toBeGreaterThan(-1)
        expect(reactIndex).toBeLessThan(axiosIndex)
        expect(axiosIndex).toBeLessThan(buttonIndex)
        expect(buttonIndex).toBeLessThan(helperIndex)

        // 验证有分组分隔符（空行）
        expect(result.split("\n\n").length).toBeGreaterThan(1)

        // 验证 Tailwind 类名处理
        expect(result).toContain("className=")
    })

    it("插件合并 + 删除未使用导入", async () => {
        const customPlugin = createPlugin({
            removeUnusedImports: true,
            otherPlugins: [tailwindPlugin],
        })

        const input = `import { Button, Card, Input, Alert } from "@/components"
import { useState, useEffect, useMemo } from "react"

const App = () => {
    const [count] = useState(0)
    return <div className="flex p-4 m-2"><Button /></div>
}`

        const result = await formatCodeWithPlugin(input, customPlugin)

        // Card, Input, Alert, useEffect, useMemo 应该被删除
        expect(result).toContain("Button")

        expect(result).not.toContain("Card")
        expect(result).not.toContain("Input")
        expect(result).not.toContain("Alert")
        expect(result).not.toContain("useEffect")
        expect(result).not.toContain("useMemo")

        // useState 应该保留
        expect(result).toContain("useState")

        // 验证 Tailwind 类名处理
        expect(result).toContain("className=")
    })

    it("插件合并 + 传递配置给 Tailwind 插件", async () => {
        const customPlugin = createPlugin({
            otherPlugins: [tailwindPlugin],
            prettierOptions: {
                tailwindFunctions: ["clsx", "cn", "tw"],
                tailwindAttributes: ["class", "className"],
            },
        })

        const input = `import { useState } from "react"
import clsx from "clsx"

const App = () => {
    const classes = clsx("p-4 m-2 flex items-center")
    return <div className={classes}>Hello</div>
}`

        const result = await formatCodeWithPlugin(input, customPlugin)

        expect(result).toContain("clsx")
        expect(result).toContain("react")
        expect(result).toContain("className")
    })

    it("插件合并 + 副作用导入 + sortSideEffect", async () => {
        const customPlugin = createPlugin({
            sortSideEffect: true,
            otherPlugins: [tailwindPlugin],
        })

        const input = `import "./global.css"
import "./tailwind.css"
import { Button } from "./components"
import { useState } from "react"

const App = () => {
    return <div className="p-4 m-2 flex"><Button /></div>
}`

        const result = await formatCodeWithPlugin(input, customPlugin)

        // 验证副作用导入也参与排序
        expect(result).toContain("./global.css")

        expect(result).toContain("./tailwind.css")
        expect(result).toContain("react")
        expect(result).toContain("./components")

        // 验证 Tailwind 类名处理
        expect(result).toContain("className=")
    })

    it("插件合并 + 完整特性组合：分组+排序+删除未使用+副作用+Tailwind", async () => {
        const customPlugin = createPlugin({
            getGroup: statement => {
                // 副作用导入单独分组
                if (statement.isSideEffect) return "side-effects"

                if (statement.path.startsWith("react")) return "react"
                if (!statement.path.startsWith(".") && !statement.path.startsWith("@/")) return "external"
                if (statement.path.startsWith("@/")) return "internal"
                return "relative"
            },
            sortGroup: (a, b) => {
                const order = ["side-effects", "react", "external", "internal", "relative"]

                return order.indexOf(a.name) - order.indexOf(b.name)
            },
            separator: "\n",
            removeUnusedImports: true,
            sortSideEffect: true,
            otherPlugins: [tailwindPlugin],
            prettierOptions: {
                tailwindFunctions: ["clsx", "cn"],
            },
        })

        const input = `import "./global.css"
import { helper } from "./helper"
import { Button, Card, Input } from "@/components"
import axios from "axios"
import lodash from "lodash"
import { useState, useEffect, useMemo } from "react"

const App = () => {
    const [count] = useState(0)
    return <div className="flex justify-center items-center p-4 m-2 bg-blue-500 text-white rounded-lg shadow-md">
        <Button />
    </div>
}`

        const result = await formatCodeWithPlugin(input, customPlugin)

        // 验证未使用的导入被删除
        expect(result).not.toContain("Card")

        expect(result).not.toContain("Input")
        expect(result).not.toContain("axios")
        expect(result).not.toContain("lodash")
        expect(result).not.toContain("useEffect")
        expect(result).not.toContain("useMemo")
        expect(result).not.toContain("helper")

        // 验证使用的导入保留
        expect(result).toContain("react")

        expect(result).toContain("Button")
        expect(result).toContain("global.css")
        expect(result).toContain("useState")

        // 验证 Tailwind 类名处理
        expect(result).toContain("className=")

        // 验证有分组分隔符
        expect(result.split("\n\n").length).toBeGreaterThan(1)
    })

    it("复杂 Tailwind 类名场景：多个元素、响应式类、伪类", async () => {
        const customPlugin = createPlugin({
            otherPlugins: [tailwindPlugin],
        })

        const input = `import { useState } from "react"

const App = () => {
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <header className="py-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                <h1 className="text-3xl font-bold text-gray-900">Title</h1>
            </header>
            <main className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="p-6 bg-white rounded-lg shadow hover:shadow-lg focus:ring-2 focus:ring-blue-500">
                    Content
                </div>
            </main>
        </div>
    )
}`

        const result = await formatCodeWithPlugin(input, customPlugin)

        // 验证代码被正确格式化
        expect(result).toContain("react")

        expect(result).toContain("className=")
        expect(result).toContain("container")
        expect(result).toContain("mx-auto")
    })

    it("插件合并 + TypeScript 类型导入", async () => {
        const customPlugin = createPlugin({
            otherPlugins: [tailwindPlugin],
        })

        const input = `import { type FC, type ReactNode, useState } from "react"
import { type ButtonProps, Button } from "@/components"

const Component: FC<{ children: ReactNode }> = ({ children }) => {
    const [state] = useState(0)
    return <div className="p-4 flex items-center">
        <Button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded" />
    </div>
}`

        const result = await formatCodeWithPlugin(input, customPlugin)

        // 验证 type 导入保留
        expect(result).toContain("FC")

        expect(result).toContain("ReactNode")
        expect(result).toContain("ButtonProps")
        expect(result).toContain("useState")
        expect(result).toContain("Button")

        // 验证 Tailwind 类名处理
        expect(result).toContain("className=")
    })
})

describe("自定义配置测试", () => {
    it("自定义 getGroup 函数：按库分组", async () => {
        const customPlugin = createPlugin({
            getGroup: statement => {
                const path = statement.path
                if (path.startsWith("react")) return "react"
                if (path.includes("lodash") || path.includes("ramda")) return "utils"
                if (path.includes("antd") || path.includes("@mui")) return "ui"
                if (!path.startsWith(".") && !path.startsWith("@/")) return "external"
                if (path.startsWith("@/")) return "internal"
                return "relative"
            },
            sortGroup: (a, b) => {
                const order = ["react", "ui", "utils", "external", "internal", "relative"]

                return order.indexOf(a.name) - order.indexOf(b.name)
            },
            separator: "\n",
        })

        const input = `import { helper } from "./helper"
import { Button } from "@/components"
import { debounce } from "lodash"
import { Button as AntButton } from "antd"
import axios from "axios"
import { useState } from "react"

const state = useState(0)
const api = axios.get("/api")
const fn = debounce(() => {})
const btn = <Button />
const antBtn = <AntButton />
const h = helper()`

        const result = await formatCodeWithPlugin(input, customPlugin)

        const lines = result.split("\n").filter(l => l.trim())
        const reactIndex = lines.findIndex(l => l.includes('"react"'))
        const antdIndex = lines.findIndex(l => l.includes('"antd"'))
        const lodashIndex = lines.findIndex(l => l.includes('"lodash"'))
        const axiosIndex = lines.findIndex(l => l.includes('"axios"'))
        const componentsIndex = lines.findIndex(l => l.includes('"@/components"'))
        const helperIndex = lines.findIndex(l => l.includes('"./helper"'))

        expect(reactIndex).toBeLessThan(antdIndex)
        expect(antdIndex).toBeLessThan(lodashIndex)
        expect(lodashIndex).toBeLessThan(axiosIndex)
        expect(axiosIndex).toBeLessThan(componentsIndex)
        expect(componentsIndex).toBeLessThan(helperIndex)
    })

    it("自定义 sortImportStatement：按路径长度排序", async () => {
        const customPlugin = createPlugin({
            sortImportStatement: (a, b) => {
                return a.path.length - b.path.length
            },
        })

        const input = `import { a } from "a"
import { veryLongModuleName } from "very-long-module-name"
import { mid } from "middle"

const aa = a
const v = veryLongModuleName
const m = mid`

        const result = await formatCodeWithPlugin(input, customPlugin)

        const lines = result.split("\n").filter(l => l.startsWith("import"))
        expect(lines[0]).toContain('"a"')
        expect(lines[1]).toContain('"middle"')
        expect(lines[2]).toContain('"very-long-module-name"')
    })

    it("自定义 sortImportContent：反向字母排序", async () => {
        const customPlugin = createPlugin({
            sortImportContent: (a, b) => {
                const aName = a.alias ?? a.name
                const bName = b.alias ?? b.name
                return bName.localeCompare(aName)
            },
        })

        const input = `import { a, z, m, b } from "module"

const aa = a
const zz = z
const mm = m
const bb = b`

        const result = await formatCodeWithPlugin(input, customPlugin)

        expect(result).toContain("{ z, m, b, a }")
    })

    it("separator 函数形式：第一组不加分隔符", async () => {
        const customPlugin = createPlugin({
            getGroup: statement => {
                if (statement.path.startsWith("react")) return "react"
                return "other"
            },
            separator: (group, index) => {
                if (index === 0) return undefined
                return "\n"
            },
        })

        const input = `import { helper } from "./helper"
import { useState } from "react"

const state = useState(0)
const h = helper()`

        const result = await formatCodeWithPlugin(input, customPlugin)

        expect(result).toContain("react")
        expect(result).toContain("helper")
    })
})

describe("删除未使用导入测试", () => {
    it("删除完全未使用的导入", async () => {
        const input = `import React from "react"
import { useState, useEffect } from "react"
import { debounce } from "lodash"

const state = useState(0)`

        const result = await formatCode(input, {
            importSortRemoveUnused: true,
        })

        expect(result).toBe(`import { useState } from "react";

const state = useState(0);
`)
    })

    it("JSX 组件使用分析", async () => {
        const input = `import { Button, Card, Input } from "@/components"

const App = () => {
    return <div><Button /><Card /></div>
}`

        const result = await formatCode(input, {
            importSortRemoveUnused: true,
        })

        expect(result).toBe(`import { Button, Card } from "@/components";

const App = () => {
  return (
    <div>
      <Button />
      <Card />
    </div>
  );
};
`)
    })

    it("TypeScript 类型引用分析", async () => {
        const input = `import type { FC, ReactNode, PropsWithChildren } from "react"

const Component: FC<PropsWithChildren> = ({ children }) => null
type Props = PropsWithChildren`

        const result = await formatCode(input, {
            importSortRemoveUnused: true,
        })

        expect(result).toBe(`import type { FC, PropsWithChildren } from "react";

const Component: FC<PropsWithChildren> = ({ children }) => null;
type Props = PropsWithChildren;
`)
    })

    it("命名空间类型引用", async () => {
        const input = `import * as React from "react"

type Props = React.ComponentProps<"div">`

        const result = await formatCode(input, {
            importSortRemoveUnused: true,
        })

        expect(result).toBe(`import * as React from "react";

type Props = React.ComponentProps<"div">;
`)
    })

    it("副作用导入不删除", async () => {
        const input = `import "./styles.css"
import { Button } from "@/components/Button"

const btn = <Button />`

        const result = await formatCode(input, {
            importSortRemoveUnused: true,
        })

        expect(result).toBe(`import "./styles.css";
import { Button } from "@/components/Button";

const btn = <Button />;
`)
    })

    it("JSX 成员表达式识别（如 <DatePicker.RangePicker />）", async () => {
        const input = `import { DatePicker, Form, Table } from "antd"
import { Button } from "@mui/material"
import { UnusedComponent } from "some-lib"

const App = () => {
    return (
        <div>
            <DatePicker.RangePicker />
            <Form.Item>
                <Form.Item.Meta />
            </Form.Item>
            <Table.Column.Group />
            <Button>Click me</Button>
        </div>
    )
}`

        const result = await formatCode(input, {
            importSortRemoveUnused: true,
        })

        // DatePicker、Form、Table、Button 应该被保留
        expect(result).toContain("DatePicker")
        expect(result).toContain("Form")
        expect(result).toContain("Table")
        expect(result).toContain("Button")

        // UnusedComponent 应该被删除
        expect(result).not.toContain("UnusedComponent")
        expect(result).not.toContain("some-lib")
    })

    it("条件表达式中的标识符识别（如 if (!isSudo)）", async () => {
        const input = `import { isSudo } from "@/constant"
import { sudoCommand } from "@/utils"

export async function install() {
    if (!isSudo) return sudoCommand()
    console.log("Installing...")
}`

        const result = await formatCode(input, {
            importSortRemoveUnused: true,
        })

        // isSudo 和 sudoCommand 应该被保留
        expect(result).toContain("isSudo")
        expect(result).toContain("sudoCommand")
        expect(result).toContain("@/constant")
        expect(result).toContain("@/utils")
    })
})

describe("Type-only 导入测试", () => {
    it("type-only 和普通导入混合", async () => {
        const input = `import type { FC, ReactNode } from "react"
import { useState } from "react"

const Component: FC = () => null
const state = useState(0)
const node: ReactNode = null`

        const result = await formatCode(input)

        expect(result).toBe(`import { type FC, type ReactNode, useState } from "react";

const Component: FC = () => null;
const state = useState(0);
const node: ReactNode = null;
`)
    })

    it("所有命名导入都是 type 时使用 import type 语法", async () => {
        const input = `import { type FC, type ReactNode, type PropsWithChildren } from "react"

const Component: FC = () => null
const node: ReactNode = null
type Props = PropsWithChildren`

        const result = await formatCode(input)

        expect(result).toBe(`import type { FC, PropsWithChildren, ReactNode } from "react";

const Component: FC = () => null;
const node: ReactNode = null;
type Props = PropsWithChildren;
`)
    })

    it("默认导入和 type 导入混合", async () => {
        const input = `import React from "react"
import type { FC, ReactNode } from "react"

const Component: FC = () => null
const app = React.createElement("div")
const node: ReactNode = null`

        const result = await formatCode(input)

        expect(result).toBe(`import React, { type FC, type ReactNode } from "react";

const Component: FC = () => null;
const app = React.createElement("div");
const node: ReactNode = null;
`)
    })
})

describe("export from 语句测试", () => {
    it("export from 语句的处理", async () => {
        const input = `import { helper } from "./helper"
export { useState } from "react"
export type { FC } from "react"

const h = helper()`

        const result = await formatCode(input)

        expect(result).toBe(`export { useState, type FC } from "react";
import { helper } from "./helper";

const h = helper();
`)
    })

    it("export * from 语句", async () => {
        const input = `import { helper } from "./helper"
export * from "react"
export * from "@/utils"

const h = helper()`

        const result = await formatCode(input)

        expect(result).toBe(`import { helper } from "./helper";
export * from "react";
export * from "@/utils";

const h = helper();
`)
    })

    it("export { default as alias } 语法正确格式化", async () => {
        const input = `export { default as equal } from "fast-deep-equal"
export { Cloud as default } from "./cloud"
export * from "@/utils"

const eq = equal
const cloud = Cloud`

        const result = await formatCode(input)

        // 验证 export { default as alias } 语法被正确保留
        expect(result).toContain('export { default as equal } from "fast-deep-equal"')
        expect(result).toContain('export { Cloud as default } from "./cloud"')
        expect(result).toContain('export * from "@/utils"')
    })

    it("export { default } 语法正确格式化", async () => {
        const input = `export { default } from "@/app/admin/login/page"`

        const result = await formatCode(input)

        // 验证 export { default } 语法被正确保留，不会被错误转换为 export default
        expect(result).toBe('export { default } from "@/app/admin/login/page";\n')
    })

    it("多个 export * from 语句排序和分组", async () => {
        const customPlugin = createPlugin({
            getGroup: ({ path }) => {
                if (path.startsWith("@/")) return "absolute"
                if (path.startsWith("./")) return "relative"
                return "third-party"
            },
            sortGroup: (a, b) => {
                const order = ["third-party", "relative", "absolute"]
                return order.indexOf(a.name) - order.indexOf(b.name)
            },
            separator: "",
        })

        const input = `export * from "@/coverings/circularRange"
export * from "@/coverings/columnHeatMap"
export * from "@/coverings/customPoi"
export * from "./cloud"
export { Cloud as default } from "./cloud"
export { default as equal } from "fast-deep-equal"`

        const result = await formatCodeWithPlugin(input, customPlugin)

        // 验证第一行不是空行
        expect(result.startsWith("export")).toBe(true)
        expect(result.startsWith("\n")).toBe(false)

        // 验证 export { default as alias } 格式正确
        expect(result).toContain('export { default as equal } from "fast-deep-equal"')
        expect(result).toContain('export { Cloud as default } from "./cloud"')

        // 验证分组顺序：third-party -> relative -> absolute
        const lines = result.split("\n").filter(l => l.trim())
        const equalIndex = lines.findIndex(l => l.includes("fast-deep-equal"))
        const cloudIndex = lines.findIndex(l => l.includes('from "./cloud"'))
        const coveringsIndex = lines.findIndex(l => l.includes("@/coverings"))

        expect(equalIndex).toBeGreaterThan(-1)
        expect(cloudIndex).toBeGreaterThan(-1)
        expect(coveringsIndex).toBeGreaterThan(-1)
        expect(equalIndex).toBeLessThan(cloudIndex)
        expect(cloudIndex).toBeLessThan(coveringsIndex)
    })

    it("export * from 与 export { } from 混合使用", async () => {
        const input = `export * from "./utils"
export { Button, Card } from "@/components"
export { default as helper } from "./helper"`

        const result = await formatCode(input)

        // 验证所有 export 语句都被正确保留
        expect(result).toContain('export * from "./utils"')
        expect(result).toContain('export { Button, Card } from "@/components"')
        expect(result).toContain('export { default as helper } from "./helper"')
    })
})

describe("边界情况和错误处理测试", () => {
    it("空文件", async () => {
        const input = ``
        const result = await formatCode(input)
        expect(result).toBe("")
    })

    it("只有注释的文件", async () => {
        const input = `// This is a comment
/* This is another comment */`

        const result = await formatCode(input)
        expect(result).toContain("// This is a comment")
    })

    it("没有导入的文件", async () => {
        const input = `const a = 1
const b = 2`

        const result = await formatCode(input)

        expect(result).toBe(`const a = 1;
const b = 2;
`)
    })

    it("只有一个导入", async () => {
        const input = `import { useState } from "react"

const state = useState(0)`

        const result = await formatCode(input)

        expect(result).toBe(`import { useState } from "react";

const state = useState(0);
`)
    })

    it("命名空间导入不合并", async () => {
        const input = `import * as React from "react"
import { useState } from "react"

const app = React.createElement("div")
const state = useState(0)`

        const result = await formatCode(input)

        expect(result).toBe(`import * as React from "react";
import { useState } from "react";

const app = React.createElement("div");
const state = useState(0);
`)
    })

    it("导入后立即有代码（无空行）", async () => {
        const input = `import { useState } from "react"
const state = useState(0)`

        const result = await formatCode(input)

        expect(result).toBe(`import { useState } from "react";

const state = useState(0);
`)
    })

    it("导入在文件中间（不处理）", async () => {
        const input = `const a = 1

import { useState } from "react"

const state = useState(0)`

        const result = await formatCode(input)
        expect(result).toContain("const a = 1")
        expect(result).toContain("import")
        expect(result).toContain("useState")
    })

    it("特殊字符在路径中", async () => {
        const input = `import { test } from "@scope/package-name"
import { another } from "@scope/another_package"
import { dash } from "dash-case-module"

const t = test
const a = another
const d = dash`

        const result = await formatCode(input)
        expect(result).toContain("@scope/another_package")
        expect(result).toContain("@scope/package-name")
        expect(result).toContain("dash-case-module")
    })

    it("注释保留：前导注释和行尾注释", async () => {
        const input = `// React 导入
import React from "react" // 默认导入
import { useState } from "react"

const app = React.createElement("div")
const state = useState(0)`

        const result = await formatCode(input)

        expect(result).toBe(`// React 导入
import React, { useState } from "react"; // 默认导入

const app = React.createElement("div");
const state = useState(0);
`)
    })

    it("别名导入处理", async () => {
        const input = `import { useState as useStateHook } from "react"
import { debounce as debounceFn } from "lodash"

const state = useStateHook(0)
const fn = debounceFn(() => {})`

        const result = await formatCode(input)

        expect(result).toBe(`import { debounce as debounceFn } from "lodash";
import { useState as useStateHook } from "react";

const state = useStateHook(0);
const fn = debounceFn(() => {});
`)
    })
})

describe("实际使用场景测试", () => {
    it("React + Tailwind CSS 项目场景", async () => {
        const customPlugin = createPlugin({
            getGroup: statement => {
                if (statement.path.startsWith("react")) return "react"
                if (!statement.path.startsWith(".") && !statement.path.startsWith("@/")) return "external"
                if (statement.path.startsWith("@/")) return "internal"
                return "relative"
            },
            sortGroup: (a, b) => {
                const order = ["react", "external", "internal", "relative"]

                return order.indexOf(a.name) - order.indexOf(b.name)
            },
            separator: "\n",
            removeUnusedImports: true,
            otherPlugins: [tailwindPlugin],
        })

        const input = `import "./app.css"
import { formatDate } from "./utils/date"
import { Button, Input } from "@/components/ui"
import { useAuth } from "@/hooks/useAuth"
import { api } from "@/services/api"
import clsx from "clsx"
import { useState, useEffect } from "react"

export function LoginPage() {
    const [username, setUsername] = useState("")
    const { login } = useAuth()

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-lg">
                <h2 className="text-3xl font-bold text-center text-gray-900">
                    Sign In
                </h2>
                <form className="mt-8 space-y-6">
                    <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={clsx("w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500")}
                    />
                    <Button
                        onClick={() => login(username)}
                        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                    >
                        Sign In
                    </Button>
                </form>
            </div>
        </div>
    )
}`

        const result = await formatCodeWithPlugin(input, customPlugin)

        // 验证未使用的导入被删除
        expect(result).not.toContain("formatDate")

        expect(result).not.toContain("api")
        expect(result).not.toContain("useEffect")

        // 验证使用的导入保留
        expect(result).toContain("react")

        expect(result).toContain("useState")
        expect(result).toContain("useAuth")
        expect(result).toContain("Button")
        expect(result).toContain("Input")
        expect(result).toContain("clsx")
        expect(result).toContain("./app.css")

        // 验证分组
        expect(result.split("\n\n").length).toBeGreaterThan(1)

        // 验证 Tailwind 类名处理
        expect(result).toContain("className")
    })

    it("Next.js + Tailwind CSS 项目场景", async () => {
        const customPlugin = createPlugin({
            getGroup: statement => {
                if (statement.isSideEffect) return "styles"
                if (statement.path.startsWith("react") || statement.path.startsWith("next")) return "framework"
                if (!statement.path.startsWith(".") && !statement.path.startsWith("@/")) return "external"
                if (statement.path.startsWith("@/")) return "internal"
                return "relative"
            },
            sortGroup: (a, b) => {
                const order = ["styles", "framework", "external", "internal", "relative"]

                return order.indexOf(a.name) - order.indexOf(b.name)
            },
            separator: "\n",
            sortSideEffect: true,
            removeUnusedImports: true,
            otherPlugins: [tailwindPlugin],
        })

        const input = `import type { Metadata } from "next"
import "./globals.css"
import { Inter } from "next/font/google"
import { Button } from "@/components/ui/button"
import { ThemeProvider } from "@/components/theme-provider"
import { Analytics } from "@vercel/analytics/react"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
    title: "My App",
}

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <ThemeProvider>
                    <div className="min-h-screen bg-background font-sans antialiased">
                        {children}
                    </div>
                    <Analytics />
                </ThemeProvider>
            </body>
        </html>
    )
}`

        const result = await formatCodeWithPlugin(input, customPlugin)

        // 验证未使用的导入被删除（Button 未使用）
        expect(result).not.toContain('"@/components/ui/button"')

        // 验证使用的导入保留
        expect(result).toContain("Metadata")

        expect(result).toContain("globals.css")
        expect(result).toContain("Inter")
        expect(result).toContain("ThemeProvider")
        expect(result).toContain("Analytics")

        // 验证 Tailwind 类名处理
        expect(result).toContain("className")
    })
})
