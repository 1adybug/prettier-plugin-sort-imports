// @ts-check

/**
 * @type {import("prettier").Options}
 */
const config = {
    semi: false,
    tabWidth: 4,
    arrowParens: "avoid",
    printWidth: 160,
    endOfLine: "lf",
    plugins: [
        "./prettier-plugin-sort-imports.mjs",
    ],
    // Tailwind CSS 配置
    tailwindFunctions: ["clsx", "cn", "cva", "tw"],
    tailwindAttributes: ["class", "className", "ngClass", ":class"],

    // 注意：如果同时使用两个插件时导入排序不生效，
    // 请使用 prettier-plugin-sort-imports.mjs 文件：
    // npx prettier --plugin ./prettier-plugin-sort-imports.mjs --write .
}

export default config
