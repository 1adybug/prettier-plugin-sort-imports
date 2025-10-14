// @ts-check
import { createPlugin } from "./dist/index.js"

/**
 * @type {import("prettier").Options}
 */
const config = {
    semi: false,
    tabWidth: 4,
    arrowParens: "avoid",
    endOfLine: "lf",
    plugins: [createPlugin()],
}

export default config
