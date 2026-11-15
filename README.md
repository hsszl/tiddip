# tiddip.com

| 目录 | 内容 | 运行方式 |
| --- | --- | --- |
| gaogame/ | 多人卡牌游戏 | Node.js 服务端 + 浏览器客户端 |
| loopland/ | 同屏双人围地游戏 | 直接打开 index.html，无需服务器 |
| dive/ | 兔潜奇境视频复刻，点击上浮穿管道 | 直接打开 index.html，无需服务器 |
| phones/ | 手机参数筛选与对比 | 直接打开 index.html，无需服务器 |

首页 `index.html` 使用相对链接进入 `phones/`、`dive/` 和 `loopland/`，兼容 GitHub Pages 项目路径与自定义域名。`gaogame/` 暂不上线，源码保留；`/game` 保留给将来的项目，不自动跳转。

- [卡牌游戏部署说明](gaogame/docs/DEPLOY.md)
- [围地游戏文件说明](loopland/README.md)
- [兔潜奇境文件与部署说明](dive/README.md)
- [手机筛选文件说明](phones/README.md)

运行文件、文档和测试分开放置。私有数据、日志、依赖和生成的部署包不提交 Git。
推送或合并到 `main` 后，`.github/workflows/static.yml` 自动发布 GitHub Pages；发布根目录为仓库根目录，上传前仅从 Actions 临时副本排除 `gaogame/`。首页直接维护在 `index.html`，工作流不生成首页。此流程不会更新 Spaceship 主机。
