// 测试用的 CJS 配置文件

module.exports = {
    getGroup: importStatement => {
        const path = importStatement.path
        if (path.startsWith("vue")) return "vue"
        if (path.startsWith("@/")) return "internal"
        if (path.startsWith(".")) return "relative"
        return "external"
    },
    sortGroup: (a, b) => {
        const order = ["vue", "external", "internal", "relative"]
        return order.indexOf(a.name) - order.indexOf(b.name)
    },
    separator: "\n\n",
}

