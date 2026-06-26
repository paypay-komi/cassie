# Economy System — Bare Bones Checklist

## 📦 Prisma Schema

- [x] `GuildEconomy` model — guildId, currencyName/Plural/Symbol, dailyBase/StreakBonus/Cap/ResetDays, workMin/Max/Cooldown, taxRate, economyChannel, enabled, timestamps
- [x] `GuildEconomyUser` model — guildId, userId, balance, totalEarned, totalSpent, lastDaily, lastWork, timestamps — `@@id([guildId, userId])`
- [x] `GuildEconomyTransaction` model — id, guildId, userId, type, amount, balanceAfter, relatedUserId, description, createdAt — indexed
- [x] Wire relations: GuildEconomy → users[], GuildEconomyUser → transactions[]
- [x] Run `npx prisma migrate dev --name add_economy`
- [ ] Run `npx prisma generate`

## 🗄️ DB Namespace — `db/economy.js`

- [x] Create file `db/economy.js`
- [x] `getConfig(guildId)` — get or create GuildEconomy row
- [ ] `updateConfig(guildId, data)` — partial update
- [ ] `ensureUser(guildId, userId)` — get or create GuildEconomyUser row
- [ ] `getBalance(guildId, userId)` — returns balance
- [ ] `setBalance(guildId, userId, amount)` — hard set + log transaction
- [ ] `addBalance(guildId, userId, amount, type, description)` — atomic add + log
- [ ] `removeBalance(guildId, userId, amount, type, description)` — atomic sub + log (fail if insufficient)
- [ ] `addTransaction(guildId, userId, type, amount, balanceAfter, relatedUserId, description)` — insert
- [ ] `getTransactions(guildId, userId, page, pageSize)` — paginated history
- [ ] `getLeaderboard(guildId, limit)` — top N by balance
- [ ] `getRank(guildId, userId)` — user's position
- [ ] `getUserCount(guildId)` — total economy users
- [ ] `claimDaily(guildId, userId)` — check cooldown, calc streak, add balance, return result
- [ ] `canWork(guildId, userId)` — check cooldown
- [ ] `doWork(guildId, userId)` — random payout, set lastWork, return earned
- [ ] `resetGuild(guildId)` — delete all economy data for guild

## 🔌 Wire Into DB — `db/index.js`

- [ ] Add `const economy = require("./economy");` at top
- [ ] Add `economy` to the exported `db` object

## 📁 Command Parent — `commands/text/economy/`

### Parent Router
- [ ] Create `commands/text/economy/router.js` — name: "economy", aliases: ["eco"], execute shows help

### 👤 User Commands
- [ ] `balance.js` — `c.balance [@user]` — view coins
- [ ] `daily.js` — `c.daily` — claim daily, show streak if applicable
- [ ] `work.js` — `c.work` — earn random coins with cooldown
- [ ] `pay.js` — `c.pay @user <amount>` — send coins, tax deducted
- [ ] `leaderboard.js` — `c.leaderboard` — top 10 richest
- [ ] `transactions.js` — `c.transactions [page]` — your history

### 🔧 Admin Commands
- [ ] Create `commands/text/economy/admin/` directory
- [ ] `config.js` — `c.economy config [key] [value]` — view/edit guild config
- [ ] `balance.js` — `c.economy setbalance/addbalance/removebalance @user <amount>`
- [ ] `reset.js` — `c.economy reset` — confirm then wipe (botOwner only)

## ✅ Verification

- [ ] `c.balance` — shows 0
- [ ] `c.daily` — claim, second attempt shows cooldown
- [ ] `c.work` — random coins, cooldown works
- [ ] `c.pay @user 50` — deducts, adds, tax works if set
- [ ] `c.leaderboard` — ranked list
- [ ] `c.transactions` — paginated history
- [ ] `c.economy config` — view and set values
- [ ] `c.economy setbalance/addbalance/removebalance @user`
- [ ] `c.economy reset` — wipes guild
- [ ] Economy channel lock — blocked outside configured channel
- [ ] Disabled flag — all eco commands blocked
