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
    plugins: ["./prettier-plugin-sort-imports.mjs"],
}

export default config
