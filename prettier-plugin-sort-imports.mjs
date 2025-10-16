// @ts-check

import { builtinModules } from "module"

import { createPlugin } from "@1adybug/prettier-plugin-sort-imports"
import * as tailwindcss from "prettier-plugin-tailwindcss"

/**
 * @param {string} path
 */
function isReact(path) {
    return /^@?react\b/.test(path)
}

/**
 * @param {string} path
 */
function isBuiltin(path) {
    return path.startsWith("node:") || builtinModules.includes(path)
}

/**
 * @param {string} path
 */
function isAbsolute(path) {
    return path.startsWith("@/")
}

/**
 * @param {string} path
 */
function isRelative(path) {
    return path.startsWith("./") || path.startsWith("../")
}

/**
 * @param {string} a
 * @param {string} b
 */
function compareGroupName(a, b) {
    const orders = ["react", "builtin", "third-party", "absolute", "relative"]

    a = a.replace(/-side-effect$/, "")
    b = b.replace(/-side-effect$/, "")
    return orders.indexOf(a) - orders.indexOf(b) || a.localeCompare(b)
}

export default createPlugin({
    getGroup({ path, isSideEffect }) {
        if (isSideEffect) {
            if (isReact(path)) return "react-side-effect"
            if (isBuiltin(path)) return "builtin-side-effect"
            if (isAbsolute(path)) return "absolute-side-effect"
            if (isRelative(path)) return "relative-side-effect"
            return "third-party-side-effect"
        }

        if (isReact(path)) return "react"
        if (isBuiltin(path)) return "builtin"
        if (isAbsolute(path)) return "absolute"
        if (isRelative(path)) return "relative"
        return "third-party"
    },
    sortGroup(a, b) {
        return Number(a.isSideEffect) - Number(b.isSideEffect) || compareGroupName(a.name, b.name)
    },
    separator: "",
    sortSideEffect: true,
    otherPlugins: [tailwindcss], // 集成 Tailwind CSS 插件
})
