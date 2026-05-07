# 🚀 Quick Start - Local Development

## One-Command Startup

```bash
./START_LOCAL_DEVELOPMENT.sh
```

This will automatically:
1. ✅ Check all prerequisites (Node.js, AWS CLI, etc.)
2. ✅ Kill any existing processes on ports 3307 and 3002
3. ✅ Start SSH tunnel to AWS RDS database
4. ✅ Test database connection
5. ✅ Start Next.js development server
6. ✅ Open browser to http://localhost:3002

---

## Available Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `START_LOCAL_DEVELOPMENT.sh` | Start everything | `./START_LOCAL_DEVELOPMENT.sh` |
| `STOP_LOCAL_DEVELOPMENT.sh` | Stop all services | `./STOP_LOCAL_DEVELOPMENT.sh` |
| `CHECK_LOCAL_STATUS.sh` | Check what's running | `./CHECK_LOCAL_STATUS.sh` |

---

## Manual Control

### Start SSH Tunnel Only
```bash
./persistent-tunnel.sh
```
This creates a tunnel from `localhost:3307` → AWS RDS

### Start Next.js Only
```bash
npm run dev
```
Runs on http://localhost:3002

### Stop Everything
```bash
./STOP_LOCAL_DEVELOPMENT.sh
```

---

## Access Points

### Application URLs
- **Main App**: http://localhost:3002
- **Login**: http://localhost:3002/auth/login
- **Home**: http://localhost:3002/home

### Default Credentials
- **Email**: lcapix50@gmail.com
- **Password**: Lcapix@guerry123

### Database Connection (TablePlus)
- **Host**: 127.0.0.1
- **Port**: 3307
- **User**: lcaadmin
- **Password**: EP76017fLefZ8?d!ezTHsN[kA()X
- **Database**: lca_v3

---

## Troubleshooting

### Check Status
```bash
./CHECK_LOCAL_STATUS.sh
```

### View Logs
```bash
# SSH Tunnel logs
tail -f tunnel.log

# Next.js logs
tail -f nextjs.log
```

### Port Already in Use
```bash
# Kill process on port 3002
lsof -ti:3002 | xargs kill -9

# Kill process on port 3307
lsof -ti:3307 | xargs kill -9
```

### Database Connection Issues
1. Make sure SSH tunnel is running: `./CHECK_LOCAL_STATUS.sh`
2. Check AWS credentials: `aws sts get-caller-identity --profile lca-pix`
3. Test connection manually:
```bash
mysql -h 127.0.0.1 -P 3307 -u lcaadmin -p lca_v3
```

### Next.js Won't Start
```bash
# Clear cache and restart
rm -rf .next node_modules package-lock.json
npm install
npm run dev
```

---

## File Structure

```
.
├── START_LOCAL_DEVELOPMENT.sh   # Main startup script
├── STOP_LOCAL_DEVELOPMENT.sh    # Shutdown script
├── CHECK_LOCAL_STATUS.sh        # Status checker
├── persistent-tunnel.sh         # SSH tunnel script
├── .env.local                   # Environment config
├── tunnel.log                   # SSH tunnel logs
├── nextjs.log                   # Next.js logs
└── .dev-pids                    # Process IDs (auto-generated)
```

---

## What Each Port Does

| Port | Service | Purpose |
|------|---------|---------|
| **3002** | Next.js | Web application |
| **3307** | SSH Tunnel | Forwards to AWS RDS port 3306 |

---

## Development Workflow

### 1. Start Development
```bash
./START_LOCAL_DEVELOPMENT.sh
```
Wait for "SUCCESS!" message and browser to open.

### 2. Make Code Changes
- Edit files in `app/`, `components/`, `lib/`
- Changes auto-reload (hot module replacement)

### 3. Test APIs
- Use Postman/Insomnia
- Or use curl: `curl http://localhost:3002/api/health`

### 4. Check Database
- Open TablePlus
- Connect to 127.0.0.1:3307
- View tables, run queries

### 5. Stop Development
```bash
./STOP_LOCAL_DEVELOPMENT.sh
```

---

## Environment Variables

Your `.env.local` file contains:

```env
# Application
NEXT_PUBLIC_APP_URL=http://localhost:3002
NEXT_PUBLIC_APP_NAME=LCAPIX

# Database (via SSH tunnel)
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3307
DATABASE_NAME=lca_v3
DATABASE_USER=lcaadmin
DATABASE_PASSWORD=EP76017fLefZ8?d!ezTHsN[kA()X

# JWT Authentication
JWT_SECRET=gupexcV3UjhhUswZxPn2CY+sogsiwVKaiz9kzCbv0qw=

# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# AWS
AWS_REGION=us-east-1

# Environment
NODE_ENV=development
```

---

## Quick Commands Reference

```bash
# Start everything
./START_LOCAL_DEVELOPMENT.sh

# Check status
./CHECK_LOCAL_STATUS.sh

# Stop everything
./STOP_LOCAL_DEVELOPMENT.sh

# View real-time logs
tail -f nextjs.log

# Test database
mysql -h 127.0.0.1 -P 3307 -u lcaadmin -p lca_v3

# Restart just Next.js
npm run dev

# Check what's using port 3002
lsof -ti:3002
```

---

## Common Issues & Solutions

### "Port 3002 already in use"
```bash
lsof -ti:3002 | xargs kill -9
npm run dev
```

### "Cannot connect to database"
```bash
# Check tunnel is running
./CHECK_LOCAL_STATUS.sh

# Restart tunnel
./STOP_LOCAL_DEVELOPMENT.sh
./START_LOCAL_DEVELOPMENT.sh
```

### "npm install fails"
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### "Page not loading"
```bash
# Clear Next.js cache
rm -rf .next
npm run dev
```

---

## Tips & Best Practices

1. **Always use the scripts** - They handle cleanup and setup properly
2. **Check status before starting** - Avoid port conflicts
3. **Monitor logs** - Catch errors early: `tail -f nextjs.log`
4. **Use TablePlus** - Visual database management is easier
5. **Keep tunnel running** - Don't close terminal with tunnel active

---

## Next Steps

Now that you're running locally:

1. **Login**: http://localhost:3002/auth/login
2. **Create a project**: Click "New Project"
3. **Add components**: Build your LCA hierarchy
4. **Run assessments**: Calculate environmental impacts
5. **View results**: Analyze impact data

For API testing, see: `API_DOCUMENTATION.md`

---

**Ready to code!** 🎉

If you encounter any issues, run `./CHECK_LOCAL_STATUS.sh` first.
