import { defineConfig } from "@rslib/core"

export default defineConfig({
    lib: [
        {
            format: "esm",
            syntax: ["node 18"],
            dts: true,
            output: {
                externals: [/^@babel\//],
            },
        },
        {
            format: "cjs",
            syntax: ["node 18"],
            dts: true,
            output: {
                externals: [/^@babel\//],
            },
        },
    ],
})
