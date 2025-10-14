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
    })

    const importStatements: ImportStatement[] = []
    const { body } = ast.program

    // 只处理文件开头的连续导入/导出语句块
    for (const node of body) {
        if (
            node.type === "ImportDeclaration" ||
            (node.type === "ExportNamedDeclaration" && node.source) ||
            node.type === "ExportAllDeclaration"
        ) {
            const statement = parseImportNode(node, ast.comments ?? [])
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
): ImportStatement {
    const isExport = node.type !== "ImportDeclaration"
    const source = node.source?.value ?? ""

    // 提取导入语句上方的注释
    const leadingComments: string[] = []
    let start = node.start ?? 0

    if (node.leadingComments) {
        // 找到最早的注释位置
        const firstComment = node.leadingComments[0]
        if (firstComment.start !== null && firstComment.start !== undefined) {
            start = firstComment.start
        }

        for (const comment of node.leadingComments) {
            if (comment.type === "CommentLine") {
                leadingComments.push(`//${comment.value}`)
            } else if (comment.type === "CommentBlock") {
                leadingComments.push(`/*${comment.value}*/`)
            }
        }
    }

    const end = node.end ?? 0

    // 处理 import 语句
    if (node.type === "ImportDeclaration") {
        const importContents = parseImportSpecifiers(node)
        const isSideEffect = importContents.length === 0

        return {
            path: source,
            isExport: false,
            isSideEffect,
            importContents,
            leadingComments:
                leadingComments.length > 0 ? leadingComments : undefined,
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
            start,
            end,
        }
    }

    // 处理 export { ... } from 语句
    const importContents = parseExportSpecifiers(node)

    return {
        path: source,
        isExport: true,
        isSideEffect: false,
        importContents,
        leadingComments:
            leadingComments.length > 0 ? leadingComments : undefined,
        start,
        end,
    }
}

/** 解析导入说明符 */
function parseImportSpecifiers(node: ImportDeclaration): ImportContent[] {
    const contents: ImportContent[] = []

    for (const specifier of node.specifiers) {
        if (specifier.type === "ImportDefaultSpecifier") {
            // 默认导入
            contents.push({
                name: "default",
                alias: specifier.local.name,
                type: "variable",
            })
        } else if (specifier.type === "ImportNamespaceSpecifier") {
            // 命名空间导入
            contents.push({
                name: "*",
                alias: specifier.local.name,
                type: "variable",
            })
        } else if (specifier.type === "ImportSpecifier") {
            // 命名导入
            const importedName =
                specifier.imported.type === "Identifier"
                    ? specifier.imported.name
                    : (specifier.imported as any).value
            const localName = specifier.local.name
            const isTypeImport = specifier.importKind === "type"

            contents.push({
                name: importedName,
                alias: importedName !== localName ? localName : undefined,
                type: isTypeImport ? "type" : "variable",
            })
        }
    }

    return contents
}

/** 解析导出说明符 */
function parseExportSpecifiers(node: ExportNamedDeclaration): ImportContent[] {
    const contents: ImportContent[] = []

    if (!node.specifiers) {
        return contents
    }

    for (const specifier of node.specifiers) {
        if (specifier.type === "ExportSpecifier") {
            const localName =
                specifier.local.type === "Identifier"
                    ? specifier.local.name
                    : (specifier.local as any).value
            const exportedName =
                specifier.exported.type === "Identifier"
                    ? specifier.exported.name
                    : (specifier.exported as any).value
            const isTypeExport = specifier.exportKind === "type"

            contents.push({
                name: localName,
                alias: localName !== exportedName ? exportedName : undefined,
                type: isTypeExport ? "type" : "variable",
            })
        }
    }

    return contents
}
