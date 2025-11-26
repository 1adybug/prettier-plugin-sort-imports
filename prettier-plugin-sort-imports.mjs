// @ts-check

import { readFileSync } from "fs"
import { builtinModules } from "module"

import JSON5 from "json5"

import { createPlugin } from "./dist/index.js"

/**
 * @param {string} path
 */
function isBuiltin(path) {
    return path.startsWith("node:") || builtinModules.includes(path)
}

/** @type {string[]} */
let pathAlias = []

try {
    const tsConfig = JSON5.parse(readFileSync("tsconfig.json", "utf-8"))
    pathAlias = Object.keys(tsConfig.compilerOptions?.paths ?? {})
        .map(item => item.match(/^(@.*\/)\*/))
        .filter(Boolean)
        .map(item => /** @type {string} */ (item?.[1]))
} catch {}

/**
 * @param {string} path
 */
function isAbsolute(path) {
    return pathAlias.some(item => path.startsWith(item))
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
    const orders = ["builtin", "third-party", "absolute", "relative"]
    return orders.indexOf(a) - orders.indexOf(b) || a.localeCompare(b)
}

export default createPlugin({
    getGroup({ path }) {
        if (isBuiltin(path)) return "builtin"
        if (isAbsolute(path)) return "absolute"
        if (isRelative(path)) return "relative"
        return "third-party"
    },
    sortGroup(a, b) {
        console.log(a.name, b.name)
        return Number(a.isSideEffect) - Number(b.isSideEffect) || compareGroupName(a.name, b.name)
    },
    separator: "",
    sortSideEffect: true,
    removeUnusedImports: true,
})
