# 开启云端同步：Cloudflare Pages + D1（约 10 分钟）

完成后，待办、门票状态和记账会保存在你自己的 Cloudflare D1 数据库里：换手机、换浏览器、同行人打开同一个网址，看到的都是同一份数据。
在完成之前，网站会自动退回「本机保存」，照常可用。

> 注意：同步接口没有登录验证，拿到网址的人都能查看和修改这份行程的待办与账本。只把网址分享给同行的人。

## 1. 创建 D1 数据库
1. 登录 Cloudflare Dashboard → **Storage & Databases → D1 SQL Database → Create**。
2. 名称随意，例如 `dotravelplan`，位置选 **Asia-Pacific（APAC）**。
3. 打开这个数据库 → **Console**，把仓库里 `optional/cloudflare-d1/migrations/0001_shared_trip_data.sql` 的全部内容粘贴进去，点 **Execute**。

## 2. 用 Cloudflare Pages 部署本仓库
1. **Workers & Pages → Create → Pages → Connect to Git**，授权并选择 `Do-Travel-Plan-Page` 仓库，生产分支 `main`。
2. Build 设置：Framework preset 选 **None**，Build command **留空**，Build output directory 填 **`/`**（仓库根目录）。
3. 部署完成后，进入这个 Pages 项目 → **Settings → Bindings → Add → D1 database**：
   - Variable name 填 **`DB`**（必须是大写 DB）
   - D1 database 选第 1 步建的数据库
4. 回到 **Deployments**，对最新一次部署点 **Retry deployment**（绑定在重新部署后生效）。
5. 打开 Cloudflare 给的 `*.pages.dev` 地址，「行程数据」面板应显示 **☁️ 云端同步已开启**。

## 3. 把 dotravelplan.sqsqsq.online 指向 Cloudflare Pages
1. Pages 项目 → **Custom domains → Set up a custom domain** → 填 `dotravelplan.sqsqsq.online`，按提示完成。
   - 如果 `sqsqsq.online` 的 DNS 在 Cloudflare：它会自动把 `dotravelplan` 的 CNAME 改为 `<项目名>.pages.dev`。
   - 如果提示记录已存在，先删除原来指向 `sqsqsqlll.github.io` 的 `dotravelplan` CNAME 再添加。
2. GitHub 仓库 **Settings → Pages**：把 Custom domain 清空（Remove），避免与 Cloudflare 冲突。
3. 等几分钟后打开 https://dotravelplan.sqsqsq.online ，确认显示 **☁️ 云端同步已开启**。

## 常见问题
- **显示「⚠️ 云端同步暂未连接」**：通常是第 2.3 步的变量名不是 `DB`、绑定后没有重新部署，或第 1.3 步的 SQL 没有执行。
- **迁移前在某台设备上本机保存的改动**不会自动上传到云端；需要的话在云端开启后重新录入。
- 行程文件里的初始账目（`ledgerSeed`）会在云端账本为空时自动写入一次。
