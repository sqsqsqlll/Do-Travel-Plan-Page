# 行程页 ↔ 旅游AA账本 联动

行程页部署在账本同域的 `/plan/` 下（`https://travel.sqsqsq.online/plan/`），两个页面读同一个浏览器里的数据：

- 顶部「💰 账本」：打开账本并自动导入 / 切换到本行程（账本会记住对应关系，不重复导入）
- 每个行程项目旁的「💰 预算 ¥x · 已付 ¥y」：账本里对应预算项的金额，点击跳到账本的那一项
- 每天底部：当天全部预算与已付
- 账本预算项上的「🗺 行程 D4」：跳回行程页对应项目（`/plan/#item-<项目 id>`，自动展开并高亮）
- 账本在另一个标签页里修改后，切回行程页即刷新金额

单独部署（例如 dotravelplan.sqsqsq.online）时读不到账本数据，只保留跳转；账本地址取 `metadata.ledgerUrl`。

## 对应关系

账本按 `planRef` 对应行程页的条目：`ticket:<门票 id>`、`flight:<航班 id>`、`stay:<住宿>`、`cost:<日 id>:<费用>`。
门票的 `scheduleItemIds[0]` 决定它显示在哪个行程项目旁；`costReferences[].scheduleItemId`（可选）同理。

## 地图信息（Google Maps MCP 生成）

`places[].maps`：

```json
{ "rating": 4.6, "ratingCount": 12345, "priceLevel": "¥¥",
  "hours": ["周一: 07:30–17:30", "…共 7 项，周一在前…"], "hoursNote": "无固定营业时间时的说明",
  "checkedAt": "2026-11-05", "source": "Google Maps" }
```

行程项目到下一站：`days[].schedule[].travelToNext`：

```json
{ "mode": "walk | transit | train | bus | drive | taxi | ferry", "minutes": 15, "distanceKm": 1.1, "note": "JR 奈良线" }
```

行程页按当天星期几显示营业时间，可展开看全部。

## 门票（票价与购票窗口）

`ticketPlanning.items[]` 额外字段：

```json
{ "price": { "amount": 2500, "currency": "JPY", "label": "成人" },
  "priceCheckedAt": "2026-11-05",
  "saleWindow": { "opens": "2026-11-20", "closes": "2026-12-02", "note": "提前 30 天开售" },
  "buyChannels": [{ "name": "官网", "url": "https://…" }, { "name": "Klook", "url": "https://…" }] }
```

账本打开时会自动读取 `plan/trip-data.json`：

- 更新每个门票预算项上的「最新票价 / 购票窗口 / 购票渠道」，票价变化时提示
- 只在预算金额为 0 时自动填入票价，已有金额不覆盖，可点「按最新票价更新预算」
- 行程页新增的条目会补进账本；行程页删掉的不会从账本删除

只填官方或购票平台上核实过的数字，并写 `priceCheckedAt`。
