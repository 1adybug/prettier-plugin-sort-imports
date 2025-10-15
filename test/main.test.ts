import { describe, expect, it } from "bun:test"
import { format } from "prettier"
import plugin, { createPlugin } from "../dist/index.js"

/** 格式化代码的辅助函数 */
async function formatCode(code: string, config?: any): Promise<string> {
    return await format(code, {
        parser: "typescript",
        plugins: [plugin],
        ...config,
    })
}

describe("导入合并测试", () => {
    it("合并同一模块的多次导入", async () => {
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

    it("副作用导入不合并", async () => {
        const input = `import "./a.css"
import { Button } from "@/components/Button"
import "./b.css"

const btn = <Button />`

        const result = await formatCode(input)

        expect(result).toBe(`import "./a.css";
import { Button } from "@/components/Button";
import "./b.css";

const btn = <Button />;
`)
    })
})

describe("导入排序测试", () => {
    it("按照模块、别名、相对路径排序", async () => {
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

    it("type 导入优先排序", async () => {
        const input = `import { Button, type ButtonProps, Card, type CardProps } from "@/components"

const btn: ButtonProps = {}
const card: CardProps = {}
const b = <Button />
const c = <Card />`

        const result = await formatCode(input)

        // type 类型在前，然后是普通导入
        expect(result)
            .toBe(`import { type ButtonProps, type CardProps, Button, Card } from "@/components";

const btn: ButtonProps = {};
const card: CardProps = {};
const b = <Button />;
const c = <Card />;
`)
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

    it("部分未使用的导入只删除未使用部分", async () => {
        const input = `import { useState, useEffect, useMemo } from "react"

const state = useState(0)
const memo = useMemo(() => {}, [])`

        const result = await formatCode(input, {
            importSortRemoveUnused: true,
        })

        expect(result).toBe(`import { useMemo, useState } from "react";

const state = useState(0);
const memo = useMemo(() => {}, []);
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
})

describe("Type-only 导入测试", () => {
    it("type-only 和普通导入混合", async () => {
        const input = `import type { FC, ReactNode } from "react"
import { useState } from "react"

const Component: FC = () => null
const state = useState(0)
const node: ReactNode = null`

        const result = await formatCode(input)

        // type 类型在前，然后是普通导入
        expect(result)
            .toBe(`import { type FC, type ReactNode, useState } from "react";

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

        expect(result)
            .toBe(`import type { FC, PropsWithChildren, ReactNode } from "react";

const Component: FC = () => null;
const node: ReactNode = null;
type Props = PropsWithChildren;
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

        // export 语句在前，import 语句在后
        // export from 中的 type FC 会被处理为普通导出
        expect(result).toBe(`export { useState, FC } from "react";
import { helper } from "./helper";

const h = helper();
`)
    })
})

describe("导入别名测试", () => {
    it("导入别名处理", async () => {
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

describe("注释处理测试", () => {
    it("前导注释和行尾注释", async () => {
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
})

describe("副作用导入排序测试", () => {
    it("sortSideEffect: false 时副作用导入作为分隔符", async () => {
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

        // 副作用导入保持原有顺序，非副作用导入在每个块内排序（按字母顺序）
        expect(result).toBe(`import "./z.css";
import { Card, Button } from "@/components";
import "./a.css";
import { useState } from "react";

const btn = <Button />;
const card = <Card />;
const state = useState(0);
`)
    })

    it("sortSideEffect: true 时所有导入都排序", async () => {
        const input = `import "./z.css"
import { Button } from "@/components/Button"
import "./a.css"
import { useState } from "react"

const btn = <Button />
const state = useState(0)`

        const result = await formatCode(input, {
            importSortSideEffect: true,
        })

        // 所有导入按照类型排序：模块 > 别名 > 相对路径
        expect(result).toBe(`import { useState } from "react";
import { Button } from "@/components/Button";
import "./a.css";
import "./z.css";

const btn = <Button />;
const state = useState(0);
`)
    })
})

describe("配置文件路径测试", () => {
    it("使用 sortImportsConfigPath 加载 .js 配置文件", async () => {
        const input = `import { useState } from "react"
import { Button } from "@/components/Button"
import axios from "axios"
import "./style.css"

const btn = <Button />
const state = useState(0)
const api = axios.get("/api")`

        const result = await format(input, {
            parser: "typescript",
            plugins: [plugin],
            sortImportsConfigPath: "./test/test-config.js",
        })

        // 按照配置文件的分组顺序：react > external > internal > relative
        expect(result).toBe(`import { useState } from "react";

import axios from "axios";

import { Button } from "@/components/Button";

import "./style.css";

const btn = <Button />;
const state = useState(0);
const api = axios.get("/api");
`)
    })

    it("使用 sortImportsConfigPath 加载 .cjs 配置文件", async () => {
        const input = `import { ref } from "vue"
import { Card } from "@/components/Card"
import lodash from "lodash"
import "./app.css"

const count = ref(0)
const card = Card`

        const result = await format(input, {
            parser: "typescript",
            plugins: [plugin],
            sortImportsConfigPath: "./test/test-config.cjs",
        })

        // 按照 .cjs 配置文件的分组顺序：vue > external > internal > relative
        // separator 是 "\n\n"
        expect(result).toBe(`import { ref } from "vue";

import lodash from "lodash";

import { Card } from "@/components/Card";

import "./app.css";

const count = ref(0);
const card = Card;
`)
    })
})
