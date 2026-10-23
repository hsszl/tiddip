# tiddip.com

| 目录 | 内容 | 运行方式 |
| --- | --- | --- |
| gaogame/ | 多人卡牌游戏 | Node.js 服务端 + 浏览器客户端 |
| loopland/ | 同屏双人围地游戏 | 直接打开 index.html，无需服务器 |

首页 `index.html` 链接到 `/gaogame/`。`/game` 保留给将来的项目，不自动跳转。

- [卡牌游戏部署说明](gaogame/docs/DEPLOY.md)
- [围地游戏文件说明](loopland/README.md)

运行文件、文档和测试分开放置。私有数据、日志、依赖和生成的部署包不提交 Git。
GitHub 保存源码；当前没有自动部署，push 不会直接更新 Spaceship。
