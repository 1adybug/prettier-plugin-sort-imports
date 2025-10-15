import { parse } from "@babel/parser"
import {
    Comment,
    ExportAllDeclaration,
    ExportNamedDeclaration,
    ImportDeclaration,
} from "@babel/types"
import { ImportContent, ImportStatement } from "./types"

/** 解析导入语句 */

export function parseImports(code: string): ImportStatement[] {
    const ast = parse(code, {
        sourceType: "module",
        plugins: ["typescript", "jsx"],
        errorRecovery: true, // 允许解析有语法错误的代码
        attachComment: true, // 将注释附加到 AST 节点
    })

    const importStatements: ImportStatement[] = []
    const { body } = ast.program

    // 跟踪已使用的注释，避免重复
    const usedComments = new Set<Comment>()

    // 只处理文件开头的连续导入/导出语句块
    for (const node of body) {
        if (
            node.type === "ImportDeclaration" ||
            (node.type === "ExportNamedDeclaration" && node.source) ||
            node.type === "ExportAllDeclaration"
        ) {
            const statement = parseImportNode(
                node,
                ast.comments ?? [],
                usedComments,
            )
            importStatements.push(statement)
        } else {
            // 遇到非导入/导出语句，停止处理
            break
        }
    }

    return importStatements
}

/** 解析单个导入节点 */
function parseImportNode(
    node: ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration,
    comments: Comment[],
    usedComments: Set<Comment>,
): ImportStatement {
    const isExport = node.type !== "ImportDeclaration"
    const source = node.source?.value ?? ""

    // 获取节点所在的行号和位置
    const nodeStartLine = node.loc?.start.line ?? 0
    const nodeEndLine = node.loc?.end.line ?? 0
    const nodeStart = node.start ?? 0
    let nodeEnd = node.end ?? 0

    // 使用 Babel 自动附加的注释
    const leadingComments: string[] = []
    const trailingComments: string[] = []
    let start = nodeStart

    // 处理前导注释
    if (node.leadingComments) {
        for (const comment of node.leadingComments) {
            if (!usedComments.has(comment)) {
                if (comment.type === "CommentLine") {
                    leadingComments.push(`//${comment.value}`)
                } else if (comment.type === "CommentBlock") {
                    leadingComments.push(`/*${comment.value}*/`)
                }

                const commentStart = comment.start ?? 0
                if (commentStart < start) {
                    start = commentStart
                }

                usedComments.add(comment)
            }
        }
    }

    // 处理行尾注释
    // 只保留与节点在同一行的注释作为 trailing comments
    if (node.trailingComments) {
        for (const comment of node.trailingComments) {
            if (!usedComments.has(comment)) {
                // 检查注释是否与节点在同一行
                const commentLoc = comment.loc
                const nodeLoc = node.loc
                const isSameLine =
                    commentLoc &&
                    nodeLoc &&
                    commentLoc.start.line === nodeLoc.end.line

                if (isSameLine) {
                    if (comment.type === "CommentLine") {
                        trailingComments.push(`//${comment.value}`)
                    } else if (comment.type === "CommentBlock") {
                        trailingComments.push(`/*${comment.value}*/`)
                    }

                    const commentEnd = comment.end ?? 0
                    if (commentEnd > nodeEnd) {
                        nodeEnd = commentEnd
                    }

                    usedComments.add(comment)
                }
                // 不在同一行的注释不标记为 used，让下一个节点的 leadingComments 来处理
            }
        }
    }

    const end = nodeEnd

    // 处理 import 语句
    if (node.type === "ImportDeclaration") {
        const isTypeOnlyImport = node.importKind === "type"
        const importContents = parseImportSpecifiers(node, isTypeOnlyImport)
        const isSideEffect = importContents.length === 0

        return {
            path: source,
            isExport: false,
            isSideEffect,
            importContents,
            leadingComments:
                leadingComments.length > 0 ? leadingComments : undefined,
            trailingComments:
                trailingComments.length > 0 ? trailingComments : undefined,
            start,
            end,
        }
    }

    // 处理 export * from 语句
    if (node.type === "ExportAllDeclaration") {
        return {
            path: source,
            isExport: true,
            isSideEffect: false,
            importContents: [],
            leadingComments:
                leadingComments.length > 0 ? leadingComments : undefined,
            trailingComments:
                trailingComments.length > 0 ? trailingComments : undefined,
            start,
            end,
        }
    }

    // 处理 export { ... } from 语句
    const isTypeOnlyExport = node.exportKind === "type"
    const importContents = parseExportSpecifiers(node, isTypeOnlyExport)

    return {
        path: source,
        isExport: true,
        isSideEffect: false,
        importContents,
        leadingComments:
            leadingComments.length > 0 ? leadingComments : undefined,
        trailingComments:
            trailingComments.length > 0 ? trailingComments : undefined,
        start,
        end,
    }
}

/** 解析导入说明符 */
function parseImportSpecifiers(
    node: ImportDeclaration,
    isTypeOnlyImport: boolean = false,
): ImportContent[] {
    const contents: ImportContent[] = []

    for (const specifier of node.specifiers) {
        // 解析 specifier 的注释
        const leadingComments: string[] = []
        const trailingComments: string[] = []

        // 处理前导注释
        if (specifier.leadingComments) {
            for (const comment of specifier.leadingComments) {
                if (comment.type === "CommentLine") {
                    leadingComments.push(`//${comment.value}`)
                } else if (comment.type === "CommentBlock") {
                    leadingComments.push(`/*${comment.value}*/`)
                }
            }
        }

        // 处理行尾注释
        if (specifier.trailingComments) {
            for (const comment of specifier.trailingComments) {
                if (comment.type === "CommentLine") {
                    trailingComments.push(`//${comment.value}`)
                } else if (comment.type === "CommentBlock") {
                    trailingComments.push(`/*${comment.value}*/`)
                }
            }
        }

        if (specifier.type === "ImportDefaultSpecifier") {
            // 默认导入
            contents.push({
                name: "default",
                alias: specifier.local.name,
                type: isTypeOnlyImport ? "type" : "variable",
                leadingComments:
                    leadingComments.length > 0 ? leadingComments : undefined,
                trailingComments:
                    trailingComments.length > 0 ? trailingComments : undefined,
            })
        } else if (specifier.type === "ImportNamespaceSpecifier") {
            // 命名空间导入
            contents.push({
                name: "*",
                alias: specifier.local.name,
                type: isTypeOnlyImport ? "type" : "variable",
                leadingComments:
                    leadingComments.length > 0 ? leadingComments : undefined,
                trailingComments:
                    trailingComments.length > 0 ? trailingComments : undefined,
            })
        } else if (specifier.type === "ImportSpecifier") {
            // 命名导入
            const importedName =
                specifier.imported.type === "Identifier"
                    ? specifier.imported.name
                    : (specifier.imported as any).value
            const localName = specifier.local.name
            const isTypeImport =
                isTypeOnlyImport || specifier.importKind === "type"

            contents.push({
                name: importedName,
                alias: importedName !== localName ? localName : undefined,
                type: isTypeImport ? "type" : "variable",
                leadingComments:
                    leadingComments.length > 0 ? leadingComments : undefined,
                trailingComments:
                    trailingComments.length > 0 ? trailingComments : undefined,
            })
        }
    }

    return contents
}

/** 解析导出说明符 */
function parseExportSpecifiers(
    node: ExportNamedDeclaration,
    isTypeOnlyExport: boolean = false,
): ImportContent[] {
    const contents: ImportContent[] = []

    if (!node.specifiers) {
        return contents
    }

    for (const specifier of node.specifiers) {
        if (specifier.type === "ExportSpecifier") {
            // 解析 specifier 的注释
            const leadingComments: string[] = []
            const trailingComments: string[] = []

            // 处理前导注释
            if (specifier.leadingComments) {
                for (const comment of specifier.leadingComments) {
                    if (comment.type === "CommentLine") {
                        leadingComments.push(`//${comment.value}`)
                    } else if (comment.type === "CommentBlock") {
                        leadingComments.push(`/*${comment.value}*/`)
                    }
                }
            }

            // 处理行尾注释
            if (specifier.trailingComments) {
                for (const comment of specifier.trailingComments) {
                    if (comment.type === "CommentLine") {
                        trailingComments.push(`//${comment.value}`)
                    } else if (comment.type === "CommentBlock") {
                        trailingComments.push(`/*${comment.value}*/`)
                    }
                }
            }

            const localName =
                specifier.local.type === "Identifier"
                    ? specifier.local.name
                    : (specifier.local as any).value
            const exportedName =
                specifier.exported.type === "Identifier"
                    ? specifier.exported.name
                    : (specifier.exported as any).value
            const isTypeExport =
                isTypeOnlyExport || specifier.exportKind === "type"

            contents.push({
                name: localName,
                alias: localName !== exportedName ? exportedName : undefined,
                type: isTypeExport ? "type" : "variable",
                leadingComments:
                    leadingComments.length > 0 ? leadingComments : undefined,
                trailingComments:
                    trailingComments.length > 0 ? trailingComments : undefined,
            })
        }
    }

    return contents
}
