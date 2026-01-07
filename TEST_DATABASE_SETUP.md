# Test Database Setup

## Why a Separate Test Database?

Using a separate test database is a **best practice** that provides:

- ✅ **Data Safety**: Tests won't accidentally delete or modify your development data
- ✅ **Test Isolation**: Each test run starts with a clean slate
- ✅ **Parallel Testing**: Multiple developers can run tests simultaneously
- ✅ **CI/CD Ready**: Safe for automated testing pipelines

## Quick Setup

### 1. Create the Test Database

**Using the npm script (works on Windows, Linux, macOS):**

```bash
pnpm test:db:setup
```

This script uses Node.js and the `pg` library, so it works cross-platform without requiring `psql` to be installed.

### 2. Create `.env.test` File

Copy the example file:

```bash
cp .env.test.example .env.test
```

Update `DATABASE_URL` in `.env.test`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/chatapp_test?schema=public
```

### 3. Run Migrations on Test Database

```bash
pnpm test:db:migrate
```

This script works cross-platform (Windows, Linux, macOS) and automatically sets the correct environment variables.

### 4. Run Tests

```bash
pnpm test
```

The test setup will automatically:

- Load `.env.test` if it exists
- Fall back to `.env` if `.env.test` doesn't exist
- Warn you if you're not using a test database

## Safety Check

The test setup includes a safety check that warns you if:

- `NODE_ENV=test` but `DATABASE_URL` doesn't contain "test"

This helps prevent accidentally running tests against your development database.

## Current Behavior

- **With `.env.test`**: Uses `chatapp_test` database ✅
- **Without `.env.test`**: Falls back to `.env` and uses `chatapp` database ⚠️ (with warning)

## Recommended Workflow

1. Always create `.env.test` with a separate test database
2. Keep `.env.test` in `.gitignore` (secrets may differ)
3. Commit `.env.test.example` as a template
4. Run `pnpm test:db:migrate` after schema changes

## Troubleshooting

**Database doesn't exist:**

```bash
pnpm test:db:setup
```

**Migrations out of sync:**

```bash
pnpm test:db:migrate
```

**Tests still using dev database:**

- Check that `.env.test` exists and has correct `DATABASE_URL`
- Verify `DATABASE_URL` contains "test" in the database name
