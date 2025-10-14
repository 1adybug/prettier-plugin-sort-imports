import { createRequire } from "module"
import { ParserOptions, Plugin } from "prettier"
import { removeUnusedImportsFromStatements } from "./analyzer"
import { formatGroups, formatImportStatements } from "./formatter"
import { parseImports } from "./parser"
import { groupImports, sortGroups, sortImports } from "./sorter"
import { PluginConfig } from "./types"

const require = createRequire(import.meta.url)

// 存储用户配置
let userConfig: PluginConfig = {}

/** 预处理导入语句 */
function preprocessImports(
    text: string,
    options: ParserOptions & PluginConfig,
): string {
    try {
        // 解析导入语句
        const imports = parseImports(text)

        if (imports.length === 0) {
            return text
        }

        // 构建配置（优先使用 userConfig，然后是 options）
        const config: PluginConfig = {
            getGroup: userConfig.getGroup ?? (options as any).getGroup,
            sortGroup: userConfig.sortGroup ?? (options as any).sortGroup,
            sortImportStatement:
                userConfig.sortImportStatement ??
                (options as any).sortImportStatement,
            sortImportContent:
                userConfig.sortImportContent ??
                (options as any).sortImportContent,
            separator:
                userConfig.separator ??
                (options as any).importSortSeparator ??
                (options as any).separator,
            sortSideEffect:
                userConfig.sortSideEffect ??
                (options as any).importSortSideEffect ??
                false,
            removeUnusedImports:
                userConfig.removeUnusedImports ??
                (options as any).importSortRemoveUnused ??
                false,
        }

        // 移除未使用的导入（如果配置了）
        let processedImports = imports
        if (config.removeUnusedImports) {
            // 只分析导入语句之后的代码部分
            const lastImport = imports[imports.length - 1]
            const codeAfterImports = text.slice(lastImport.end ?? 0)
            processedImports = removeUnusedImportsFromStatements(
                imports,
                codeAfterImports,
            )
        }

        // 排序导入语句
        const sortedImports = sortImports(processedImports, config)

        // 格式化导入语句
        let formattedImports: string

        // 如果配置了分组函数，使用分组格式化
        if (config.getGroup) {
            const groups = groupImports(sortedImports, config)
            const sortedGroups = sortGroups(groups, config)
            formattedImports = formatGroups(sortedGroups, config)
        } else {
            // 否则直接格式化
            formattedImports = formatImportStatements(sortedImports)
        }

        // 获取导入块的起始和结束位置
        const firstImport = imports[0]
        const lastImport = imports[imports.length - 1]

        const startIndex = firstImport.start ?? 0
        const endIndex = lastImport.end ?? text.length

        // 替换原始导入语句
        const beforeImports = text.slice(0, startIndex)
        const afterImports = text.slice(endIndex)

        // 确保导入语句后面有适当的换行
        // 如果 afterImports 不是以换行开始,添加两个换行
        const needsExtraNewline = afterImports && !afterImports.startsWith("\n")
        const separator = needsExtraNewline ? "\n\n" : "\n"

        return beforeImports + formattedImports + separator + afterImports
    } catch (error) {
        // 如果解析失败，返回原始文本
        console.error("Failed to sort imports:", error)
        return text
    }
}

// 动态加载 prettier 的解析器
const babelParser = require("prettier/parser-babel").parsers.babel
const typescriptParser = require("prettier/parser-typescript").parsers
    .typescript
const babelTsParser = require("prettier/parser-babel").parsers["babel-ts"]

/** 创建插件 */
function createPluginInstance(): Plugin {
    return {
        parsers: {
            babel: {
                ...babelParser,
                preprocess: preprocessImports,
            },
            typescript: {
                ...typescriptParser,
                preprocess: preprocessImports,
            },
            "babel-ts": {
                ...babelTsParser,
                preprocess: preprocessImports,
            },
        },
        options: {
            importSortSeparator: {
                type: "string",
                category: "Import Sort",
                description: "分组之间的分隔符",
            },
            importSortSideEffect: {
                type: "boolean",
                category: "Import Sort",
                description: "是否对副作用导入进行排序",
                default: false,
            },
            importSortRemoveUnused: {
                type: "boolean",
                category: "Import Sort",
                description: "是否删除未使用的导入",
                default: false,
            },
        },
    }
}

/** 默认插件实例（用于简单使用） */
const plugin: Plugin = createPluginInstance()

/** 创建自定义配置的插件（工厂函数） */
export function createPlugin(config: PluginConfig = {}): Plugin {
    // 设置用户配置
    userConfig = config
    return createPluginInstance()
}

// 默认导出插件实例（支持简单用法）
export default plugin
