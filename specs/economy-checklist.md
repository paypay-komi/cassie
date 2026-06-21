# Economy System — Complete Build Checklist

## 📦 Prisma Schema

- [ ] Add `GuildEconomy` model (prisma/schema.prisma)
  - guildId, currencyName, currencyPlural, currencySymbol, dailyAmount
  - workMin, workMax, workCooldown, taxRate, interestRate
  - economyChannel, enabled, createdAt, updatedAt
- [ ] Add `EconomyUser` model (prisma/schema.prisma)
  - guildId, userId, balance (BigInt), totalEarned, totalSpent
  - lastDaily, lastWork, createdAt, updatedAt
  - `@@id([guildId, userId])`
- [ ] Add `EconomyItem` model (prisma/schema.prisma)
  - id (cuid), guildId, name, description, price (BigInt), type
  - roleId, stock, sold, emoji, color, createdAt, updatedAt
  - `@@index([guildId])`
- [ ] Add `EconomyInventory` model (prisma/schema.prisma)
  - id (cuid), guildId, userId, itemId, quantity, acquiredAt
  - `@@unique([guildId, userId, itemId])`
  - `@@index([guildId, userId])`
- [ ] Add `EconomyTransaction` model (prisma/schema.prisma)
  - id (cuid), guildId, userId, type, amount (BigInt), balanceAfter
  - relatedUserId?, description?, createdAt
  - `@@index([guildId, userId])`
  - `@@index([guildId, createdAt])`
- [ ] Add `EconomyItem` has many `EconomyInventory` relation
- [ ] Run `npx prisma migrate dev --name add_economy`
- [ ] Run `npx prisma generate`

## 🗄️ DB Namespace — `db/economy.js`

- [ ] Create file `db/economy.js`
- [ ] `getConfig(guildId)` — get or create GuildEconomy row
- [ ] `updateConfig(guildId, data)` — partial update
- [ ] `ensureUser(guildId, userId)` — get or create EconomyUser row
- [ ] `getBalance(guildId, userId)` — returns BigInt
- [ ] `setBalance(guildId, userId, amount)` — hard set + log
- [ ] `addBalance(guildId, userId, amount, type, description)` — atomic increment + log transaction
- [ ] `removeBalance(guildId, userId, amount, type, description)` — atomic decrement + log (check insufficient)
- [ ] `addTransaction(guildId, userId, type, amount, balanceAfter, relatedUserId, description)` — insert row
- [ ] `getTransactions(guildId, userId, page, pageSize)` — paginated history
- [ ] `getLeaderboard(guildId, limit)` — top N by balance
- [ ] `getRank(guildId, userId)` — user's position in leaderboard
- [ ] `getUserCount(guildId)` — total economy users in guild
- [ ] `claimDaily(guildId, userId)` — check cooldown, add balance, return result
- [ ] `canWork(guildId, userId)` — check work cooldown
- [ ] `doWork(guildId, userId)` — add random amount, set lastWork, return earned
- [ ] `getShopItems(guildId)` — all items for guild
- [ ] `getShopItem(itemId)` — single item
- [ ] `addShopItem(guildId, name, price, type, roleId, ...)` — create item
- [ ] `updateShopItem(itemId, data)` — partial update
- [ ] `removeShopItem(itemId)` — delete
- [ ] `buyItem(guildId, userId, itemId)` — check price, check stock, deduct balance, add inventory, handle role grant, return result
- [ ] `getInventory(guildId, userId)` — all items user owns
- [ ] `getInventoryItem(guildId, userId, itemId)` — single entry
- [ ] `addInventory(guildId, userId, itemId, quantity)` — upsert quantity
- [ ] `removeInventory(guildId, userId, itemId, quantity)` — decrement or delete
- [ ] `giveItem(guildId, fromUserId, toUserId, itemId, quantity)` — transfer ownership
- [ ] `sellItemBack(guildId, userId, itemId, quantity)` — remove from inv, add balance (50% refund)
- [ ] `getItemType(itemId)` — returns type string
- [ ] `resetGuild(guildId)` — delete all economy data for guild (CASCADE handles most)

## 🔌 Wire Into DB — `db/index.js`

- [ ] Add `const economy = require("./economy");` at top
- [ ] Add `economy` to the exported `db` object

## 📁 Command Parent — `commands/text/economy/`

### Parent Router
- [ ] Create `commands/text/economy/router.js`
  - exports `name: "economy"`, `parent: "action"` wait no — it's its own parent
  - exports `name: "economy"`, `description: "Economy commands"`, `aliases: ["eco", "econ"]`
  - `async execute()` — show economy help menu

### 👤 User Commands
- [ ] Create `commands/text/economy/balance.js`
- [ ] Create `commands/text/economy/daily.js`
  - check cooldown, add daily amount, show streak concept visually
- [ ] Create `commands/text/economy/work.js`
  - check cooldown, random payout, set cooldown
- [ ] Create `commands/text/economy/pay.js`
  - validate target exists, validate amount positive, check sender balance
  - calculate tax, deduct from sender, add to recipient, log both transactions
  - show embed with amount + tax paid
- [ ] Create `commands/text/economy/shop.js`
  - list all items with emoji, name, price, stock
  - nice embed, paginated if many items
- [ ] Create `commands/text/economy/buy.js`
  - resolve item by name/id, check balance, check stock
  - deduct balance, add inventory, grant role if type=role
  - success embed with item + cost
- [ ] Create `commands/text/economy/inventory.js`
  - list user's owned items with quantities
  - paginated
- [ ] Create `commands/text/economy/use.js`
  - check item exists in inventory, check type=consumable
  - remove from inventory, acknowledge use (future: extensible effects)
- [ ] Create `commands/text/economy/give.js`
  - check sender owns item with sufficient quantity
  - remove from sender, add to recipient
  - log item transfer
- [ ] Create `commands/text/economy/sell.js`
  - check item in inventory, calculate refund (50% of shop price)
  - remove from inv, add balance, log
- [ ] Create `commands/text/economy/leaderboard.js`
  - top 10 by balance, paginated pages
  - show rank, name, balance with formatting
- [ ] Create `commands/text/economy/transactions.js`
  - paginated list of user's transaction history
  - each row: type, amount (+/-), balance after, timestamp, description

### 🔧 Admin Commands
- [ ] Create `commands/text/economy/admin/` directory

#### Config
- [ ] Create `commands/text/economy/admin/config.js`
  - `c.economy config` — show current config embed
  - `c.economy config <key> <value>` — set a config field
  - validate keys, validate value types

#### Balance Management
- [ ] Create `commands/text/economy/admin/balance.js`
  - `c.economy setbalance @user <amount>` — hard set
  - `c.economy addbalance @user <amount>` — add
  - `c.economy removebalance @user <amount>` — remove

#### Shop Management
- [ ] Create `commands/text/economy/admin/shop.js`
  - `c.economy shop add <name> <price> [type] [roleId]` — add item
  - `c.economy shop edit <id> <key> <value>` — edit item
  - `c.economy shop remove <id>` — delete item

#### Reset
- [ ] Create `commands/text/economy/admin/reset.js`
  - confirm prompt (yes/no button), then wipe all guild economy data
  - `permissions: ["botOwner"]`

## ⚙️ Slash Command Registration

- [ ] Add `args` to each command using `ArgsBuilder` so slash commands auto-generate
- [ ] Run reload or restart to register

## ✅ Verification / Testing

- [ ] Restart bot, load all new files
- [ ] Test `c.balance` — shows 0
- [ ] Test `c.daily` — gets coins, second attempt shows cooldown
- [ ] Test `c.work` — gets random coins, cooldown works
- [ ] Test `c.pay @user 50` — deducts, adds, tax works if configured
- [ ] Test `c.shop` — shows items (empty initially)
- [ ] Add item via `c.economy shop add`
- [ ] Test `c.buy <item>` — deducts, adds to inventory, grants role if applicable
- [ ] Test `c.inventory` — shows owned items
- [ ] Test `c.use` — consumable consumed
- [ ] Test `c.give` — item transfers to another user
- [ ] Test `c.sell` — refunds currency
- [ ] Test `c.leaderboard` — ranked list
- [ ] Test `c.transactions` — paginated history
- [ ] Test `c.economy config` — view and set
- [ ] Test `c.economy setbalance/addbalance/removebalance`
- [ ] Test `c.economy shop add/edit/remove`
- [ ] Test `c.economy reset` — wipes everything
- [ ] Test economy channel lock — blocked outside channel
- [ ] Test disabled flag — all eco commands blocked
