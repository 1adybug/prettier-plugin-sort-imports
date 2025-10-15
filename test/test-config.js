// 测试用的配置文件

module.exports = {
    getGroup: (importStatement) => {
        const path = importStatement.path
        if (path.startsWith("react")) return "react"
        if (path.startsWith("@/")) return "internal"
        if (path.startsWith(".")) return "relative"
        return "external"
    },
    sortGroup: (a, b) => {
        const order = ["react", "external", "internal", "relative"]
        return order.indexOf(a.name) - order.indexOf(b.name)
    },
    separator: "\n"
}

