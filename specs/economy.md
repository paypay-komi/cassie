# Server Economy System

## Core Models

### GuildEconomy (one per guild)
```
guildId          String    @id
currencyName     String    @default("credits")
currencyPlural   String    @default("credits")
currencySymbol   String    @default("🪙")
dailyAmount      Int       @default(100)
workMin          Int       @default(10)
workMax          Int       @default(50)
workCooldown     Int       @default(60)   # minutes
taxRate          Float     @default(0)    # 0–100, taken from transfers
interestRate     Float     @default(0)    # % per day on idle balance
economyChannel   String?                # restrict eco commands to this channel
enabled          Boolean   @default(true)
createdAt        DateTime
updatedAt        DateTime
```

### EconomyUser (per user per guild)
```
guildId      String
userId       String
balance      BigInt    @default(0)
totalEarned  BigInt    @default(0)
totalSpent   BigInt    @default(0)
lastDaily    DateTime?
lastWork     DateTime?
createdAt    DateTime
updatedAt    DateTime

@@id([guildId, userId])
```

### EconomyItem (shop items per guild)
```
id          String    @id @default(cuid())
guildId     String
name        String
description String?
price       BigInt
type        String    @default("role")   # role | consumable | collectible | permanent
roleId      String?                      # role granted on buy (for type=role)
stock       Int       @default(-1)       # -1 = unlimited
sold        Int       @default(0)
emoji       String    @default("🛒")
color       String    @default("Default")
createdAt   DateTime
updatedAt   DateTime

@@index([guildId])
```

### EconomyInventory (items a user owns)
```
id          String   @id @default(cuid())
guildId     String
userId      String
itemId      String
quantity    Int      @default(1)
acquiredAt  DateTime

@@unique([guildId, userId, itemId])
@@index([guildId, userId])
@@index([guildId])
```

### EconomyTransaction (audit log)
```
id            String   @id @default(cuid())
guildId       String
userId        String
type          String   # daily | work | pay_in | pay_out | shop_buy | shop_sell
                       # | item_send_in | item_send_out | tax | interest | admin_add | admin_remove
amount        BigInt   # positive = gained, negative = lost
balanceAfter  BigInt
relatedUserId String?  # for pay/send — the other party
description   String?
createdAt     DateTime

@@index([guildId, userId])
@@index([guildId, createdAt])
@@index([guildId, type])
```

## Item Types

| Type | Behavior |
|------|----------|
| `role` | Buying grants the Discord role, requires Manage Roles perms |
| `consumable` | Deducted from inventory on use, does something once |
| `collectible` | Can be owned, traded, displayed — no special action |
| `permanent` | Owned forever (can't be sold/traded away), like a badge |

## Commands

### User
| Command | Description |
|---------|-------------|
| `c.balance [@user]` | View balance (your or another's) |
| `c.daily` | Claim daily reward (24h cooldown) |
| `c.work` | Earn random credits (configurable cooldown) |
| `c.pay @user <amount>` | Transfer credits (taxable) |
| `c.shop` | Browse guild shop |
| `c.buy <item>` | Buy item from shop |
| `c.inventory [@user]` | View items you or another user own |
| `c.use <item>` | Use a consumable item from inventory |
| `c.give @user <item> [qty]` | Give/trade an owned item to another user |
| `c.sell <item> [qty]` | Sell an owned item back to the shop (if enabled) |
| `c.leaderboard` | Richest users in the guild |
| `c.transactions [page]` | Your transaction history |

### Admin (bot owner + guild admin)
| Command | Description |
|---------|-------------|
| `c.economy setbalance @user <amount>` | Set exact balance |
| `c.economy addbalance @user <amount>` | Add credits |
| `c.economy removebalance @user <amount>` | Remove credits |
| `c.economy config` | Show current config |
| `c.economy config <key> <value>` | Set config value |
| `c.economy reset` | Reset all economy data for this guild |
| `c.shop add <name> <price> [type] [roleId]` | Add shop item |
| `c.shop edit <id> <key> <value>` | Edit shop item |
| `c.shop remove <id>` | Remove shop item |
| `c.shop setrole <id> <roleId>` | Set/link role to item |

## Design Rules

1. **BigInt** for all currency — no float rounding issues
2. **Per-guild isolation** — no cross-server balances, items, or transfers
3. **Tax is destroyed** — taken out of circulation, not given to anyone
4. **Role items require Manage Roles** — bot checks perms before creating role-type items
5. **Economy channel lock** — if set, all eco commands blocked outside that channel
6. **Full transaction log** — every credit movement recorded with type, amount, and resulting balance
7. **Item quantities** tracked in inventory, default to 0 (not in inventory)
8. **Consumable use** — removed from inventory on use, extensible for future effects
9. **Trading** — `c.give` transfers item ownership (no currency involved, pure trade)

## Build Order

1. Schema + migration
2. `db/economy.js` namespace — `getConfig()`, `ensureUser()`, `getBalance()`, `addTransaction()`, etc.
3. Wire into `db/index.js` as `db.economy`
4. `commands/text/economy/` — parent command + subcommands
   - `balance.js` — view balances
   - `daily.js` — daily claim with cooldown
   - `work.js` — work for credits
   - `pay.js` — transfer credits
   - `shop.js` — browse items
   - `buy.js` — purchase items
   - `inventory.js` — list owned items
   - `use.js` — use consumable
   - `give.js` — trade item to another user
   - `sell.js` — sell item back to shop
   - `leaderboard.js` — richest users
   - `transactions.js` — history
   - `admin/config.js` — view/edit config
   - `admin/balance.js` — set/add/remove
   - `admin/shop.js` — add/edit/remove shop items
   - `admin/reset.js` — wipe guild economy
5. Slash command auto-generation from text commands

## Future V2

- Gambling (slots, blackjack, dice)
- Auctions (bidding on items)
- Bounties (place bounty on user, others claim it)
- Bank accounts (interest-bearing separate from wallet)
- Economy events (double daily, flash sales, etc.)
- Item crafting (combine items to make new ones)
- Item rarity tiers (common → legendary, affects trade value)
