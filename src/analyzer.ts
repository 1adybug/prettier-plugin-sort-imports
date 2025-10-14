import { parse } from "@babel/parser"
import traverse from "@babel/traverse"
import { NodePath } from "@babel/traverse"
import {
    ExportNamedDeclaration,
    Identifier,
    JSXIdentifier,
    TSTypeReference,
} from "@babel/types"
import {
    ImportContent,
    ImportStatement,
} from "./types" /** 分析代码中使用的标识符 */

export function analyzeUsedIdentifiers(code: string): Set<string> {
    const usedIdentifiers = new Set<string>()

    try {
        const ast = parse(code, {
            sourceType: "module",
            plugins: ["typescript", "jsx"],
            errorRecovery: true,
        })

        // 遍历 AST，收集所有使用的标识符
        traverse(ast, {
            // 处理普通标识符
            Identifier(path: NodePath<Identifier>) {
                const node = path.node
                const parent = path.parent

                // 跳过声明的标识符（如函数参数、变量声明等）
                if (path.isBindingIdentifier()) {
                    return
                }

                // 跳过对象属性的 key（除非是计算属性）
                if (
                    parent?.type === "ObjectProperty" &&
                    parent.key === node &&
                    !parent.computed
                ) {
                    return
                }

                usedIdentifiers.add(node.name)
            },

            // 处理 JSX 标识符
            JSXIdentifier(path: NodePath<JSXIdentifier>) {
                const node = path.node

                // JSX 开始标签和结束标签
                if (
                    path.parent?.type === "JSXOpeningElement" ||
                    path.parent?.type === "JSXClosingElement"
                ) {
                    usedIdentifiers.add(node.name)
                }
            },

            // 处理 TypeScript 类型引用
            TSTypeReference(path: NodePath<TSTypeReference>) {
                const node = path.node
                if (node.typeName.type === "Identifier") {
                    usedIdentifiers.add(node.typeName.name)
                } else if (node.typeName.type === "TSQualifiedName") {
                    // 处理 A.B.C 这种类型引用，只添加最左边的标识符
                    let current: any = node.typeName
                    while (current.type === "TSQualifiedName") {
                        current = current.left
                    }
                    if (current.type === "Identifier") {
                        usedIdentifiers.add(current.name)
                    }
                }
            },

            // 处理 export 语句中的标识符
            ExportNamedDeclaration(path: NodePath<ExportNamedDeclaration>) {
                const node = path.node
                // 如果是 export { a, b } 这种形式，需要收集使用的标识符
                if (!node.source && node.specifiers) {
                    for (const specifier of node.specifiers) {
                        if (specifier.type === "ExportSpecifier") {
                            if (specifier.local.type === "Identifier") {
                                usedIdentifiers.add(specifier.local.name)
                            }
                        }
                    }
                }
            },
        })
    } catch (error) {
        console.error("Failed to analyze used identifiers:", error)
    }

    return usedIdentifiers
}

/** 过滤未使用的导入内容 */
export function filterUnusedImports(
    importStatement: ImportStatement,
    usedIdentifiers: Set<string>,
): ImportStatement {
    // 副作用导入和导出语句不过滤
    if (importStatement.isSideEffect || importStatement.isExport) {
        return importStatement
    }

    // 过滤导入内容
    const usedContents: ImportContent[] = []

    for (const content of importStatement.importContents) {
        // 获取实际使用的名称（如果有别名用别名，否则用原名称）
        const usedName = content.alias ?? content.name

        // 对于默认导入和命名空间导入，使用别名
        if (content.name === "default" || content.name === "*") {
            if (content.alias && usedIdentifiers.has(content.alias)) {
                usedContents.push(content)
            }
        } else {
            // 对于命名导入，检查使用的名称
            if (usedIdentifiers.has(usedName)) {
                usedContents.push(content)
            }
        }
    }

    return {
        ...importStatement,
        importContents: usedContents,
        // 如果所有导入内容都被删除了，变成副作用导入
        isSideEffect: usedContents.length === 0,
    }
}

/** 从导入语句列表中移除未使用的导入 */
export function removeUnusedImportsFromStatements(
    importStatements: ImportStatement[],
    code: string,
): ImportStatement[] {
    // 分析代码中使用的标识符
    const usedIdentifiers = analyzeUsedIdentifiers(code)

    // 过滤每个导入语句
    const filteredStatements: ImportStatement[] = []

    for (const statement of importStatements) {
        const filteredStatement = filterUnusedImports(
            statement,
            usedIdentifiers,
        )

        // 如果过滤后变成了副作用导入，但原本不是副作用导入，说明所有导入都未使用
        // 这种情况下可以选择保留或删除整个导入语句
        // 这里我们选择删除整个导入语句
        if (
            !statement.isSideEffect &&
            filteredStatement.isSideEffect &&
            filteredStatement.importContents.length === 0
        ) {
            continue
        }

        filteredStatements.push(filteredStatement)
    }

    return filteredStatements
}
