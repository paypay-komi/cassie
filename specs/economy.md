# Server Economy — Bare Bones

Three models: GuildEconomy (config), GuildEconomyUser (balance), GuildEconomyTransaction (audit log).

## Commands

### User
- `c.balance [@user]` — view coins
- `c.daily` — claim daily (streak + base, capped)
- `c.work` — earn random coins (cooldown)
- `c.pay @user <amount>` — send coins (tax % taken from sender)
- `c.leaderboard` — top 10
- `c.transactions [page]` — your history

### Admin
- `c.economy config [key] [value]` — view/edit
- `c.economy setbalance/addbalance/removebalance @user <amount>`
- `c.economy reset` — wipe guild

## Rules
- Int (not BigInt), per-guild isolation, full transaction log, optional channel lock, master toggle
- No items, no shop, no inventory — future
