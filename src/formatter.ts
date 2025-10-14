import { Group, ImportStatement, PluginConfig } from "./types"

/** 格式化导入语句 */
export function formatImportStatement(statement: ImportStatement): string {
    const { path, isExport, isSideEffect, importContents, leadingComments } =
        statement

    const lines: string[] = []

    // 添加注释
    if (leadingComments && leadingComments.length > 0) {
        lines.push(...leadingComments)
    }

    // 副作用导入
    if (isSideEffect) {
        if (isExport) {
            lines.push(`export * from "${path}"`)
        } else {
            lines.push(`import "${path}"`)
        }
        return lines.join("\n")
    }

    // 构建导入内容（importContents 已经排序好了，直接按顺序处理）
    const parts: string[] = []
    const namedParts: string[] = []

    for (const content of importContents) {
        // 默认导入
        if (content.name === "default") {
            parts.push(content.alias ?? "default")
            continue
        }

        // 命名空间导入
        if (content.name === "*") {
            parts.push(`* as ${content.alias ?? "namespace"}`)
            continue
        }

        // 命名导入
        const typePrefix = content.type === "type" ? "type " : ""
        if (content.alias) {
            namedParts.push(`${typePrefix}${content.name} as ${content.alias}`)
        } else {
            namedParts.push(`${typePrefix}${content.name}`)
        }
    }

    // 添加命名导入部分
    if (namedParts.length > 0) {
        parts.push(`{ ${namedParts.join(", ")} }`)
    }

    // 构建完整的导入语句
    const importClause = parts.join(", ")
    if (isExport) {
        lines.push(`export ${importClause} from "${path}"`)
    } else {
        lines.push(`import ${importClause} from "${path}"`)
    }

    return lines.join("\n")
}

/** 格式化分组 */
export function formatGroups(groups: Group[], config: PluginConfig): string {
    const lines: string[] = []
    const separator = config.separator

    for (let i = 0; i < groups.length; i++) {
        const group = groups[i]

        // 添加分隔符
        if (separator !== undefined) {
            let separatorStr: string | undefined

            if (typeof separator === "string") {
                separatorStr = separator
            } else {
                separatorStr = separator(group, i)
            }

            if (separatorStr !== undefined) {
                // 先添加一个空行，然后添加分隔符
                lines.push("")
                if (separatorStr !== "") {
                    lines.push(separatorStr)
                }
            }
        }

        // 格式化分组中的导入语句
        for (const statement of group.importStatements) {
            lines.push(formatImportStatement(statement))
        }
    }

    return lines.join("\n")
}

/** 格式化导入语句列表（不使用分组） */
export function formatImportStatements(statements: ImportStatement[]): string {
    return statements.map(formatImportStatement).join("\n")
}
