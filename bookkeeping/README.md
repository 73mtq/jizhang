# 记账本

移动端记账 Web 应用，部署在 GitHub Pages，使用 GitHub Gist 私密存储数据。

## 功能

- 收入/支出记录，11 种支出 + 6 种收入分类
- 按月查看账单，按日分组显示
- 月度收支统计图表（分类饼图 + 收支趋势）
- 数据导入/导出 (JSON)
- GitHub Gist 云端同步，多设备共享

## 使用方法

1. 访问网站后，进入「设置」页面
2. 创建 [GitHub Personal Access Token](https://github.com/settings/tokens/new?scopes=gist&description=记账本)，勾选 `gist` 权限
3. 填入 Token 并点击「连接」
4. 开始记账

## 本地开发

直接用浏览器打开 `index.html` 即可，无需构建步骤。

## 技术栈

- 纯 HTML/CSS/JS（无框架依赖）
- Chart.js（图表，CDN 引入）
- GitHub Gist API（数据持久化）
- GitHub Pages（静态托管）
